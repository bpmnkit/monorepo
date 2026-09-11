/**
 * The messages a drop's room and its viewers exchange.
 *
 * Shared by the Durable Object and the browser bundle so the two cannot drift.
 * No DOM and no Worker APIs — types and constants only.
 *
 * The room holds an **edit baton**: at most one participant may write at a time.
 * That is the whole concurrency story, and it is why there is no operational
 * transform anywhere in this codebase — with one writer there is nothing to
 * merge. See `doc/drop-live-editing-design.md` §3.2.
 */

/** Sent by a viewer. */
export type ClientMessage = { type: "claim" } | { type: "release" }

/** Sent by the room. */
export type ServerMessage =
	/** First message on every connection: who you are, and what the room looks like. */
	| { type: "hello"; actor: string; viewers: number; holder: string | null }
	/** Someone joined or left, or the baton moved. */
	| { type: "presence"; viewers: number; holder: string | null }
	/** You hold the baton. `idleMs` is how long you may sit still before losing it. */
	| { type: "granted"; holder: string; idleMs: number }
	/** Someone else holds it. */
	| { type: "denied"; holder: string }
	/** You are about to lose the baton for being idle. Any action keeps it. */
	| { type: "warning"; secondsLeft: number }
	/** You no longer hold the baton. */
	| { type: "revoked"; reason: RevokeReason }

/** Why a holder stopped holding. */
export type RevokeReason = "released" | "idle" | "disconnected"

/**
 * The heartbeat. Cloudflare answers this without waking the object, so a room
 * full of idle viewers costs nothing — and `getWebSocketAutoResponseTimestamp`
 * still tells a later alarm when each socket was last heard from.
 *
 * It proves the socket is open, **not** that a human is there, which is why the
 * idle timer keys on messages that actually wake the room instead.
 */
export const PING = "ping"
export const PONG = "pong"

/** How often a viewer pings. Three missed pings is a dead connection. */
export const PING_INTERVAL_MS = 30_000

/** A holder whose socket has not pinged for this long has gone, close event or not. */
export const SOCKET_DEAD_MS = 95_000

/** A holder who has done nothing for this long loses the baton. */
export const BATON_IDLE_MS = 10 * 60_000

/** How long before that they are warned. Any action clears it. */
export const BATON_WARN_MS = 60_000
