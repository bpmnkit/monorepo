import type { Env } from "./env.js"

/**
 * One instance per shareId. Tracks how many viewers currently have the share
 * page open and broadcasts the count. Uses the WebSocket Hibernation API so idle
 * viewers cost nothing — the instance is evicted from memory between events while
 * sockets stay connected.
 */
export class PresenceRoom implements DurableObject {
	constructor(private readonly state: DurableObjectState) {}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("expected a WebSocket upgrade", { status: 426 })
		}
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

// Referenced so the class satisfies the DO constructor `(state, env)` shape.
export type PresenceEnv = Env
