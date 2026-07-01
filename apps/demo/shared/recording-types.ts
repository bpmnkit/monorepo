export interface Recording {
	name: string
	recordedAt: string
	scenarioId?: string
	scenarioPrompt: string
	panels: {
		"with-sdk": RecordedPanel
		"without-sdk": RecordedPanel
	}
}

export interface TokenUsage {
	inputTokens: number
	outputTokens: number
}

export interface RecordedPanel {
	systemPrompt: string
	chunks: { t: number; text: string }[]
	durationMs: number
	usage?: TokenUsage | null
	result: { type: "bpmn"; xml: string } | { type: "error"; message: string }
}
