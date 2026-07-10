import type { Env } from "./env.js"
import { deleteExpired } from "./lib/db.js"
import { html, json } from "./lib/http.js"
import { adminPage, dropPage, policyPage } from "./lib/pages.js"
import { PresenceRoom } from "./presence.js"
import { handleAdmin } from "./routes/admin.js"
import { handleAiReview } from "./routes/ai-review.js"
import {
	handleJson,
	handleManifest,
	handleRaw,
	handleSharePage,
	handleStats,
} from "./routes/drop.js"
import { handleReport } from "./routes/reports.js"
import { handleUpload } from "./routes/upload.js"

function methodNotAllowed(): Response {
	return json({ error: "method not allowed" }, { status: 405 })
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const url = new URL(request.url)
	const now = Date.now()
	// Everything this Worker owns lives under /drop.
	let path = url.pathname
	if (path.length > 5 && path.endsWith("/")) path = path.slice(0, -1)

	if (path === "/drop") {
		return request.method === "GET" ? html(dropPage(env.TOS_VERSION)) : methodNotAllowed()
	}
	if (!path.startsWith("/drop/")) return json({ error: "not found" }, { status: 404 })

	const rest = path.slice("/drop".length) // always begins with "/"

	// Static pages.
	if (rest === "/terms") return html(policyPage("terms", env.TOS_VERSION))
	if (rest === "/privacy") return html(policyPage("privacy", env.TOS_VERSION))
	if (rest === "/admin") return html(adminPage(), { noindex: true })

	// API.
	if (rest === "/api/drops") {
		return request.method === "POST" ? handleUpload(request, env, now) : methodNotAllowed()
	}
	if (rest === "/api/reports") {
		return request.method === "POST" ? handleReport(request, env, now) : methodNotAllowed()
	}
	if (rest === "/api/stats") {
		return request.method === "GET" ? handleStats(env) : methodNotAllowed()
	}
	if (rest.startsWith("/api/admin")) {
		return handleAdmin(request, rest.slice("/api/admin".length), env, now)
	}
	const aiReview = rest.match(/^\/api\/ai-review\/([\w-]+)\/(.+)$/)
	if (aiReview) {
		if (request.method !== "POST") return methodNotAllowed()
		return handleAiReview(
			request,
			aiReview[1] as string,
			decodeURIComponent(aiReview[2] as string),
			env,
			now,
		)
	}
	const presence = rest.match(/^\/api\/presence\/([\w-]+)$/)
	if (presence) {
		const shareId = presence[1] as string
		const stub = env.PRESENCE.get(env.PRESENCE.idFromName(shareId))
		return stub.fetch(request)
	}

	// Share routes: /:id, /:id/manifest.json, /:id/f/:filename
	const manifest = rest.match(/^\/([\w-]+)\/manifest\.json$/)
	if (manifest) {
		return request.method === "GET"
			? handleManifest(manifest[1] as string, env)
			: methodNotAllowed()
	}
	const file = rest.match(/^\/([\w-]+)\/f\/(.+)$/)
	if (file) {
		if (request.method !== "GET") return methodNotAllowed()
		const shareId = file[1] as string
		const filename = decodeURIComponent(file[2] as string)
		return url.searchParams.get("format") === "json"
			? handleJson(shareId, filename, env)
			: handleRaw(shareId, filename, env)
	}
	const share = rest.match(/^\/([\w-]+)$/)
	if (share) {
		return request.method === "GET"
			? handleSharePage(share[1] as string, env, ctx, now)
			: methodNotAllowed()
	}

	return json({ error: "not found" }, { status: 404 })
}

export default {
	fetch(request, env, ctx) {
		return route(request, env, ctx)
	},
	scheduled(_event, env, ctx) {
		ctx.waitUntil(deleteExpired(env.DB, Date.now()))
	},
} satisfies ExportedHandler<Env>

export { PresenceRoom }
