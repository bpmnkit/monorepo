import type { RecordedPanel, TokenUsage } from "../shared/recording-types.js"

export interface PanelSourceHandlers {
	onChunk: (text: string) => void
	onTick: (elapsedMs: number) => void
	onDone: () => void
	onBpmn: (xml: string, usage: TokenUsage | null) => void
	onError: (message: string, usage: TokenUsage | null) => void
}

export interface PanelSource {
	subscribe(handlers: PanelSourceHandlers): () => void
	setSpeed?(multiplier: number): void
}

export type PanelRunResult = Omit<RecordedPanel, "systemPrompt">

export class LiveSource implements PanelSource {
	constructor(private readonly url: string) {}

	subscribe(handlers: PanelSourceHandlers): () => void {
		const es = new EventSource(this.url)
		const startedAt = Date.now()
		const tickInterval = setInterval(() => {
			handlers.onTick(Date.now() - startedAt)
		}, 100)

		es.addEventListener("chunk", (e) => {
			const { text } = JSON.parse((e as MessageEvent).data) as { text: string }
			handlers.onChunk(text)
		})

		es.addEventListener("done", () => {
			handlers.onDone()
		})

		es.addEventListener("bpmn", (e) => {
			clearInterval(tickInterval)
			handlers.onTick(Date.now() - startedAt)
			const { xml, usage } = JSON.parse((e as MessageEvent).data) as {
				xml: string
				usage: TokenUsage | null
			}
			handlers.onBpmn(xml, usage)
		})

		es.addEventListener("error", (e) => {
			clearInterval(tickInterval)
			handlers.onTick(Date.now() - startedAt)
			if (e instanceof MessageEvent && e.data) {
				const { message, usage } = JSON.parse(e.data) as {
					message: string
					usage: TokenUsage | null
				}
				handlers.onError(message, usage)
			}
			es.close()
		})

		return () => {
			clearInterval(tickInterval)
			es.close()
		}
	}
}

const TICK_MS = 100

interface ScheduledEvent {
	t: number
	fire: () => void
}

export class ReplaySource implements PanelSource {
	private speed = 1

	constructor(private readonly panel: RecordedPanel) {}

	setSpeed(multiplier: number): void {
		this.speed = multiplier
	}

	subscribe(handlers: PanelSourceHandlers): () => void {
		const events: ScheduledEvent[] = this.panel.chunks.map((c) => ({
			t: c.t,
			fire: () => handlers.onChunk(c.text),
		}))

		const lastChunkT = this.panel.chunks.at(-1)?.t ?? 0
		events.push({ t: lastChunkT, fire: () => handlers.onDone() })

		const totalT = this.panel.durationMs
		events.push({
			t: totalT,
			fire: () => {
				const usage = this.panel.usage ?? null
				if (this.panel.result.type === "bpmn") {
					handlers.onBpmn(this.panel.result.xml, usage)
				} else {
					handlers.onError(this.panel.result.message, usage)
				}
			},
		})

		events.sort((a, b) => a.t - b.t)

		let virtualElapsedMs = 0
		let nextEventIndex = 0
		let lastRealTime: number | null = null
		let timer: ReturnType<typeof setTimeout> | null = null
		let stopped = false

		const fireDueEvents = () => {
			while (nextEventIndex < events.length && events[nextEventIndex].t <= virtualElapsedMs) {
				events[nextEventIndex].fire()
				nextEventIndex++
			}
		}

		const tick = () => {
			if (stopped) return
			const now = Date.now()
			const realDelta = lastRealTime === null ? 0 : now - lastRealTime
			lastRealTime = now
			virtualElapsedMs = Math.min(virtualElapsedMs + realDelta * this.speed, totalT)
			handlers.onTick(virtualElapsedMs)
			fireDueEvents()
			if (nextEventIndex < events.length) {
				timer = setTimeout(tick, TICK_MS)
			} else {
				stopped = true
			}
		}

		timer = setTimeout(tick, 0)

		return () => {
			stopped = true
			if (timer !== null) clearTimeout(timer)
		}
	}
}
