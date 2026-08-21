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
	/** Workers AI binding — used by the AI process review. */
	AI: Ai
	/** Closed-beta access code for AI review. Unset = feature off (`wrangler secret put AI_PASSCODE`). */
	AI_PASSCODE?: string
	/** Workers AI model id (var; default `@cf/openai/gpt-oss-120b`). */
	AI_MODEL: string
	/** Daily neuron budget for AI reviews (var; string, parsed at the edge). */
	AI_DAILY_BUDGET: string
}
