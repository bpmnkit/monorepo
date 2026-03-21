export interface AiWorkerConfig {
	apiKey: string
	model: string
	maxTokens: number
	timeoutMs: number
}

/**
 * Resolves config from environment variables.
 * Throws immediately if ANTHROPIC_API_KEY is absent so the error surfaces at
 * worker startup rather than mid-job.
 */
export function resolveConfig(): AiWorkerConfig {
	const apiKey = process.env.ANTHROPIC_API_KEY
	if (!apiKey) {
		throw new Error(
			"ANTHROPIC_API_KEY is not set. Export it before starting the AI worker:\n" +
				"  export ANTHROPIC_API_KEY=sk-ant-...",
		)
	}
	return {
		apiKey,
		model: process.env.AI_MODEL ?? "claude-3-5-haiku-20241022",
		maxTokens: Number(process.env.AI_MAX_TOKENS ?? "1024"),
		timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? "60000"),
	}
}
