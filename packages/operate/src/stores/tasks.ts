import { MOCK_TASKS } from "../mock-data.js"
import { createMockStream, createStream } from "../stream.js"
import type { UserTaskResult } from "../types.js"
import { Store } from "./base.js"

export interface TasksPayload {
	items: UserTaskResult[]
	total: number
}

export class TasksStore extends Store<TasksPayload> {
	connect(proxyUrl: string, profile: string | null, interval: number, mock: boolean): void {
		this.set({ loading: true, error: null })

		if (mock) {
			this.setUnsub(
				createMockStream(
					() => ({ items: MOCK_TASKS, total: MOCK_TASKS.length }),
					(payload) => this.set({ data: payload, loading: false, error: null }),
					interval,
				),
			)
			return
		}

		const params = new URLSearchParams({ topic: "tasks" })
		if (profile) params.set("profile", profile)
		params.set("interval", String(interval))
		this.setUnsub(
			createStream<TasksPayload>(
				`${proxyUrl}/operate/stream?${params}`,
				(payload) => this.set({ data: payload, loading: false, error: null }),
				(msg) => this.set({ error: msg, loading: false }),
			),
		)
	}
}
