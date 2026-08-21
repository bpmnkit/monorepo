import type { Env } from "../env.js"
import { deleteDrop, getDrop, listReports, setReportStatus } from "../lib/db.js"
import { json, timingSafeEqual } from "../lib/http.js"

function authorized(request: Request, env: Env): boolean {
	const token = env.DROP_ADMIN_TOKEN
	if (!token) return false
	const header = request.headers.get("authorization") ?? ""
	const prefix = "Bearer "
	if (!header.startsWith(prefix)) return false
	return timingSafeEqual(header.slice(prefix.length), token)
}

/**
 * Admin API under `/drop/api/admin`. `subpath` is the portion after that prefix
 * (e.g. "/reports", "/reports/5", "/drops/aB3..").
 */
export async function handleAdmin(
	request: Request,
	subpath: string,
	env: Env,
	now: number,
): Promise<Response> {
	if (!authorized(request, env)) return json({ error: "unauthorized" }, { status: 401 })

	const url = new URL(request.url)

	if (subpath === "/reports" && request.method === "GET") {
		const status = url.searchParams.get("status") ?? "open"
		return json({ reports: await listReports(env.DB, status) })
	}

	const reportMatch = subpath.match(/^\/reports\/(\d+)$/)
	if (reportMatch && request.method === "PATCH") {
		const body = (await request.json().catch(() => null)) as { status?: unknown } | null
		if (body?.status !== "resolved" && body?.status !== "dismissed") {
			return json({ error: "status must be 'resolved' or 'dismissed'" }, { status: 400 })
		}
		const ok = await setReportStatus(env.DB, Number(reportMatch[1]), body.status)
		return ok ? json({ ok: true }) : json({ error: "not found" }, { status: 404 })
	}

	const dropMatch = subpath.match(/^\/drops\/([\w-]+)$/)
	if (dropMatch) {
		const shareId = dropMatch[1] as string
		if (request.method === "GET") {
			const found = await getDrop(env.DB, shareId)
			return found ? json(found) : json({ error: "not found" }, { status: 404 })
		}
		if (request.method === "DELETE") {
			const ban = url.searchParams.get("ban") === "1"
			const ok = await deleteDrop(env.DB, shareId, { ban, now })
			return ok ? json({ ok: true, banned: ban }) : json({ error: "not found" }, { status: 404 })
		}
	}

	return json({ error: "not found" }, { status: 404 })
}
