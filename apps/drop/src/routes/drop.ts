import type { Env } from "../env.js"
import type { FileInfo } from "../lib/db.js"
import { getCurrentBody, getDrop, getFileBody, getFileRef, getStats } from "../lib/db.js"
import { demoDrop, demoFileBody, isDemo } from "../lib/demo.js"
import { html, json, securityHeaders } from "../lib/http.js"
import { diffPage, notFoundPage, sharePage } from "../lib/pages.js"
import { getVersionBody } from "../lib/versions.js"
import type { FileKind } from "../shared/constants.js"
import { ORIGINAL_SEQ } from "../shared/constants.js"

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
export async function handleSharePage(shareId: string, env: Env): Promise<Response> {
	const aiEnabled = env.AI_PASSCODE !== undefined
	const turnstileKey = env.TURNSTILE_SITE_KEY
	// The policy is widened for the widget only where the widget can appear.
	const init = { noindex: true, turnstile: turnstileKey !== undefined }
	if (isDemo(shareId)) {
		const demo = await demoDrop()
		return html(sharePage(shareId, demo.drop, demo.files, aiEnabled, turnstileKey), init)
	}
	const found = await getDrop(env.DB, shareId)
	if (!found) return html(notFoundPage(), { status: 404, noindex: true })
	// Views are counted by the room when the viewer's socket joins, and written to
	// D1 on its alarm — one write per window rather than one per page load.
	return html(sharePage(shareId, found.drop, found.files, aiEnabled, turnstileKey), init)
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

/**
 * The entity tag for one representation of one state of a file.
 *
 * The content hash alone is not an entity tag, and using it as one was a bug:
 * the same hash was served for the XML and for the JSON model of the same
 * state, which are different bytes under the same name. A tag has to identify
 * the *representation*, so the version and the format go into it.
 *
 * A drop is mutable now, so `v=current` genuinely changes as the file is
 * edited — the hash underneath it is the current row's, not the upload's. `v=0`
 * and a milestone never change, because those states never do.
 */
function etag(version: number | undefined, rep: "original" | "json", hash: string): string {
	return `"${version === undefined ? "current" : `v${version}`}.${rep}.${hash}"`
}

/**
 * Answers a conditional request, or `null` when there is nothing to answer.
 *
 * `If-None-Match` is a list, and a weak comparison is the right one for a plain
 * GET — a proxy is free to have weakened the tag it stored.
 */
function notModified(request: Request, tag: string): Response | null {
	const header = request.headers.get("If-None-Match")
	if (!header) return null
	const bare = (t: string) => t.trim().replace(/^W\//, "")
	const matched = header.split(",").some((t) => bare(t) === "*" || bare(t) === bare(tag))
	return matched
		? new Response(null, { status: 304, headers: { ETag: tag, ...securityHeaders() } })
		: null
}

/**
 * GET /drop/:shareId/f/:filename — the file's bytes as a safe download.
 *
 * Serves the current state by default. `?v=0` pins the request to the uploaded
 * original, which is what the share page's "Original" link asks for; `?v=n`
 * serves milestone n, while it is still in the ring.
 */
export async function handleRaw(
	request: Request,
	shareId: string,
	filename: string,
	env: Env,
	version?: number,
): Promise<Response> {
	const row = isDemo(shareId)
		? await demoFileBody(filename, "original")
		: await readVersion(env, shareId, filename, "original", version)
	if (!row) return json({ error: "not found" }, { status: 404 })
	const tag = etag(version, "original", row.hash)
	return (
		notModified(request, tag) ??
		new Response(row.body, {
			headers: {
				// Never let a browser render an uploaded document inline.
				"Content-Type": "application/octet-stream",
				"Content-Disposition": `attachment; filename="${filename}"`,
				ETag: tag,
				...securityHeaders(),
			},
		})
	)
}

/** GET /drop/:shareId/f/:filename?format=json — the JSON model of the same state. */
export async function handleJson(
	request: Request,
	shareId: string,
	filename: string,
	env: Env,
	version?: number,
): Promise<Response> {
	const row = isDemo(shareId)
		? await demoFileBody(filename, "json")
		: await readVersion(env, shareId, filename, "json", version)
	if (!row) return json({ error: "not found" }, { status: 404 })
	const tag = etag(version, "json", row.hash)
	return (
		notModified(request, tag) ??
		new Response(row.body, {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				ETag: tag,
				...securityHeaders(),
			},
		})
	)
}

/**
 * Resolves which state of a file to serve.
 *
 * No `?v=` means "what this file says now". `?v=0` is the uploaded original, and
 * is the one request whose answer can never change. A milestone is served from
 * the ring, and 404s once it has rolled out of it — the history UI says the
 * bound out loud so that is an expected answer rather than a surprise.
 */
async function readVersion(
	env: Env,
	shareId: string,
	filename: string,
	rep: "original" | "json",
	version?: number,
): Promise<{ kind: FileKind; body: string; hash: string } | null> {
	if (version === undefined) return await getCurrentBody(env.DB, shareId, filename, rep)
	if (version === ORIGINAL_SEQ) return await getFileBody(env.DB, shareId, filename, rep)

	const ref = await getFileRef(env.DB, shareId, filename)
	if (!ref) return null
	const stored = await getVersionBody(env.DB, ref.id, version)
	if (!stored) return null
	// Milestones keep the source only; a JSON view of one would mean re-parsing
	// a superseded document on every request, for a panel that links to sources.
	if (rep === "json") return null
	return { kind: ref.kind, body: stored.body, hash: stored.hash }
}

/**
 * GET /drop/:a/diff/:b — compare the BPMN in two drops side by side.
 *
 * Both drops are fetched here rather than in the browser so a missing or
 * expired share is a 404 page instead of a half-rendered comparison.
 */
export async function handleDiffPage(aId: string, bId: string, env: Env): Promise<Response> {
	const [left, right] = await Promise.all([
		isDemo(aId) ? demoDrop() : getDrop(env.DB, aId),
		isDemo(bId) ? demoDrop() : getDrop(env.DB, bId),
	])
	if (!left || !right) return html(notFoundPage(), { status: 404, noindex: true })

	const bpmnOf = (files: FileInfo[]): FileInfo[] => files.filter((f) => f.kind === "bpmn")
	if (bpmnOf(left.files).length === 0 || bpmnOf(right.files).length === 0) {
		return html(notFoundPage(), { status: 404, noindex: true })
	}

	return html(diffPage(aId, bId, bpmnOf(left.files), bpmnOf(right.files)), { noindex: true })
}
