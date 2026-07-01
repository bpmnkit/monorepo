export interface Recording {
	name: string
	recordedAt: string
	scenarioPrompt: string
	panels: {
		"with-sdk": RecordedPanel
		"without-sdk": RecordedPanel
	}
}

export interface RecordedPanel {
	systemPrompt: string
	chunks: { t: number; text: string }[]
	durationMs: number
	result: { type: "bpmn"; xml: string } | { type: "error"; message: string }
}
