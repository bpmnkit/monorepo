import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import type { CachedToken, TokenStore } from "./types.js"

/** Returns the OS-appropriate application config directory. */
export function osConfigDir(): string {
	if (process.platform === "win32") {
		return process.env.APPDATA ?? join(homedir(), "AppData", "Roaming")
	}
	if (process.platform === "darwin") {
		return join(homedir(), "Library", "Application Support")
	}
	// Linux / other — respect XDG
	return process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
}

/** Default path for the token cache file. */
export function defaultTokenCachePath(): string {
	return join(osConfigDir(), "camunda-api", "token-cache.json")
}

/**
 * Builds a cache key for an OAuth2 client.
 * Incorporates clientId, tokenUrl, and optional scope to support
 * multiple clients/clusters from a single cache file.
 */
export function buildTokenCacheKey(
	clientId: string,
	tokenUrl: string,
	scope?: string,
	audience?: string,
): string {
	let key = `${clientId}@${tokenUrl}`
	if (scope) key += `:${scope}`
	if (audience) key += `#${audience}`
	return key
}

// ─── Implementations ──────────────────────────────────────────────────────────

/**
 * Persists OAuth2 tokens to a JSON file in the OS config directory.
 * Multiple clients sharing the same file are safe because Node.js is
 * single-threaded and each write is atomic (synchronous).
 */
export class FileTokenStore implements TokenStore {
	#filePath: string

	constructor(filePath?: string) {
		this.#filePath = filePath ?? defaultTokenCachePath()
	}

	async get(key: string): Promise<CachedToken | null> {
		try {
			const content = readFileSync(this.#filePath, "utf8")
			const cache = JSON.parse(content) as Record<string, CachedToken>
			const entry = cache[key]
			if (!entry) return null
			// Treat tokens as expired 60 s early so we never hand out a nearly-stale one
			if (Date.now() >= entry.expiresAt - 60_000) return null
			return entry
		} catch {
			// File absent or malformed — treat as cache miss
			return null
		}
	}

	async set(key: string, token: CachedToken): Promise<void> {
		try {
			let cache: Record<string, CachedToken> = {}
			try {
				cache = JSON.parse(readFileSync(this.#filePath, "utf8")) as Record<string, CachedToken>
			} catch {
				// Start with an empty cache if the file doesn't exist yet
			}
			cache[key] = token
			mkdirSync(dirname(this.#filePath), { recursive: true })
			writeFileSync(this.#filePath, JSON.stringify(cache, null, 2), "utf8")
		} catch (err) {
			// Non-fatal — the in-memory token still works for this session
			process.stderr.write(
				`[camunda-api] Warning: could not write token cache to ${this.#filePath}: ${err}\n`,
			)
		}
	}

	get filePath(): string {
		return this.#filePath
	}
}

/** No-op store used when the token cache is disabled. */
export class NullTokenStore implements TokenStore {
	async get(_key: string): Promise<null> {
		return null
	}
	async set(_key: string, _token: CachedToken): Promise<void> {}
}

/**
 * Resolves the effective token store from the config.
 *
 * Priority:
 *  1. `config.store`   — custom implementation (Redis, DB, …)
 *  2. `config.disabled` — NullTokenStore (in-memory only)
 *  3. FileTokenStore   — default, persists to the OS config dir
 */
export function resolveTokenStore(
	config: { disabled?: boolean; filePath?: string; store?: TokenStore } | undefined,
): TokenStore {
	if (config?.store) return config.store
	if (config?.disabled === true) return new NullTokenStore()
	return new FileTokenStore(config?.filePath)
}
