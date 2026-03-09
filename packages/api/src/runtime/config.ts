import { readFileSync } from "node:fs"
import { CamundaError } from "./errors.js"
import type {
	AuthConfig,
	CacheConfig,
	CamundaClientConfig,
	CamundaClientInput,
	LogLevel,
	LoggerConfig,
	RetryConfig,
	TokenCacheConfig,
} from "./types.js"
import { parseYaml } from "./yaml.js"

// ─── Environment variable names ───────────────────────────────────────────────

const ENV = {
	BASE_URL: "CAMUNDA_BASE_URL",
	CONFIG_FILE: "CAMUNDA_CONFIG_FILE",
	TIMEOUT: "CAMUNDA_TIMEOUT",
	AUTH_TYPE: "CAMUNDA_AUTH_TYPE",
	AUTH_TOKEN: "CAMUNDA_AUTH_TOKEN",
	AUTH_CLIENT_ID: "CAMUNDA_AUTH_CLIENT_ID",
	AUTH_CLIENT_SECRET: "CAMUNDA_AUTH_CLIENT_SECRET",
	AUTH_TOKEN_URL: "CAMUNDA_AUTH_TOKEN_URL",
	AUTH_SCOPE: "CAMUNDA_AUTH_SCOPE",
	AUTH_USERNAME: "CAMUNDA_AUTH_USERNAME",
	AUTH_PASSWORD: "CAMUNDA_AUTH_PASSWORD",
	TOKEN_CACHE_DISABLED: "CAMUNDA_TOKEN_CACHE_DISABLED",
	TOKEN_CACHE_FILE: "CAMUNDA_TOKEN_CACHE_FILE",
	RETRY_MAX_ATTEMPTS: "CAMUNDA_RETRY_MAX_ATTEMPTS",
	RETRY_INITIAL_DELAY: "CAMUNDA_RETRY_INITIAL_DELAY",
	RETRY_MAX_DELAY: "CAMUNDA_RETRY_MAX_DELAY",
	RETRY_BACKOFF_FACTOR: "CAMUNDA_RETRY_BACKOFF_FACTOR",
	RETRY_ON: "CAMUNDA_RETRY_ON",
	CACHE_ENABLED: "CAMUNDA_CACHE_ENABLED",
	CACHE_TTL: "CAMUNDA_CACHE_TTL",
	CACHE_MAX_SIZE: "CAMUNDA_CACHE_MAX_SIZE",
	LOG_LEVEL: "CAMUNDA_LOG_LEVEL",
} as const

// ─── Env loader ───────────────────────────────────────────────────────────────

function loadFromEnv(): CamundaClientInput {
	const e = process.env
	const result: CamundaClientInput = {}

	if (e[ENV.BASE_URL]) result.baseUrl = e[ENV.BASE_URL]
	if (e[ENV.CONFIG_FILE]) result.configFile = e[ENV.CONFIG_FILE]
	if (e[ENV.TIMEOUT]) result.timeout = Number.parseInt(e[ENV.TIMEOUT] ?? "", 10)

	const auth = authFromEnv(e)
	if (auth) result.auth = auth

	const retry = retryFromEnv(e)
	if (retry) result.retry = retry

	const cache = cacheFromEnv(e)
	if (cache) result.cache = cache

	const logger = loggerFromEnv(e)
	if (logger) result.logger = logger

	return result
}

function authFromEnv(e: NodeJS.ProcessEnv): AuthConfig | undefined {
	const type = e[ENV.AUTH_TYPE]
	if (!type) return undefined

	switch (type) {
		case "bearer": {
			const token = e[ENV.AUTH_TOKEN]
			if (!token) return undefined
			return { type: "bearer", token }
		}
		case "oauth2": {
			const clientId = e[ENV.AUTH_CLIENT_ID]
			const clientSecret = e[ENV.AUTH_CLIENT_SECRET]
			const tokenUrl = e[ENV.AUTH_TOKEN_URL]
			if (!clientId || !clientSecret || !tokenUrl) return undefined
			const tokenCache = tokenCacheFromEnv(e)
			return {
				type: "oauth2",
				clientId,
				clientSecret,
				tokenUrl,
				...(e[ENV.AUTH_SCOPE] ? { scope: e[ENV.AUTH_SCOPE] } : {}),
				...(tokenCache ? { tokenCache } : {}),
			}
		}
		case "basic": {
			const username = e[ENV.AUTH_USERNAME]
			const password = e[ENV.AUTH_PASSWORD]
			if (!username || !password) return undefined
			return { type: "basic", username, password }
		}
		case "none":
			return { type: "none" }
		default:
			return undefined
	}
}

function tokenCacheFromEnv(e: NodeJS.ProcessEnv): TokenCacheConfig | undefined {
	const disabled = e[ENV.TOKEN_CACHE_DISABLED]
	const filePath = e[ENV.TOKEN_CACHE_FILE]
	if (!disabled && !filePath) return undefined
	return {
		...(disabled !== undefined ? { disabled: disabled === "true" || disabled === "1" } : {}),
		...(filePath ? { filePath } : {}),
	}
}

function retryFromEnv(e: NodeJS.ProcessEnv): RetryConfig | undefined {
	const cfg: RetryConfig = {}
	if (e[ENV.RETRY_MAX_ATTEMPTS])
		cfg.maxAttempts = Number.parseInt(e[ENV.RETRY_MAX_ATTEMPTS] ?? "", 10)
	if (e[ENV.RETRY_INITIAL_DELAY])
		cfg.initialDelay = Number.parseInt(e[ENV.RETRY_INITIAL_DELAY] ?? "", 10)
	if (e[ENV.RETRY_MAX_DELAY]) cfg.maxDelay = Number.parseInt(e[ENV.RETRY_MAX_DELAY] ?? "", 10)
	if (e[ENV.RETRY_BACKOFF_FACTOR])
		cfg.backoffFactor = Number.parseFloat(e[ENV.RETRY_BACKOFF_FACTOR] ?? "")
	if (e[ENV.RETRY_ON]) {
		cfg.retryOn = (e[ENV.RETRY_ON] ?? "")
			.split(",")
			.map((s) => Number.parseInt(s.trim(), 10))
			.filter((n) => !Number.isNaN(n))
	}
	return Object.keys(cfg).length > 0 ? cfg : undefined
}

function cacheFromEnv(e: NodeJS.ProcessEnv): CacheConfig | undefined {
	const cfg: CacheConfig = {}
	if (e[ENV.CACHE_ENABLED] !== undefined) {
		cfg.enabled = e[ENV.CACHE_ENABLED] === "true" || e[ENV.CACHE_ENABLED] === "1"
	}
	if (e[ENV.CACHE_TTL]) cfg.ttl = Number.parseInt(e[ENV.CACHE_TTL] ?? "", 10)
	if (e[ENV.CACHE_MAX_SIZE]) cfg.maxSize = Number.parseInt(e[ENV.CACHE_MAX_SIZE] ?? "", 10)
	return Object.keys(cfg).length > 0 ? cfg : undefined
}

function loggerFromEnv(e: NodeJS.ProcessEnv): LoggerConfig | undefined {
	const level = e[ENV.LOG_LEVEL] as LogLevel | undefined
	if (!level) return undefined
	return { level }
}

// ─── File loader ──────────────────────────────────────────────────────────────

function loadFromFile(filePath: string): CamundaClientInput {
	let raw: string
	try {
		raw = readFileSync(filePath, "utf8")
	} catch (err) {
		throw new CamundaError(`Cannot read config file "${filePath}": ${err}`)
	}

	let doc: Record<string, unknown>
	try {
		doc = parseYaml(raw)
	} catch (err) {
		throw new CamundaError(`Cannot parse config file "${filePath}": ${err}`)
	}

	return coerceFileConfig(doc, filePath)
}

function coerceFileConfig(doc: Record<string, unknown>, filePath: string): CamundaClientInput {
	const result: CamundaClientInput = {}

	if (typeof doc.baseUrl === "string") result.baseUrl = doc.baseUrl
	if (typeof doc.configFile === "string") result.configFile = doc.configFile
	if (typeof doc.timeout === "number") result.timeout = doc.timeout

	const auth = coerceAuth(doc.auth, filePath)
	if (auth) result.auth = auth

	const retry = coerceRetry(doc.retry)
	if (retry) result.retry = retry

	const cache = coerceCache(doc.cache)
	if (cache) result.cache = cache

	const logger = coerceLogger(doc.logger)
	if (logger) result.logger = logger

	return result
}

function coerceAuth(raw: unknown, filePath: string): AuthConfig | undefined {
	if (typeof raw !== "object" || raw === null) return undefined
	const a = raw as Record<string, unknown>
	const type = a.type

	switch (type) {
		case "bearer":
			if (typeof a.token !== "string") return undefined
			return { type: "bearer", token: a.token }

		case "oauth2": {
			if (
				typeof a.clientId !== "string" ||
				typeof a.clientSecret !== "string" ||
				typeof a.tokenUrl !== "string"
			) {
				throw new CamundaError(
					`Config file "${filePath}": oauth2 auth requires clientId, clientSecret, and tokenUrl`,
				)
			}
			const tokenCache = coerceTokenCache(a.tokenCache)
			return {
				type: "oauth2",
				clientId: a.clientId,
				clientSecret: a.clientSecret,
				tokenUrl: a.tokenUrl,
				...(typeof a.scope === "string" ? { scope: a.scope } : {}),
				...(tokenCache ? { tokenCache } : {}),
			}
		}

		case "basic":
			if (typeof a.username !== "string" || typeof a.password !== "string") return undefined
			return { type: "basic", username: a.username, password: a.password }

		case "none":
			return { type: "none" }

		default:
			return undefined
	}
}

function coerceTokenCache(raw: unknown): TokenCacheConfig | undefined {
	if (typeof raw !== "object" || raw === null) return undefined
	const t = raw as Record<string, unknown>
	const cfg: TokenCacheConfig = {}
	if (typeof t.disabled === "boolean") cfg.disabled = t.disabled
	if (typeof t.filePath === "string") cfg.filePath = t.filePath
	return Object.keys(cfg).length > 0 ? cfg : undefined
}

function coerceRetry(raw: unknown): RetryConfig | undefined {
	if (typeof raw !== "object" || raw === null) return undefined
	const r = raw as Record<string, unknown>
	const cfg: RetryConfig = {}
	if (typeof r.maxAttempts === "number") cfg.maxAttempts = r.maxAttempts
	if (typeof r.initialDelay === "number") cfg.initialDelay = r.initialDelay
	if (typeof r.maxDelay === "number") cfg.maxDelay = r.maxDelay
	if (typeof r.backoffFactor === "number") cfg.backoffFactor = r.backoffFactor
	if (Array.isArray(r.retryOn)) {
		cfg.retryOn = r.retryOn.filter((n): n is number => typeof n === "number")
	}
	return Object.keys(cfg).length > 0 ? cfg : undefined
}

function coerceCache(raw: unknown): CacheConfig | undefined {
	if (typeof raw !== "object" || raw === null) return undefined
	const c = raw as Record<string, unknown>
	const cfg: CacheConfig = {}
	if (typeof c.enabled === "boolean") cfg.enabled = c.enabled
	if (typeof c.ttl === "number") cfg.ttl = c.ttl
	if (typeof c.maxSize === "number") cfg.maxSize = c.maxSize
	return Object.keys(cfg).length > 0 ? cfg : undefined
}

function coerceLogger(raw: unknown): LoggerConfig | undefined {
	if (typeof raw !== "object" || raw === null) return undefined
	const l = raw as Record<string, unknown>
	if (typeof l.level === "string") return { level: l.level as LogLevel }
	return undefined
}

// ─── Merge ────────────────────────────────────────────────────────────────────

/**
 * Merge auth configs from multiple sources (lowest → highest priority).
 * When the `type` matches across sources, fields are merged so you can
 * split non-sensitive config (type, tokenUrl) from secrets (clientSecret).
 */
function mergeAuth(...sources: (AuthConfig | undefined)[]): AuthConfig | undefined {
	// Determine winning auth type from highest-priority source that declares one
	let winningType: string | undefined
	for (const s of sources) {
		if (s?.type) winningType = s.type
	}
	if (!winningType) return undefined

	// Collect all fields from sources that share the winning type
	const merged: Record<string, unknown> = { type: winningType }
	for (const s of sources) {
		if (!s) continue
		if (s.type !== winningType) continue // different type — skip entirely
		Object.assign(merged, s)
	}

	return merged as AuthConfig
}

function mergeRetry(...sources: (RetryConfig | undefined)[]): RetryConfig | undefined {
	const merged: RetryConfig = {}
	for (const s of sources) {
		if (!s) continue
		if (s.maxAttempts !== undefined) merged.maxAttempts = s.maxAttempts
		if (s.initialDelay !== undefined) merged.initialDelay = s.initialDelay
		if (s.maxDelay !== undefined) merged.maxDelay = s.maxDelay
		if (s.backoffFactor !== undefined) merged.backoffFactor = s.backoffFactor
		if (s.retryOn !== undefined) merged.retryOn = s.retryOn
	}
	return Object.keys(merged).length > 0 ? merged : undefined
}

function mergeCache(...sources: (CacheConfig | undefined)[]): CacheConfig | undefined {
	const merged: CacheConfig = {}
	for (const s of sources) {
		if (!s) continue
		if (s.enabled !== undefined) merged.enabled = s.enabled
		if (s.ttl !== undefined) merged.ttl = s.ttl
		if (s.maxSize !== undefined) merged.maxSize = s.maxSize
	}
	return Object.keys(merged).length > 0 ? merged : undefined
}

function mergeLogger(...sources: (LoggerConfig | undefined)[]): LoggerConfig | undefined {
	let result: LoggerConfig | undefined
	for (const s of sources) {
		if (!s) continue
		result = { ...result, ...s }
	}
	return result
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve the final `CamundaClientConfig` from three layers (lowest → highest):
 *  1. Environment variables (CAMUNDA_*)
 *  2. YAML config file (path from `input.configFile` or `CAMUNDA_CONFIG_FILE`)
 *  3. Values passed directly to the constructor (`input`)
 *
 * Throws `CamundaError` if `baseUrl` or `auth` cannot be resolved.
 */
export function resolveConfig(input: CamundaClientInput): CamundaClientConfig {
	const fromEnv = loadFromEnv()

	// Config file path: constructor > env
	const configFilePath = input.configFile ?? fromEnv.configFile
	const fromFile: CamundaClientInput = configFilePath ? loadFromFile(configFilePath) : {}

	// Merge: env (lowest) < file < explicit (highest)
	const baseUrl = input.baseUrl ?? fromFile.baseUrl ?? fromEnv.baseUrl
	const auth = mergeAuth(fromEnv.auth, fromFile.auth, input.auth)
	const timeout = input.timeout ?? fromFile.timeout ?? fromEnv.timeout
	const configFile = configFilePath
	const retry = mergeRetry(fromEnv.retry, fromFile.retry, input.retry)
	const cache = mergeCache(fromEnv.cache, fromFile.cache, input.cache)
	const logger = mergeLogger(fromEnv.logger, fromFile.logger, input.logger)

	if (!baseUrl) {
		throw new CamundaError(
			"baseUrl is required. Set it in the constructor, a config file, or CAMUNDA_BASE_URL.",
		)
	}
	if (!auth) {
		throw new CamundaError(
			"auth is required. Set it in the constructor, a config file, or CAMUNDA_AUTH_* env vars.",
		)
	}

	return {
		baseUrl,
		auth,
		...(configFile ? { configFile } : {}),
		...(timeout !== undefined ? { timeout } : {}),
		...(retry ? { retry } : {}),
		...(cache ? { cache } : {}),
		...(logger ? { logger } : {}),
	}
}

/** Exported for testing. */
export { loadFromEnv, loadFromFile }
