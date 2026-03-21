import type { WorkerJob, WorkerJobResult } from "@bpmnkit/cli-sdk"
import type { AiWorkerConfig } from "../config.js"
import { RetryableError, callLlm, parseJsonResponse } from "../llm.js"

interface SummarizeResponse {
	summary: string
	wordCount: number
}

const SYSTEM_PROMPT = `You are a text summarization assistant.
The user will provide text to summarize along with a target length and style.
Respond ONLY with valid JSON matching this exact shape:
{ "summary": "<the summary text>", "wordCount": <integer> }
Do not include any prose outside the JSON object.`

/**
 * Summarizes job.variables.input.
 *
 * Required job variables:
 * - input: string — the text to summarize
 *
 * Optional:
 * - maxWords: number — target word count (default: 100)
 * - style: "bullet" | "paragraph" — output style (default: "paragraph")
 *
 * Output variables: summary, wordCount, aiModel, processedAt
 */
export async function summarize(job: WorkerJob, config: AiWorkerConfig): Promise<WorkerJobResult> {
	const input = String(job.variables.input ?? "")
	const maxWords = Number(job.variables.maxWords ?? 100)
	const style = String(job.variables.style ?? "paragraph")
	const userMessage = `Summarize the following text in ${style} style, targeting ${maxWords} words:\n\n${input}`

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

	let parsed: SummarizeResponse
	try {
		parsed = parseJsonResponse<SummarizeResponse>(raw)
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
			summary: parsed.summary,
			wordCount: parsed.wordCount,
			aiModel: config.model,
			processedAt: new Date().toISOString(),
		},
	}
}
