import type { Env } from "../env.js"
import { getFileBody } from "../lib/db.js"
import { demoFileBody, isDemo } from "../lib/demo.js"
import { json } from "../lib/http.js"
import { type ReviewResult, deterministicSuggestions } from "../lib/review.js"

/**
 * POST /drop/api/ai-review/:shareId/:filename — process review.
 *
 * Phase 3: runs the deterministic pass (`@bpmnkit/core` optimizer) only.
 * Phase 4 wraps this with the passcode gate, the Workers AI narrative, and
 * content-hash caching.
 */
export async function handleAiReview(
	shareId: string,
	filename: string,
	env: Env,
): Promise<Response> {
	const file = isDemo(shareId)
		? await demoFileBody(filename, "original")
		: await getFileBody(env.DB, shareId, filename, "original")
	if (!file) return json({ error: "not found" }, { status: 404 })
	if (file.kind !== "bpmn") {
		return json({ error: "AI review is only available for BPMN files" }, { status: 400 })
	}

	let deterministic: ReviewResult["deterministic"]
	try {
		deterministic = deterministicSuggestions(file.body)
	} catch {
		deterministic = []
	}

	const result: ReviewResult = {
		model: null,
		summary: null,
		suggestions: [],
		deterministic,
		cached: false,
	}
	return json(result)
}
