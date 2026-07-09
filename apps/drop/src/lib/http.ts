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

const CSP = [
	"default-src 'self'",
	"img-src 'self' data:",
	"style-src 'self' 'unsafe-inline'",
	"script-src 'self'",
	"connect-src 'self'",
	"frame-src 'self'",
	"base-uri 'none'",
	"form-action 'self'",
].join("; ")

/** Baseline security headers applied to every response. */
export function securityHeaders(): Record<string, string> {
	return {
		"Content-Security-Policy": CSP,
		"X-Content-Type-Options": "nosniff",
		"Referrer-Policy": "no-referrer",
		"X-Frame-Options": "SAMEORIGIN",
	}
}

/** Build an HTML response with security headers and an optional `noindex` directive. */
export function html(body: string, init: { status?: number; noindex?: boolean } = {}): Response {
	const headers: Record<string, string> = {
		"Content-Type": "text/html; charset=utf-8",
		...securityHeaders(),
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
