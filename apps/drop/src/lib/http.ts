/** HTTP helpers: escaping, security headers, and typed response builders. */

/** Escape a string for safe interpolation into HTML text or double-quoted attributes. */
export function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;")
}

/** Serialize data for embedding inside a `<script type="application/json">` tag. */
export function jsonForScript(data: unknown): string {
	return JSON.stringify(data)
		.replaceAll("<", "\\u003c")
		.replaceAll(">", "\\u003e")
		.replaceAll("\u2028", "\\u2028")
		.replaceAll("\u2029", "\\u2029")
}

/** Where Turnstile's widget script and its iframe come from. */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com"

function csp(allowTurnstile: boolean): string {
	// Widened only for the one page that can show the widget, and only when the
	// feature is configured. A content policy that is loose everywhere because
	// one page needs it is a policy that protects nothing.
	const script = allowTurnstile ? `script-src 'self' ${TURNSTILE_ORIGIN}` : "script-src 'self'"
	const frame = allowTurnstile ? `frame-src 'self' ${TURNSTILE_ORIGIN}` : "frame-src 'self'"
	return [
		"default-src 'self'",
		"img-src 'self' data:",
		"style-src 'self' 'unsafe-inline'",
		script,
		"connect-src 'self'",
		frame,
		"base-uri 'none'",
		"form-action 'self'",
	].join("; ")
}

/** Baseline security headers applied to every response. */
export function securityHeaders(options: { turnstile?: boolean } = {}): Record<string, string> {
	return {
		"Content-Security-Policy": csp(options.turnstile === true),
		"X-Content-Type-Options": "nosniff",
		"Referrer-Policy": "no-referrer",
		"X-Frame-Options": "SAMEORIGIN",
	}
}

/** Build an HTML response with security headers and an optional `noindex` directive. */
export function html(
	body: string,
	init: { status?: number; noindex?: boolean; turnstile?: boolean } = {},
): Response {
	const headers: Record<string, string> = {
		"Content-Type": "text/html; charset=utf-8",
		...securityHeaders({ turnstile: init.turnstile }),
	}
	if (init.noindex) headers["X-Robots-Tag"] = "noindex"
	return new Response(body, { status: init.status ?? 200, headers })
}

/** Build a JSON response. */
export function json(data: unknown, init: { status?: number } = {}): Response {
	return new Response(JSON.stringify(data), {
		status: init.status ?? 200,
		headers: { "Content-Type": "application/json; charset=utf-8", ...securityHeaders() },
	})
}

/** Best-effort client IP from Cloudflare's connecting-IP header. */
export function clientIp(request: Request): string {
	return request.headers.get("cf-connecting-ip") ?? "0.0.0.0"
}

/** Constant-time string comparison — avoids leaking secrets via timing. */
export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false
	let diff = 0
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
	return diff === 0
}
