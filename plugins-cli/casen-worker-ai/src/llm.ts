import Anthropic from "@anthropic-ai/sdk"
import type { AiWorkerConfig } from "./config.js"

export class RetryableError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "RetryableError"
	}
}

/**
 * Calls the Anthropic messages API and returns the text content.
 *
 * Throws {@link RetryableError} for transient failures (rate limits, timeouts,
 * 5xx errors) so callers can return `{ outcome: "fail" }` and let Camunda retry.
 * Throws a plain Error for hard failures (auth, invalid request).
 */
export async function callLlm(
	systemPrompt: string,
	userMessage: string,
	config: AiWorkerConfig,
): Promise<string> {
	const client = new Anthropic({
		apiKey: config.apiKey,
		timeout: config.timeoutMs,
		maxRetries: 0, // we let Camunda handle retries via failJob
	})

	let message: Anthropic.Message
	try {
		message = await client.messages.create({
			model: config.model,
			max_tokens: config.maxTokens,
			system: systemPrompt,
			messages: [{ role: "user", content: userMessage }],
		})
	} catch (err) {
		if (
			err instanceof Anthropic.RateLimitError ||
			err instanceof Anthropic.APIConnectionTimeoutError
		) {
			throw new RetryableError(err.message)
		}
		if (err instanceof Anthropic.InternalServerError) {
			throw new RetryableError(err.message)
		}
		throw err
	}

	const block = message.content[0]
	if (!block || block.type !== "text") {
		throw new Error("Unexpected response shape from Anthropic API")
	}
	return block.text
}

/**
 * Parses an LLM response as JSON. Handles responses wrapped in a markdown
 * code fence (```json ... ```) which models sometimes emit.
 */
export function parseJsonResponse<T>(text: string): T {
	const stripped = text
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```\s*$/, "")
		.trim()
	return JSON.parse(stripped) as T
}
