/** Bindings and vars available to the Worker, configured in wrangler.jsonc. */
export interface Env {
	/** D1 database holding drops, files, content, reports, and bans. */
	DB: D1Database
	/** Durable Object namespace — one PresenceRoom instance per shareId. */
	PRESENCE: DurableObjectNamespace
	/** Static assets (client bundles, CSS) served from ./public. */
	ASSETS: Fetcher
	/** Terms/Privacy version recorded on each drop. */
	TOS_VERSION: string
	/** Operator secret for admin endpoints (`wrangler secret put DROP_ADMIN_TOKEN`). */
	DROP_ADMIN_TOKEN?: string
	/** Salt for hashing reporter IPs (`wrangler secret put REPORT_IP_SALT`). */
	REPORT_IP_SALT?: string
}
