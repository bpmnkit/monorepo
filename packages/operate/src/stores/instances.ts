import { MOCK_INSTANCES } from "../mock-data.js"
import { createMockStream, createStream } from "../stream.js"
import type { ProcessInstanceResult } from "../types.js"
import { Store } from "./base.js"

export interface InstancesPayload {
	items: ProcessInstanceResult[]
	total: number
}

export interface InstancesFilter {
	state?: string
	processDefinitionKey?: string
	page?: number
}

/**
 * @internal Exported for BPMN Kit Studio, which embeds the detail views. Not a
 * stable API: it may change in any release. Use `createOperate()` instead.
 */
export class InstancesStore extends Store<InstancesPayload> {
	connect(
		proxyUrl: string,
		profile: string | null,
		interval: number,
		mock: boolean,
		filter: InstancesFilter = {},
	): void {
		this.set({ loading: true, error: null })

		if (mock) {
			const getFiltered = () => {
				let items = MOCK_INSTANCES
				if (filter.state) items = items.filter((i) => i.state === filter.state)
				if (filter.processDefinitionKey)
					items = items.filter((i) => i.processDefinitionKey === filter.processDefinitionKey)
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

		const params = new URLSearchParams({ topic: "instances" })
		if (profile) params.set("profile", profile)
		params.set("interval", String(interval))
		if (filter.state) params.set("state", filter.state)
		if (filter.processDefinitionKey) params.set("processDefinitionKey", filter.processDefinitionKey)
		if (filter.page) params.set("page", String(filter.page))
		this.setUnsub(
			createStream<InstancesPayload>(
				`${proxyUrl}/operate/stream?${params}`,
				(payload) => this.set({ data: payload, loading: false, error: null }),
				(msg) => this.set({ error: msg, loading: false }),
			),
		)
	}
}
