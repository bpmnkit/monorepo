import type { Env } from "../env.js"
import { getDrop, getFileBody, getStats, recordView } from "../lib/db.js"
import { demoDrop, demoFileBody, isDemo } from "../lib/demo.js"
import { html, json, securityHeaders } from "../lib/http.js"
import { notFoundPage, sharePage } from "../lib/pages.js"

/** GET /drop/api/stats — public drop/view counters, cached at the edge for 60s. */
export async function handleStats(env: Env): Promise<Response> {
	const stats = await getStats(env.DB)
	return new Response(JSON.stringify(stats), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=60",
			...securityHeaders(),
		},
	})
}

/** GET /drop/:shareId — the read-only viewer page. */
export async function handleSharePage(
	shareId: string,
	env: Env,
	ctx: ExecutionContext,
	now: number,
): Promise<Response> {
	const aiEnabled = env.AI_PASSCODE !== undefined
	if (isDemo(shareId)) {
		const demo = await demoDrop()
		return html(sharePage(shareId, demo.drop, demo.files, aiEnabled), { noindex: true })
	}
	const found = await getDrop(env.DB, shareId)
	if (!found) return html(notFoundPage(), { status: 404, noindex: true })
	ctx.waitUntil(recordView(env.DB, shareId, now))
	return html(sharePage(shareId, found.drop, found.files, aiEnabled), { noindex: true })
}

/** GET /drop/:shareId/manifest.json — metadata and file list. */
export async function handleManifest(shareId: string, env: Env): Promise<Response> {
	const found = isDemo(shareId) ? await demoDrop() : await getDrop(env.DB, shareId)
	if (!found) return json({ error: "not found" }, { status: 404 })
	return json({
		shareId,
		createdAt: found.drop.created_at,
		viewCount: found.drop.view_count,
		expiresAt: found.drop.expires_at,
		files: found.files.map((f) => ({
			filename: f.filename,
			kind: f.kind,
			name: f.name,
			meta: f.meta,
		})),
	})
}

/** GET /drop/:shareId/f/:filename — the original bytes as a safe download. */
export async function handleRaw(shareId: string, filename: string, env: Env): Promise<Response> {
	const row = isDemo(shareId)
		? await demoFileBody(filename, "original")
		: await getFileBody(env.DB, shareId, filename, "original")
	if (!row) return json({ error: "not found" }, { status: 404 })
	return new Response(row.body, {
		headers: {
			// Never let a browser render an uploaded document inline.
			"Content-Type": "application/octet-stream",
			"Content-Disposition": `attachment; filename="${filename}"`,
			ETag: `"${row.hash}"`,
			...securityHeaders(),
		},
	})
}

/** GET /drop/:shareId/f/:filename.json — the stored JSON model. */
export async function handleJson(shareId: string, filename: string, env: Env): Promise<Response> {
	const row = isDemo(shareId)
		? await demoFileBody(filename, "json")
		: await getFileBody(env.DB, shareId, filename, "json")
	if (!row) return json({ error: "not found" }, { status: 404 })
	return new Response(row.body, {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			ETag: `"${row.hash}"`,
			...securityHeaders(),
		},
	})
}
