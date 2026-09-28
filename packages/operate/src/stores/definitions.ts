import { MOCK_DEFINITIONS } from "../mock-data.js"
import { createMockStream, createStream } from "../stream.js"
import type { ProcessDefinitionResult } from "../types.js"
import { Store } from "./base.js"

export interface DefinitionsPayload {
	items: ProcessDefinitionResult[]
}

/**
 * @internal Exported for BPMN Kit Studio, which embeds the detail views. Not a
 * stable API: it may change in any release. Use `createOperate()` instead.
 */
export class DefinitionsStore extends Store<DefinitionsPayload> {
	connect(proxyUrl: string, profile: string | null, interval: number, mock: boolean): void {
		this.set({ loading: true, error: null })

		if (mock) {
			this.setUnsub(
				createMockStream(
					() => ({ items: MOCK_DEFINITIONS }),
					(payload) => this.set({ data: payload, loading: false, error: null }),
					interval,
				),
			)
			return
		}

		const params = new URLSearchParams({ topic: "definitions" })
		if (profile) params.set("profile", profile)
		params.set("interval", String(interval))
		this.setUnsub(
			createStream<DefinitionsPayload>(
				`${proxyUrl}/operate/stream?${params}`,
				(payload) => this.set({ data: payload, loading: false, error: null }),
				(msg) => this.set({ error: msg, loading: false }),
			),
		)
	}
}
