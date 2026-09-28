import { MOCK_INCIDENTS } from "../mock-data.js"
import { createMockStream, createStream } from "../stream.js"
import type { IncidentResult } from "../types.js"
import { Store } from "./base.js"

export interface IncidentsPayload {
	items: IncidentResult[]
	total: number
}

export class IncidentsStore extends Store<IncidentsPayload> {
	connect(
		proxyUrl: string,
		profile: string | null,
		interval: number,
		mock: boolean,
		processInstanceKey?: string,
	): void {
		this.set({ loading: true, error: null })

		if (mock) {
			const getFiltered = () => {
				const items = processInstanceKey
					? MOCK_INCIDENTS.filter((i) => i.processInstanceKey === processInstanceKey)
					: MOCK_INCIDENTS
				return { items, total: items.length }
			}
			this.setUnsub(
				createMockStream(
					getFiltered,
					(payload) => this.set({ data: payload, loading: false, error: null }),
					interval,
				),
			)
			return
		}

		const params = new URLSearchParams({ topic: "incidents" })
		if (profile) params.set("profile", profile)
		params.set("interval", String(interval))
		if (processInstanceKey) params.set("processInstanceKey", processInstanceKey)
		this.setUnsub(
			createStream<IncidentsPayload>(
				`${proxyUrl}/operate/stream?${params}`,
				(payload) => this.set({ data: payload, loading: false, error: null }),
				(msg) => this.set({ error: msg, loading: false }),
			),
		)
	}
}
