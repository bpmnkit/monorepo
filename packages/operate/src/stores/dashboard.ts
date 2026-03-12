import { getMockDashboard } from "../mock-data.js"
import { createMockStream, createStream } from "../stream.js"
import type { DashboardData } from "../types.js"
import { Store } from "./base.js"

export class DashboardStore extends Store<DashboardData> {
	connect(proxyUrl: string, profile: string | null, interval: number, mock: boolean): void {
		this.set({ loading: true, error: null })

		if (mock) {
			this.setUnsub(
				createMockStream(
					getMockDashboard,
					(payload) => this.set({ data: payload, loading: false }),
					interval,
				),
			)
			return
		}

		const params = new URLSearchParams({ topic: "dashboard" })
		if (profile) params.set("profile", profile)
		if (interval > 0) params.set("interval", String(interval))
		this.setUnsub(
			createStream<DashboardData>(
				`${proxyUrl}/operate/stream?${params}`,
				(payload) => this.set({ data: payload, loading: false }),
				(msg) => this.set({ error: msg, loading: false }),
			),
		)
	}
}
