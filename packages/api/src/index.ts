// Runtime — config types
export type {
	CamundaClientConfig,
	CamundaClientInput,
	AuthConfig,
	RetryConfig,
	CacheConfig,
	LoggerConfig,
	LogLevel,
	CachedToken,
	TokenStore,
	TokenCacheConfig,
} from "./runtime/types.js"

// Runtime — event types
export type {
	ClientEventMap,
	RequestEvent,
	ResponseEvent,
	ErrorEvent,
	RetryEvent,
	TokenRefreshEvent,
	CacheEvent,
} from "./runtime/types.js"

// Runtime — errors
export {
	CamundaError,
	CamundaHttpError,
	CamundaValidationError,
	CamundaAuthError,
	CamundaForbiddenError,
	CamundaNotFoundError,
	CamundaConflictError,
	CamundaRateLimitError,
	CamundaServerError,
	CamundaNetworkError,
	CamundaTimeoutError,
} from "./runtime/errors.js"

// Runtime — token store implementations
export { FileTokenStore, NullTokenStore, defaultTokenCachePath } from "./runtime/token-cache.js"

// Generated C8 client (the main export)
export { CamundaClient } from "./generated/resources.js"

// Generated C8 types
export type * from "./generated/types.js"

// Generated Admin API client
export { AdminApiClient } from "./generated/admin-resources.js"

// Generated Admin API types
export type * from "./generated/admin-types.js"
