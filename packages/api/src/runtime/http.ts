import { createAuthProvider } from "./auth.js"
import { Cache } from "./cache.js"
import {
	CamundaHttpError,
	CamundaNetworkError,
	CamundaTimeoutError,
	buildHttpError,
} from "./errors.js"
import type { TypedEventEmitter } from "./events.js"
import { createLogger } from "./logger.js"
import type { Logger } from "./logger.js"
import { withRetry } from "./retry.js"
import { resolveTokenStore } from "./token-cache.js"
import type { CamundaClientConfig, ClientEventMap, RequestOptions } from "./types.js"

/**
 * Core HTTP transport layer. Handles auth, retries, caching, timeouts,
 * logging, and event emission. Used by all generated resource classes.
 */
export class HttpClient {
	#config: CamundaClientConfig
	#auth: ReturnType<typeof createAuthProvider>
	#cache: Cache | null
	#logger: Logger
	#emitter: TypedEventEmitter<ClientEventMap>

	constructor(config: CamundaClientConfig, emitter: TypedEventEmitter<ClientEventMap>) {
		this.#config = config
		this.#emitter = emitter
		this.#logger = createLogger(config.logger)
		const tokenStore =
			config.auth.type === "oauth2" ? resolveTokenStore(config.auth.tokenCache) : undefined

		this.#auth = createAuthProvider(config.auth, tokenStore, () => {
			if (config.auth.type === "oauth2") {
				emitter.emit("tokenRefresh", { tokenUrl: config.auth.tokenUrl })
			}
		})

		const cacheConfig = config.cache
		this.#cache =
			cacheConfig?.enabled === true
				? new Cache(cacheConfig.ttl ?? 30_000, cacheConfig.maxSize ?? 500)
				: null
	}

	async request<T>(options: RequestOptions): Promise<T> {
		const url = this.#buildUrl(options)

		// Cache check (only for cacheable requests)
		if (options.cacheable && this.#cache) {
			const cacheKey = this.#cacheKey(options)
			const cached = this.#cache.get<T>(cacheKey)
			if (cached !== undefined) {
				this.#logger.debug("Cache hit", { url })
				this.#emitter.emit("cacheHit", { url })
				this.#emitter.emit("response", {
					method: options.method,
					url,
					status: 200,
					durationMs: 0,
					cached: true,
				})
				return cached
			}
			this.#emitter.emit("cacheMiss", { url })
		}

		return withRetry(
			() => this.#executeRequest<T>(url, options),
			this.#config.retry,
			(err) => this.#shouldRetry(err),
			(ctx) => {
				this.#logger.warn("Retrying request", { url, ...ctx })
				this.#emitter.emit("retry", {
					method: options.method,
					url,
					...ctx,
				})
			},
		)
	}

	async #executeRequest<T>(url: string, options: RequestOptions): Promise<T> {
		const authHeader = await this.#auth.getAuthorizationHeader()
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "application/json",
		}
		if (authHeader) {
			headers.Authorization = authHeader
		}

		const body = options.body !== undefined ? JSON.stringify(options.body) : undefined
		if (body === undefined) {
			// biome-ignore lint/performance/noDelete: removing the header key is correct here
			delete headers["Content-Type"]
		}

		const requestEvent = { method: options.method, url, headers, body: options.body }
		this.#logger.debug("Request", requestEvent)
		this.#emitter.emit("request", requestEvent)

		const timeout = options.timeout ?? this.#config.timeout ?? 30_000
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), timeout)
		const startMs = Date.now()

		let response: Response
		try {
			response = await fetch(url, {
				method: options.method,
				headers,
				body,
				signal: controller.signal,
			})
		} catch (err) {
			clearTimeout(timer)
			const durationMs = Date.now() - startMs
			this.#logger.error("Network error", { url, durationMs, err })

			if (err instanceof Error && err.name === "AbortError") {
				const timeoutErr = new CamundaTimeoutError(
					`Request timed out after ${timeout}ms: ${options.method} ${url}`,
				)
				this.#emitter.emit("error", { method: options.method, url, error: timeoutErr })
				throw timeoutErr
			}

			const netErr = new CamundaNetworkError(
				`Network error: ${err instanceof Error ? err.message : String(err)}`,
				{ cause: err },
			)
			this.#emitter.emit("error", { method: options.method, url, error: netErr })
			throw netErr
		}

		clearTimeout(timer)
		const durationMs = Date.now() - startMs

		this.#logger.debug("Response", { url, status: response.status, durationMs })
		this.#emitter.emit("response", {
			method: options.method,
			url,
			status: response.status,
			durationMs,
			cached: false,
		})

		// Handle 401 with potential token refresh
		if (response.status === 401) {
			const canRetry = await this.#auth.handleUnauthorized()
			if (canRetry) {
				return this.#executeRequest<T>(url, options)
			}
		}

		if (!response.ok) {
			let errorBody: unknown
			try {
				errorBody = await response.json()
			} catch {
				errorBody = await response.text().catch(() => null)
			}
			const err = buildHttpError(response.status, errorBody, url)
			this.#logger.error("API error", { url, status: response.status, body: errorBody })
			this.#emitter.emit("error", { method: options.method, url, error: err })
			throw err
		}

		if (response.status === 204 || response.headers.get("content-length") === "0") {
			return undefined as T
		}

		const data = (await response.json()) as T

		// Store in cache if applicable
		if (options.cacheable && this.#cache) {
			this.#cache.set(this.#cacheKey(options), data)
		}

		return data
	}

	#buildUrl(options: RequestOptions): string {
		let path = options.path

		// Substitute path parameters
		if (options.pathParams) {
			for (const [key, value] of Object.entries(options.pathParams)) {
				path = path.replace(`{${key}}`, encodeURIComponent(String(value)))
			}
		}

		const base = this.#config.baseUrl.replace(/\/$/, "")
		let url = `${base}${path}`

		// Append query string
		if (options.query) {
			const params = new URLSearchParams()
			for (const [key, value] of Object.entries(options.query)) {
				if (value !== undefined && value !== null) {
					params.set(key, String(value))
				}
			}
			const qs = params.toString()
			if (qs) url += `?${qs}`
		}

		return url
	}

	#cacheKey(options: RequestOptions): string {
		return `${options.method}:${this.#buildUrl(options)}:${JSON.stringify(options.body ?? null)}`
	}

	#shouldRetry(err: unknown): { retry: boolean; reason: string; statusCode?: number } {
		if (err instanceof CamundaTimeoutError) {
			return { retry: true, reason: "timeout" }
		}
		if (err instanceof CamundaNetworkError) {
			return { retry: true, reason: "network error" }
		}
		if (err instanceof CamundaHttpError) {
			return {
				retry: true,
				reason: `HTTP ${err.status}`,
				statusCode: err.status,
			}
		}
		return { retry: false, reason: "unknown error" }
	}

	/** Expose cache for manual invalidation. */
	get cache(): Cache | null {
		return this.#cache
	}
}
