import { MOCK_JOBS } from "../mock-data.js"
import { createMockStream, createStream } from "../stream.js"
import type { JobSearchResult } from "../types.js"
import { Store } from "./base.js"

export interface JobsPayload {
	items: JobSearchResult[]
	total: number
}

export class JobsStore extends Store<JobsPayload> {
	connect(proxyUrl: string, profile: string | null, interval: number, mock: boolean): void {
		this.set({ loading: true, error: null })

		if (mock) {
			this.setUnsub(
				createMockStream(
					() => ({ items: MOCK_JOBS, total: MOCK_JOBS.length }),
					(payload) => this.set({ data: payload, loading: false, error: null }),
					interval,
				),
			)
			return
		}

		const params = new URLSearchParams({ topic: "jobs" })
		if (profile) params.set("profile", profile)
		params.set("interval", String(interval))
		this.setUnsub(
			createStream<JobsPayload>(
				`${proxyUrl}/operate/stream?${params}`,
				(payload) => this.set({ data: payload, loading: false, error: null }),
				(msg) => this.set({ error: msg, loading: false }),
			),
		)
	}
}
