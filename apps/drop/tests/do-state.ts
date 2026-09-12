/**
 * A `DurableObjectState` stand-in, so the edit baton's decisions can be driven
 * on a controlled clock.
 *
 * The baton's interesting paths are all timing: a holder warned a minute before
 * losing it, one reclaimed after ten minutes of nothing, one whose socket went
 * quiet without ever sending a close. Waiting those out against a live Worker
 * would make the suite take a quarter of an hour, so the room is instantiated
 * directly against this instead.
 *
 * Only the slice `DocRoom` uses is implemented. `fetch()` needs `WebSocketPair`,
 * which does not exist outside workerd, so tests accept sockets the way `fetch`
 * would and drive the handlers from there — the live Worker covers the upgrade.
 */

/** A WebSocket that records what the room said to it. */
export class FakeSocket {
	readonly sent: string[] = []
	private attachment: unknown = null

	send(message: string): void {
		this.sent.push(message)
	}

	serializeAttachment(value: unknown): void {
		this.attachment = value
	}

	deserializeAttachment(): unknown {
		return this.attachment
	}

	/** Everything the room sent, parsed. */
	messages<T = Record<string, unknown>>(): T[] {
		return this.sent.map((s) => JSON.parse(s) as T)
	}

	/** The last message of a given type, or undefined. */
	last<T = Record<string, unknown>>(type: string): T | undefined {
		const found = [...this.messages<{ type: string }>()].reverse().find((m) => m.type === type)
		return found as T | undefined
	}

	/** How many messages of a type were sent — a warning must not repeat. */
	count(type: string): number {
		return this.messages<{ type: string }>().filter((m) => m.type === type).length
	}
}

class FakeStorage {
	private readonly map = new Map<string, unknown>()
	private alarmAt: number | null = null

	async get<T>(key: string): Promise<T | undefined> {
		return this.map.get(key) as T | undefined
	}

	async put(keyOrEntries: string | Record<string, unknown>, value?: unknown): Promise<void> {
		if (typeof keyOrEntries === "string") {
			this.map.set(keyOrEntries, value)
			return
		}
		for (const [k, v] of Object.entries(keyOrEntries)) this.map.set(k, v)
	}

	async delete(key: string | string[]): Promise<void> {
		for (const k of Array.isArray(key) ? key : [key]) this.map.delete(k)
	}

	async getAlarm(): Promise<number | null> {
		return this.alarmAt
	}

	async setAlarm(at: number): Promise<void> {
		this.alarmAt = at
	}

	async deleteAlarm(): Promise<void> {
		this.alarmAt = null
	}
}

export class FakeState {
	readonly storage = new FakeStorage()
	private readonly tags = new Map<FakeSocket, string[]>()
	private readonly pings = new Map<FakeSocket, Date>()

	acceptWebSocket(ws: FakeSocket, tags: string[] = []): void {
		this.tags.set(ws, tags)
	}

	getWebSockets(tag?: string): FakeSocket[] {
		const all = [...this.tags.keys()]
		return tag === undefined ? all : all.filter((ws) => this.tags.get(ws)?.includes(tag))
	}

	getTags(ws: FakeSocket): string[] {
		return this.tags.get(ws) ?? []
	}

	getWebSocketAutoResponseTimestamp(ws: FakeSocket): Date | null {
		return this.pings.get(ws) ?? null
	}

	setWebSocketAutoResponse(): void {
		// The runtime answers these; nothing to do in a fake.
	}

	// ── Test controls ─────────────────────────────────────────────────────────

	/** Accepts a socket the way `DocRoom.fetch` does, and returns it. */
	join(actor: string): FakeSocket {
		const ws = new FakeSocket()
		this.acceptWebSocket(ws, [actor])
		ws.serializeAttachment({ actor })
		return ws
	}

	/** Records a heartbeat, as the runtime's auto-response would. */
	ping(ws: FakeSocket, at: number): void {
		this.pings.set(ws, new Date(at))
	}

	/** Removes a socket without a close event — a laptop lid, not a tab close. */
	vanish(ws: FakeSocket): void {
		this.tags.delete(ws)
		this.pings.delete(ws)
	}

	get alarm(): Promise<number | null> {
		return this.storage.getAlarm()
	}
}

/** `WebSocketRequestResponsePair` is a workerd global; the room constructs one. */
export function stubWebSocketGlobals(): void {
	;(globalThis as { WebSocketRequestResponsePair?: unknown }).WebSocketRequestResponsePair ??=
		class {
			constructor(
				readonly request: string,
				readonly response: string,
			) {}
		}
}
