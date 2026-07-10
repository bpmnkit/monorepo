import { Bpmn, compactify } from "@bpmnkit/core"
import type { Env } from "../env.js"
import {
	type AiLike,
	addBudget,
	countFailedUnlocks,
	getBudgetSpent,
	getCachedReview,
	putCachedReview,
	recordFailedUnlock,
	runLlmReview,
} from "../lib/ai.js"
import { getFileBody } from "../lib/db.js"
import { demoFileBody, isDemo } from "../lib/demo.js"
import { clientIp, json, timingSafeEqual } from "../lib/http.js"
import { hashIp } from "../lib/ids.js"
import { type ReviewResult, deterministicSuggestions } from "../lib/review.js"

const MAX_UNLOCK_ATTEMPTS = 5

/**
 * POST /drop/api/ai-review/:shareId/:filename — closed-beta AI process review.
 *
 * Order (doc/drop-v2-spec.md §2.6): passcode gate → attempt limit → cache →
 * budget guard → model call. Feature is off (404) unless AI_PASSCODE is set.
 */
export async function handleAiReview(
	request: Request,
	shareId: string,
	filename: string,
	env: Env,
	now: number,
): Promise<Response> {
	if (env.AI_PASSCODE === undefined) return json({ error: "not found" }, { status: 404 })

	const file = isDemo(shareId)
		? await demoFileBody(filename, "original")
		: await getFileBody(env.DB, shareId, filename, "original")
	if (!file) return json({ error: "not found" }, { status: 404 })
	if (file.kind !== "bpmn") {
		return json({ error: "AI review is only available for BPMN files" }, { status: 400 })
	}

	// Passcode gate — before the cache, because closed means closed.
	const code = request.headers.get("X-Drop-AI-Code") ?? ""
	const ipHash = env.REPORT_IP_SALT
		? await hashIp(clientIp(request), env.REPORT_IP_SALT)
		: clientIp(request)
	const hour = Math.floor(now / 3_600_000)
	if (!timingSafeEqual(code, env.AI_PASSCODE)) {
		if ((await countFailedUnlocks(env.DB, ipHash, hour)) >= MAX_UNLOCK_ATTEMPTS) {
			return json({ error: "too many attempts — try again later" }, { status: 429 })
		}
		await recordFailedUnlock(env.DB, ipHash, hour)
		return json({ error: "invalid access code" }, { status: 401 })
	}

	// Deterministic pass always runs — the feature degrades to it, never breaks.
	let deterministic: ReviewResult["deterministic"]
	try {
		deterministic = deterministicSuggestions(file.body)
	} catch {
		deterministic = []
	}

	// Cache hit → no neurons spent.
	const cached = await getCachedReview(env.DB, file.hash)
	if (cached) {
		return json({
			model: cached.model,
			summary: cached.summary,
			suggestions: cached.suggestions,
			deterministic,
			cached: true,
		} satisfies ReviewResult)
	}

	// Daily neuron budget.
	const day = new Date(now).toISOString().slice(0, 10)
	const budget = Number.parseInt(env.AI_DAILY_BUDGET, 10) || 0
	if ((await getBudgetSpent(env.DB, day)) >= budget) {
		return json({
			model: null,
			summary: null,
			suggestions: [],
			deterministic,
			cached: false,
			note: "AI reviews are busy today — showing automated checks only.",
		} satisfies ReviewResult)
	}

	// Model call.
	try {
		const compactJson = JSON.stringify(compactify(Bpmn.parse(file.body)))
		const { summary, suggestions, neurons } = await runLlmReview(
			env.AI as unknown as AiLike,
			env.AI_MODEL,
			compactJson,
			deterministic,
		)
		await addBudget(env.DB, day, neurons)
		await putCachedReview(env.DB, file.hash, env.AI_MODEL, { summary, suggestions }, neurons, now)
		return json({
			model: env.AI_MODEL,
			summary,
			suggestions,
			deterministic,
			cached: false,
		} satisfies ReviewResult)
	} catch {
		return json({
			model: null,
			summary: null,
			suggestions: [],
			deterministic,
			cached: false,
			note: "AI narrative is unavailable right now — showing automated checks.",
		} satisfies ReviewResult)
	}
}
