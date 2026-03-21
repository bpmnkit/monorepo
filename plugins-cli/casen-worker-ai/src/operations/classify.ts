import type { WorkerJob, WorkerJobResult } from "@bpmnkit/cli-sdk"
import type { AiWorkerConfig } from "../config.js"
import { RetryableError, callLlm, parseJsonResponse } from "../llm.js"

interface ClassifyResponse {
	category: string
	confidence: number
	rationale: string
}

const SYSTEM_PROMPT = `You are a text classification assistant.
The user will provide text to classify and a list of allowed categories.
Respond ONLY with valid JSON matching this exact shape:
{ "category": "<one of the allowed categories>", "confidence": <0.0–1.0>, "rationale": "<one sentence>" }
Do not include any prose outside the JSON object.`

/**
 * Classifies job.variables.input into one of job.variables.categories.
 *
 * Required job variables:
 * - input: string — the text to classify
 * - categories: string[] — allowed category names
 *
 * Optional:
 * - context: string — additional domain context for the model
 *
 * Output variables: category, confidence, rationale, aiModel, processedAt
 */
export async function classify(job: WorkerJob, config: AiWorkerConfig): Promise<WorkerJobResult> {
	const input = String(job.variables.input ?? "")
	const categories = job.variables.categories
	if (!Array.isArray(categories) || categories.length === 0) {
		return {
			outcome: "error",
			errorCode: "AI_INVALID_INPUT",
			errorMessage: 'Job variable "categories" must be a non-empty array of strings.',
		}
	}
	const context = job.variables.context ? `\nContext: ${String(job.variables.context)}` : ""
	const userMessage = `Allowed categories: ${JSON.stringify(categories)}${context}\n\nText to classify:\n${input}`

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

	let parsed: ClassifyResponse
	try {
		parsed = parseJsonResponse<ClassifyResponse>(raw)
	} catch {
		return {
			outcome: "error",
			errorCode: "AI_PARSE_ERROR",
			errorMessage: `Model returned non-JSON response: ${raw.slice(0, 200)}`,
		}
	}

	if (!categories.includes(parsed.category)) {
		return {
			outcome: "error",
			errorCode: "AI_INVALID_CATEGORY",
			errorMessage: `Model returned category "${parsed.category}" which is not in the allowed list: ${JSON.stringify(categories)}`,
		}
	}

	return {
		outcome: "complete",
		variables: {
			category: parsed.category,
			confidence: parsed.confidence,
			rationale: parsed.rationale,
			aiModel: config.model,
			processedAt: new Date().toISOString(),
		},
	}
}
