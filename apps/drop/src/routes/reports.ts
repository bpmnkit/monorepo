import type { Env } from "../env.js"
import { getDrop, insertReport } from "../lib/db.js"
import { clientIp, json } from "../lib/http.js"
import { hashIp } from "../lib/ids.js"
import { REPORT_REASONS, type ReportReason } from "../shared/constants.js"

/** POST /drop/api/reports — record an abuse report against a drop. */
export async function handleReport(request: Request, env: Env, now: number): Promise<Response> {
	const body = (await request.json().catch(() => null)) as {
		shareId?: unknown
		reason?: unknown
		details?: unknown
	} | null
	if (!body || typeof body.shareId !== "string") {
		return json({ error: "shareId is required" }, { status: 400 })
	}
	if (typeof body.reason !== "string" || !REPORT_REASONS.includes(body.reason as ReportReason)) {
		return json({ error: "invalid reason" }, { status: 400 })
	}
	const details =
		typeof body.details === "string" && body.details.trim().length > 0
			? body.details.trim().slice(0, 2000)
			: null

	// Don't let reports be used to probe for valid share ids.
	const found = await getDrop(env.DB, body.shareId)
	if (!found) return json({ ok: true }, { status: 201 })

	const reporterHash = env.REPORT_IP_SALT
		? await hashIp(clientIp(request), env.REPORT_IP_SALT)
		: null

	await insertReport(env.DB, {
		shareId: body.shareId,
		reason: body.reason as ReportReason,
		details,
		reporterHash,
		now,
	})
	return json({ ok: true }, { status: 201 })
}
