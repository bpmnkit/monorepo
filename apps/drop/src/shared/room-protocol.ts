import type { EditorOp } from "@bpmnkit/editor/headless"

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
export type ClientMessage =
	/**
	 * "Edit". `filename` is which of the drop's files you mean to write.
	 *
	 * `token` is a Turnstile response, required when the deployment is configured
	 * for it. One challenge per editing session: invisible to a person taking the
	 * baton once, and a real cost to a script wanting to rewrite every drop it can
	 * find a link to.
	 */
	| { type: "claim"; filename: string; token?: string }
	| { type: "release" }
	/**
	 * An edit, from the holder. `seq` is the sender's own counter, echoed back on
	 * a rejection so a writer can tell which of its ops the room refused — the
	 * room never orders by it, because with one writer and a Durable Object's
	 * input gate the ops cannot arrive interleaved in the first place.
	 */
	| { type: "op"; seq: number; op: EditorOp }
	/** "I have lost track of the document" — ask for the current state outright. */
	| { type: "resync"; filename: string }

/** Sent by the room. */
export type ServerMessage =
	/** First message on every connection: who you are, and what the room looks like. */
	| { type: "hello"; actor: string; viewers: number; holder: string | null; file: string | null }
	/**
	 * Someone joined or left, or the baton moved. `file` is what the holder
	 * claimed — a drop has many files and the baton covers one at a time, so a
	 * viewer on a different tab knows there is nothing here for it to watch.
	 */
	| { type: "presence"; viewers: number; holder: string | null; file: string | null }
	/**
	 * You hold the baton, and here is what you are editing.
	 *
	 * The document comes with the grant rather than being asked for afterwards:
	 * the room had to load it to answer the claim at all, and a second round trip
	 * between pressing Edit and the editor appearing is the one place in this
	 * product where latency is felt. `idleMs` is how long you may sit still
	 * before losing the baton.
	 */
	| {
			type: "granted"
			holder: string
			idleMs: number
			filename: string
			version: number
			hash: string
			xml: string
	  }
	/** Someone else holds it. */
	| { type: "denied"; holder: string }
	/** You are about to lose the baton for being idle. Any action keeps it. */
	| { type: "warning"; secondsLeft: number }
	/** You no longer hold the baton. */
	| { type: "revoked"; reason: RevokeReason }
	/**
	 * An op became the document. Sent to everyone, the writer included — the
	 * writer has already applied it locally and uses this to confirm the room
	 * agreed, the watchers to replay it. `hash` is what the document should hash
	 * to afterwards; anyone who computes something else has diverged and should
	 * ask to resync.
	 */
	| { type: "applied"; version: number; seq: number; filename: string; op: EditorOp; hash: string }
	/**
	 * Your op did not happen. Only the sender sees this. `seq` echoes the op's
	 * own; it is 0 when the refusal was not about a numbered op — a claim on a
	 * file the room cannot edit, or a resync of one.
	 */
	| { type: "rejected"; seq: number; reason: RejectReason; detail?: string }
	/** The current document, whole. The answer to a resync, and to a divergence. */
	| { type: "state"; filename: string; version: number; xml: string; hash: string }

/**
 * Why a holder stopped holding.
 *
 * The last two are the room taking the baton away rather than losing track of
 * it: `banned` when the saved content turns out to be on the ban list, and
 * `too-large` when what the room holds is past what can be stored. Both are
 * discovered at save time, because both are facts about the stored form.
 */
export type RevokeReason = "released" | "idle" | "disconnected" | "banned" | "too-large"

/**
 * Why an op did not happen.
 *
 * - `not-holder` — someone without the baton tried to write. This is the entire
 *   permission model, and it is enforced here rather than by hiding a button.
 * - `malformed` — the message was not a recognisable op.
 * - `no-document` — the room could not load the file: gone, or not a BPMN.
 * - `invalid` — replaying the op threw.
 * - `integrity` — the op replayed, but the document it produced could not be
 *   stored (a dangling reference, a duplicate id, an element with nothing to
 *   draw it). `detail` says which.
 * - `too-large` — the document it produced is past what a D1 row will hold. The
 *   cap is checked on the edit rather than only on the save, so the answer
 *   arrives while the change is still undoable.
 * - `banned` — the drop's content has been banned since the session began, and
 *   the room has stopped taking edits.
 * - `unverified` — the claim carried no Turnstile token, or one Cloudflare did
 *   not accept. The page asks again; a script has to solve one per drop.
 * - `read-only` — this file is not one the editor may write: the built-in demo,
 *   a drop an operator has pinned, or a diagram with more than one process.
 *   `detail` says which, because "no" without a reason reads as a bug.
 */
export type RejectReason =
	| "not-holder"
	| "malformed"
	| "no-document"
	| "invalid"
	| "integrity"
	| "too-large"
	| "banned"
	| "unverified"
	| "read-only"

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
