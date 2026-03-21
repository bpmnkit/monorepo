import type { WorkerJob, WorkerJobResult } from "@bpmnkit/cli-sdk"
import type { AiWorkerConfig } from "../config.js"
import { RetryableError, callLlm, parseJsonResponse } from "../llm.js"

interface DecideResponse {
	decision: boolean
	rationale: string
	confidence: number
}

const SYSTEM_PROMPT = `You are a decision-making assistant.
The user will provide a yes/no question, relevant context, and optionally a policy to apply.
Respond ONLY with valid JSON matching this exact shape:
{ "decision": <true|false>, "rationale": "<one or two sentences>", "confidence": <0.0–1.0> }
Apply the policy strictly if provided. Do not include any prose outside the JSON object.`

/**
 * Makes a boolean decision for job.variables.question based on context and an optional policy.
 *
 * Required job variables:
 * - question: string — the yes/no question to answer
 * - context: string — relevant facts for the decision
 *
 * Optional:
 * - policy: string — natural language policy text the model must apply
 *
 * Output variables: decision (boolean), rationale, confidence, aiModel, processedAt
 */
export async function decide(job: WorkerJob, config: AiWorkerConfig): Promise<WorkerJobResult> {
	const question = String(job.variables.question ?? "")
	const context = String(job.variables.context ?? "")
	const policy = job.variables.policy ? `\nPolicy to apply:\n${String(job.variables.policy)}` : ""
	const userMessage = `Question: ${question}\n\nContext:\n${context}${policy}`

	let raw: string
	try {
		raw = await callLlm(SYSTEM_PROMPT, userMessage, config)
	} catch (err) {
		if (err instanceof RetryableError) {
			return { outcome: "fail", errorMessage: err.message, retries: 2, retryBackOff: 30_000 }
		}
		return {
			outcome: "error",
			errorCode: "AI_API_ERROR",
			errorMessage: err instanceof Error ? err.message : String(err),
		}
	}

	let parsed: DecideResponse
	try {
		parsed = parseJsonResponse<DecideResponse>(raw)
	} catch {
		return {
			outcome: "error",
			errorCode: "AI_PARSE_ERROR",
			errorMessage: `Model returned non-JSON response: ${raw.slice(0, 200)}`,
		}
	}

	return {
		outcome: "complete",
		variables: {
			decision: parsed.decision,
			rationale: parsed.rationale,
			confidence: parsed.confidence,
			aiModel: config.model,
			processedAt: new Date().toISOString(),
		},
	}
}
