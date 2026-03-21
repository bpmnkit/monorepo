import type { WorkerJob, WorkerJobResult } from "@bpmnkit/cli-sdk"
import type { AiWorkerConfig } from "../config.js"
import { RetryableError, callLlm, parseJsonResponse } from "../llm.js"

interface ExtractResponse {
	extracted: Record<string, unknown>
	missingFields: string[]
}

const SYSTEM_PROMPT = `You are a structured data extraction assistant.
The user will provide unstructured text and a list of fields to extract.
Respond ONLY with valid JSON matching this exact shape:
{ "extracted": { "<field>": <value or null>, ... }, "missingFields": ["<fields not found>"] }
Use null for fields you cannot confidently determine. List those field names in missingFields.
Do not include any prose outside the JSON object.`

/**
 * Extracts structured fields from job.variables.input.
 *
 * Required job variables:
 * - input: string — the unstructured text
 * - fields: string[] — field names to extract
 *
 * Optional:
 * - schema: Record<string, string> — type hints per field, e.g. { amount: "number", date: "ISO 8601 string" }
 *
 * Output variables: extracted (object), missingFields (array), aiModel, processedAt
 */
export async function extract(job: WorkerJob, config: AiWorkerConfig): Promise<WorkerJobResult> {
	const input = String(job.variables.input ?? "")
	const fields = job.variables.fields
	if (!Array.isArray(fields) || fields.length === 0) {
		return {
			outcome: "error",
			errorCode: "AI_INVALID_INPUT",
			errorMessage: 'Job variable "fields" must be a non-empty array of field name strings.',
		}
	}
	const schema = job.variables.schema
	const schemaHint =
		schema && typeof schema === "object" && !Array.isArray(schema)
			? `\nType hints: ${JSON.stringify(schema)}`
			: ""
	const userMessage = `Fields to extract: ${JSON.stringify(fields)}${schemaHint}\n\nText:\n${input}`

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

	let parsed: ExtractResponse
	try {
		parsed = parseJsonResponse<ExtractResponse>(raw)
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
			extracted: parsed.extracted,
			missingFields: parsed.missingFields ?? [],
			aiModel: config.model,
			processedAt: new Date().toISOString(),
		},
	}
}
