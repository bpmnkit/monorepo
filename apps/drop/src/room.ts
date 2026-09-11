import type { Env } from "./env.js"
import { recordViews } from "./lib/db.js"
import { RETENTION_MS, VIEW_FLUSH_MS } from "./shared/constants.js"

/**
 * One instance per shareId: the room a drop's viewers share.
 *
 * Today it does two things. It keeps the live head-count, using the WebSocket
 * Hibernation API so idle viewers cost nothing — the instance is evicted from
 * memory between events while the sockets stay connected. And it owns view
 * counting, which used to be a D1 write on *every* page load.
 *
 * Counting here is what `doc/drop-spec.md` §6 described and never built, and it
 * costs no extra requests: the viewer already opens this socket, so a join is a
 * view the room can see without anyone asking it. Views accumulate in the
 * object's own storage and reach D1 on an alarm, so fifty people opening a drop
 * in the same minute is one write rather than fifty.
 *
 * The trade is that a "view" now means a browser that connected, not every HTTP
 * request for the page. That excludes bots and JS-less fetches — which is a more
 * honest count, and the share page renders client-side anyway, so a request that
 * never runs the script never saw the diagram.
 */
export class DocRoom implements DurableObject {
	constructor(
		private readonly state: DurableObjectState,
		private readonly env: Env,
	) {}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("expected a WebSocket upgrade", { status: 426 })
		}

		// The object knows its id, not the name it was derived from, so the first
		// connection tells it which drop it belongs to.
		const shareId = new URL(request.url).pathname.split("/").pop() ?? ""
		await this.noteView(shareId)

		const pair = new WebSocketPair()
		const client = pair[0]
		const server = pair[1]
		this.state.acceptWebSocket(server)
		this.broadcast()
		return new Response(null, { status: 101, webSocket: client })
	}

	// Presence is read-only; inbound messages are ignored.
	async webSocketMessage(): Promise<void> {}

	async webSocketClose(ws: WebSocket): Promise<void> {
		this.broadcast(ws)
	}

	async webSocketError(ws: WebSocket): Promise<void> {
		this.broadcast(ws)
	}

	/** Flushes the pending views to D1. Also what wakes the object from hibernation. */
	async alarm(): Promise<void> {
		const pending = (await this.state.storage.get<number>("pendingViews")) ?? 0
		const shareId = await this.state.storage.get<string>("shareId")
		if (pending === 0 || !shareId) return

		// Zero the counter first: a failed write costs a few counted views, while a
		// failed reset would count them again on the next alarm.
		await this.state.storage.put("pendingViews", 0)
		const now = Date.now()
		await recordViews(this.env.DB, shareId, pending, now, now + RETENTION_MS)
	}

	private async noteView(shareId: string): Promise<void> {
		const pending = (await this.state.storage.get<number>("pendingViews")) ?? 0
		await this.state.storage.put({ pendingViews: pending + 1, shareId })
		// One alarm per window, not one per view — the whole point of batching.
		if ((await this.state.storage.getAlarm()) === null) {
			await this.state.storage.setAlarm(Date.now() + VIEW_FLUSH_MS)
		}
	}

	private broadcast(excluding?: WebSocket): void {
		const sockets = this.state.getWebSockets().filter((ws) => ws !== excluding)
		const payload = JSON.stringify({ viewers: sockets.length })
		for (const ws of sockets) {
			try {
				ws.send(payload)
			} catch {
				// socket already gone — ignore
			}
		}
	}
}
