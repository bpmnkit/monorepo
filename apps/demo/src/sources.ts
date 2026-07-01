import type { RecordedPanel, TokenUsage } from "../shared/recording-types.js"

export interface PanelSourceHandlers {
	onChunk: (text: string) => void
	onDone: () => void
	onBpmn: (xml: string, usage: TokenUsage | null) => void
	onError: (message: string, usage: TokenUsage | null) => void
}

export interface PanelSource {
	subscribe(handlers: PanelSourceHandlers): () => void
}

export type PanelRunResult = Omit<RecordedPanel, "systemPrompt">

export class LiveSource implements PanelSource {
	constructor(private readonly url: string) {}

	subscribe(handlers: PanelSourceHandlers): () => void {
		const es = new EventSource(this.url)

		es.addEventListener("chunk", (e) => {
			const { text } = JSON.parse((e as MessageEvent).data) as { text: string }
			handlers.onChunk(text)
		})

		es.addEventListener("done", () => {
			handlers.onDone()
		})

		es.addEventListener("bpmn", (e) => {
			const { xml, usage } = JSON.parse((e as MessageEvent).data) as {
				xml: string
				usage: TokenUsage | null
			}
			handlers.onBpmn(xml, usage)
		})

		es.addEventListener("error", (e) => {
			if (e instanceof MessageEvent && e.data) {
				const { message, usage } = JSON.parse(e.data) as {
					message: string
					usage: TokenUsage | null
				}
				handlers.onError(message, usage)
			}
			es.close()
		})

		return () => es.close()
	}
}

export class ReplaySource implements PanelSource {
	constructor(private readonly panel: RecordedPanel) {}

	subscribe(handlers: PanelSourceHandlers): () => void {
		const timers: ReturnType<typeof setTimeout>[] = []

		for (const chunk of this.panel.chunks) {
			timers.push(setTimeout(() => handlers.onChunk(chunk.text), chunk.t))
		}

		const lastChunkT = this.panel.chunks.at(-1)?.t ?? 0
		timers.push(setTimeout(() => handlers.onDone(), lastChunkT))

		timers.push(
			setTimeout(() => {
				const usage = this.panel.usage ?? null
				if (this.panel.result.type === "bpmn") {
					handlers.onBpmn(this.panel.result.xml, usage)
				} else {
					handlers.onError(this.panel.result.message, usage)
				}
			}, this.panel.durationMs),
		)

		return () => {
			for (const t of timers) clearTimeout(t)
		}
	}
}
