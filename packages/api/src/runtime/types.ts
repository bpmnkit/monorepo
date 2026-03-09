export type LogLevel = "debug" | "info" | "warn" | "error" | "none"

export interface LoggerConfig {
	level?: LogLevel
	/** Custom sink. Defaults to console. */
	sink?: (level: LogLevel, message: string, data?: unknown) => void
}

export interface RetryConfig {
	/** Maximum number of attempts (including the first). Default: 3. */
	maxAttempts?: number
	/** Initial delay in ms. Default: 100. */
	initialDelay?: number
	/** Maximum delay cap in ms. Default: 30_000. */
	maxDelay?: number
	/** Multiplier applied to delay after each failure. Default: 2. */
	backoffFactor?: number
	/** HTTP status codes that trigger a retry. Default: [429, 500, 502, 503, 504]. */
	retryOn?: number[]
}

export interface CacheConfig {
	/** Enable response caching for eventually-consistent GET/POST-search endpoints. Default: false. */
	enabled?: boolean
	/** Time-to-live in ms. Default: 30_000. */
	ttl?: number
	/** Maximum number of cached entries. Default: 500. */
	maxSize?: number
}

// ---- OAuth2 token persistence ----

/** A cached OAuth2 access token. */
export interface CachedToken {
	accessToken: string
	/** Unix timestamp (ms) when the token expires. */
	expiresAt: number
}

/**
 * Interface for a persistent OAuth2 token store.
 * Implement this to store tokens in Redis, a database, or any custom backend.
 *
 * @example
 * ```typescript
 * const redisStore: TokenStore = {
 *   async get(key) {
 *     const raw = await redis.get(`token:${key}`);
 *     return raw ? JSON.parse(raw) : null;
 *   },
 *   async set(key, token) {
 *     const ttl = Math.floor((token.expiresAt - Date.now()) / 1000);
 *     await redis.set(`token:${key}`, JSON.stringify(token), "EX", ttl);
 *   },
 * };
 * ```
 */
export interface TokenStore {
	get(key: string): Promise<CachedToken | null>
	set(key: string, token: CachedToken): Promise<void>
}

export interface TokenCacheConfig {
	/**
	 * Disable the persistent token cache entirely.
	 * The token will only be held in memory for the lifetime of the client instance.
	 * Default: false.
	 */
	disabled?: boolean
	/**
	 * Absolute path to the token cache JSON file.
	 * Defaults to `{osConfigDir}/camunda-api/token-cache.json`.
	 */
	filePath?: string
	/**
	 * Custom token store. When provided, overrides the default file-based cache.
	 * Use this to store tokens in Redis, a database, or any other backend.
	 */
	store?: TokenStore
}

// ---- Authentication ----

export type AuthConfig =
	| { type: "bearer"; token: string }
	| {
			type: "oauth2"
			clientId: string
			clientSecret: string
			/** Token endpoint URL. */
			tokenUrl: string
			scope?: string
			/** OAuth2 audience parameter. Required by Camunda Cloud (default: "zeebe.camunda.io"). */
			audience?: string
			/**
			 * Persistent token cache configuration.
			 * Enabled by default — tokens survive process restarts.
			 */
			tokenCache?: TokenCacheConfig
	  }
	| { type: "basic"; username: string; password: string }
	| { type: "none" }

// ---- Client config ----

export interface CamundaClientConfig {
	/** Base URL of the Camunda cluster, e.g. http://localhost:8080/v2 */
	baseUrl: string
	auth: AuthConfig
	/**
	 * Path to a YAML config file. Fields from the file are merged with lower
	 * priority than values passed directly to the constructor.
	 */
	configFile?: string
	retry?: RetryConfig
	cache?: CacheConfig
	logger?: LoggerConfig
	/** Request timeout in ms. Default: 30_000. */
	timeout?: number
}

/**
 * All fields optional — missing values are resolved from the config file
 * or environment variables. Useful when config is fully provided via env/file.
 */
export type CamundaClientInput = {
	baseUrl?: string
	auth?: AuthConfig
	configFile?: string
	retry?: RetryConfig
	cache?: CacheConfig
	logger?: LoggerConfig
	timeout?: number
}

// ---- Event map ----

export interface RequestEvent {
	method: string
	url: string
	headers: Record<string, string>
	body?: unknown
}

export interface ResponseEvent {
	method: string
	url: string
	status: number
	durationMs: number
	cached: boolean
}

export interface ErrorEvent {
	method: string
	url: string
	error: Error
}

export interface RetryEvent {
	method: string
	url: string
	attempt: number
	maxAttempts: number
	delayMs: number
	reason: string
}

export interface TokenRefreshEvent {
	tokenUrl: string
}

export interface CacheEvent {
	url: string
}

export type ClientEventMap = {
	request: RequestEvent
	response: ResponseEvent
	error: ErrorEvent
	retry: RetryEvent
	tokenRefresh: TokenRefreshEvent
	cacheHit: CacheEvent
	cacheMiss: CacheEvent
}

// ---- Internal request options ----

export interface RequestOptions {
	method: string
	path: string
	pathParams?: Record<string, string | number>
	query?: Record<string, unknown>
	body?: unknown
	/** Whether this response may be served from cache. */
	cacheable?: boolean
	/** Override timeout for this request. */
	timeout?: number
}
