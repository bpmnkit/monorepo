import { createOperate } from "@bpmnkit/operate"

const PROXY_URL = "http://localhost:3033"

const container = document.getElementById("operate-container")
if (!container) throw new Error("operate-container not found")

interface ProfileInfo {
	name: string
	active: boolean
	baseUrl: string | null
}

// Probe the proxy. If it responds with at least one configured profile, go live.
// Fall back to mock on any failure (proxy not running, no profiles, etc.).
let mock = true
let profile: string | undefined

try {
	const r = await fetch(`${PROXY_URL}/profiles`, {
		signal: AbortSignal.timeout(2_000),
	})
	if (r.ok) {
		const profiles = (await r.json()) as ProfileInfo[]
		const live = profiles.find((p) => p.baseUrl !== null)
		if (live) {
			mock = false
			profile = profiles.find((p) => p.active && p.baseUrl)?.name ?? live.name
		}
	}
} catch {
	// proxy not running or unreachable — use mock data
}

createOperate({
	container,
	mock,
	theme: "auto",
	pollInterval: 15_000,
	...(mock ? {} : { proxyUrl: PROXY_URL, profile }),
})
