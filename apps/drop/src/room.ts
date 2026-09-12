import { semanticHash, sha256Hex } from "@bpmnkit/core"
import type { EditorOp } from "@bpmnkit/editor/headless"
import type { Env } from "./env.js"
import { getFileRef, recordViews } from "./lib/db.js"
import {
	type RoomDoc,
	advance,
	loadDocFromDb,
	readStoredDoc,
	sourceKey,
	storedBody,
	writeDoc,
} from "./lib/doc.js"
import { describeProblem } from "./lib/integrity.js"
import { parseOp } from "./lib/op-guard.js"
import { appendMilestone, bucketKey, setCurrent } from "./lib/versions.js"
import { AUTOSAVE_MS, RETENTION_MS, VIEW_FLUSH_MS } from "./shared/constants.js"
import {
	BATON_IDLE_MS,
	BATON_WARN_MS,
	type ClientMessage,
	PING,
	PONG,
	type RejectReason,
	type RevokeReason,
	SOCKET_DEAD_MS,
	type ServerMessage,
} from "./shared/room-protocol.js"

/** Per-connection state, kept on the socket so it survives hibernation. */
interface Attachment {
	actor: string
}

/**
 * One instance per shareId: the room a drop's viewers share.
 *
 * It does three things.
 *
 * **Presence.** A live head-count over hibernating WebSockets, so idle viewers
 * cost nothing — the instance is evicted from memory between events while the
 * sockets stay connected.
 *
 * **View counting.** A socket join is a view. They accumulate in the object's
 * own storage and reach D1 on an alarm, so fifty people opening a drop in the
 * same minute is one write rather than fifty.
 *
 * **The edit baton.** At most one participant may write at a time. Claiming is
 * race-free without any locking: Durable Object input gates deliver one message
 * at a time, so a read-then-write inside a handler cannot interleave with
 * another claim. That single-writer rule is what lets the rest of this system
 * skip operational transform entirely.
 *
 * **Editing.** The holder's ops are replayed here, not trusted: the room runs
 * the same `applyOp` the browser ran, checks the document that comes out is one
 * it can store, and only then does that become the drop's state. So a client
 * cannot write anything it could not have reached by editing, and the state
 * everyone sees is the room's, never a writer's claim about it.
 *
 * **Autosave.** There is no save button because there is nothing for it to do.
 * The object's own storage takes every op, so nothing is ever unsaved; D1 is
 * brought level on an alarm thirty seconds after the first unsaved edit, which
 * is the difference between roughly 120 writes an hour and one per keystroke.
 * A milestone joins the version log once per hour of each editing session, and
 * once more when the baton is put down.
 *
 * Nothing in memory is trusted across events. Every field the room needs after a
 * wake lives in storage or on a socket's attachment — including the document,
 * which is why a hibernated room can accept the next op without asking anyone
 * what happened while it was asleep.
 */
export class DocRoom implements DurableObject {
	/**
	 * The loaded documents, by filename.
	 *
	 * A cache and never the truth: hibernation clears it without warning, and
	 * every entry is reconstructible from storage. It exists so a drag does not
	 * re-parse the document on every frame.
	 */
	private readonly docs = new Map<string, RoomDoc>()

	constructor(
		private readonly state: DurableObjectState,
		private readonly env: Env,
	) {
		// Answered by the runtime without waking this object, so a heartbeat costs
		// neither duration nor a request — while still leaving a timestamp an alarm
		// can read to spot a socket that has gone quiet.
		this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG))
	}

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

		// There are no accounts, so identity is per-connection and opaque. It is the
		// socket's tag as well as its attachment: tags are fixed at accept time, and
		// tagging by actor is what lets a later alarm find the holder's socket after
		// the object has been evicted from memory.
		const actor = crypto.randomUUID().slice(0, 8)
		this.state.acceptWebSocket(server, [actor])
		server.serializeAttachment({ actor } satisfies Attachment)

		const holder = await this.holder()
		this.send(server, {
			type: "hello",
			actor,
			viewers: this.state.getWebSockets().length,
			holder,
			file: await this.holderFile(),
		})
		await this.broadcastPresence()
		return new Response(null, { status: 101, webSocket: client })
	}

	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
		if (typeof raw !== "string") return
		let message: ClientMessage
		try {
			message = JSON.parse(raw) as ClientMessage
		} catch {
			return
		}

		const actor = this.actorOf(ws)
		if (!actor) return

		// Reaching this handler at all is activity: auto-response pings never wake
		// the object, so anything that does is something a person did.
		await this.state.storage.put("lastActivityAt", Date.now())

		if (message.type === "claim") await this.claim(ws, actor, message.filename)
		else if (message.type === "release" && (await this.release(actor, "released"))) {
			await this.broadcastPresence()
		} else if (message.type === "op") await this.handleOp(ws, actor, message)
		else if (message.type === "resync") await this.sendState(ws, message.filename)
		await this.rearm()
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		const actor = this.actorOf(ws)
		if (actor) await this.release(actor, "disconnected")
		await this.broadcastPresence(ws)
		await this.rearm()
	}

	async webSocketError(ws: WebSocket): Promise<void> {
		await this.webSocketClose(ws)
	}

	/**
	 * The room's single timer. A Durable Object has one alarm, so every deadline
	 * shares it: whichever is due next arms it, and each firing re-arms for the
	 * one after.
	 */
	async alarm(): Promise<void> {
		const now = Date.now()
		await this.flushViews(now)
		await this.flushDoc(now)
		await this.checkBaton(now)
		await this.rearm(now)
	}

	// ── The baton ──────────────────────────────────────────────────────────────

	private async claim(ws: WebSocket, actor: string, filename: string): Promise<void> {
		const holder = await this.holder()
		if (holder !== null && holder !== actor) {
			this.send(ws, { type: "denied", holder })
			return
		}

		// Loading before granting means "Edit" fails loudly on a file the room
		// cannot write, rather than succeeding and rejecting the first op.
		const doc = await this.doc(filename)
		if (!doc) {
			this.send(ws, { type: "rejected", seq: 0, reason: "no-document" })
			return
		}

		// The session id is what keeps one person's milestone from being overwritten
		// by the next person's inside the same hour — see the plan's §2.4.
		await this.state.storage.put({
			holder: actor,
			holderFile: filename,
			sessionId: actor,
			lastActivityAt: Date.now(),
		})
		await this.state.storage.delete("warnedAt")
		this.send(ws, {
			type: "granted",
			holder: actor,
			idleMs: BATON_IDLE_MS,
			filename,
			version: doc.version,
			hash: doc.hash,
			xml: doc.xml,
		})
		await this.broadcastPresence()
	}

	private async release(actor: string, reason: RevokeReason): Promise<boolean> {
		if ((await this.holder()) !== actor) return false
		// Save before letting go, and cut a milestone: the session is over, and the
		// state it ended in is the one worth being able to come back to.
		await this.flushDoc(Date.now(), { force: true, milestone: true })
		await this.state.storage.delete(["holder", "holderFile", "warnedAt"])
		for (const ws of this.state.getWebSockets(actor)) {
			this.send(ws, { type: "revoked", reason })
		}
		return true
	}

	/**
	 * Reclaims the baton from a holder who is gone or merely absent.
	 *
	 * Two different failures, deliberately distinguished. A closed laptop lid
	 * sends no close event, so the holder's socket goes quiet — its heartbeat
	 * timestamp stops advancing and the baton is taken immediately. A holder who
	 * is still connected but has done nothing is warned first, because they are
	 * there and a keystroke should keep it.
	 */
	private async checkBaton(now: number): Promise<void> {
		const holder = await this.holder()
		if (!holder) return

		const sockets = this.state.getWebSockets(holder)
		if (sockets.length === 0 || this.silentFor(sockets, now) > SOCKET_DEAD_MS) {
			await this.release(holder, "disconnected")
			await this.broadcastPresence()
			return
		}

		const idleFor = now - ((await this.state.storage.get<number>("lastActivityAt")) ?? now)
		if (idleFor >= BATON_IDLE_MS) {
			await this.release(holder, "idle")
			await this.broadcastPresence()
			return
		}
		if (idleFor >= BATON_IDLE_MS - BATON_WARN_MS && !(await this.state.storage.get("warnedAt"))) {
			await this.state.storage.put("warnedAt", now)
			for (const ws of sockets) {
				this.send(ws, {
					type: "warning",
					secondsLeft: Math.max(0, Math.round((BATON_IDLE_MS - idleFor) / 1000)),
				})
			}
		}
	}

	/** How long the holder's quietest socket has gone without a heartbeat. */
	private silentFor(sockets: WebSocket[], now: number): number {
		let quietest = 0
		for (const ws of sockets) {
			const last = this.state.getWebSocketAutoResponseTimestamp(ws)
			// Never pinged yet: measure from the claim rather than calling it dead.
			quietest = Math.max(quietest, last ? now - last.getTime() : 0)
		}
		return quietest
	}

	private async holder(): Promise<string | null> {
		return (await this.state.storage.get<string>("holder")) ?? null
	}

	/** The file the holder claimed, or null when nobody holds the baton. */
	private async holderFile(): Promise<string | null> {
		return (await this.state.storage.get<string>("holderFile")) ?? null
	}

	// ── Editing ────────────────────────────────────────────────────────────────

	/**
	 * Replays one op and, if the result is storable, makes it the document.
	 *
	 * Four things can stop an op, and each is answered rather than ignored: the
	 * sender does not hold the baton, the message is not an op, replaying it
	 * throws, or the document it produces is one the room will not serve. Only
	 * the last needs the replay to have happened, which is why the order is
	 * permission, shape, replay, judgement.
	 */
	private async handleOp(
		ws: WebSocket,
		actor: string,
		message: { seq: number; op: EditorOp },
	): Promise<void> {
		const { seq } = message
		if ((await this.holder()) !== actor) return this.reject(ws, seq, "not-holder")

		const op = parseOp(message.op)
		if (!op) return this.reject(ws, seq, "malformed")

		const filename = await this.holderFile()
		const doc = filename ? await this.doc(filename) : null
		if (!doc) return this.reject(ws, seq, "no-document")

		const result = await advance(doc, op)
		if (!result.ok) {
			return result.reason === "integrity"
				? this.reject(ws, seq, "integrity", describeProblem(result.problem))
				: this.reject(ws, seq, "invalid", result.detail)
		}

		// Storage first, then the broadcast. A room that told everyone about an op
		// it had not kept would be claiming a state it could lose on eviction.
		this.docs.set(doc.filename, result.doc)
		await writeDoc(this.state.storage, result.doc)
		await this.markDirty(result.doc.filename)

		this.broadcast({
			type: "applied",
			version: result.doc.version,
			seq,
			filename: result.doc.filename,
			op,
			hash: result.doc.hash,
		})
	}

	/** Sends a file's current state to one socket — the answer to a divergence. */
	private async sendState(ws: WebSocket, filename: string): Promise<void> {
		const doc = await this.doc(filename)
		if (!doc) return this.reject(ws, 0, "no-document")
		this.send(ws, {
			type: "state",
			filename: doc.filename,
			version: doc.version,
			xml: doc.xml,
			hash: doc.hash,
		})
	}

	/**
	 * The document for a file: from memory, else storage, else D1.
	 *
	 * The three tiers are one fact each. Memory is a cache. Storage is what
	 * survives hibernation, and is ahead of D1 for as long as anyone is editing.
	 * D1 is where a cold room starts, and catches up at the autosave checkpoint.
	 */
	private async doc(filename: string): Promise<RoomDoc | null> {
		const cached = this.docs.get(filename)
		if (cached) return cached

		const stored = await readStoredDoc(this.state.storage, filename)
		if (stored) {
			this.docs.set(filename, stored)
			return stored
		}

		const shareId = await this.state.storage.get<string>("shareId")
		if (!shareId) return null
		const loaded = await loadDocFromDb(this.env.DB, shareId, filename)
		if (!loaded) return null
		// The source is kept because a later save splices into it, and this is the
		// only moment the uploaded bytes are in hand. The *document* is not written
		// here: nothing has changed yet, and a room only ever looked at should
		// leave no document behind.
		await this.state.storage.put(sourceKey(filename), loaded.source)
		this.docs.set(filename, loaded.doc)
		return loaded.doc
	}

	private reject(ws: WebSocket, seq: number, reason: RejectReason, detail?: string): void {
		this.send(ws, { type: "rejected", seq, reason, ...(detail ? { detail } : {}) })
	}

	// ── Views ──────────────────────────────────────────────────────────────────

	private async noteView(shareId: string): Promise<void> {
		const pending = (await this.state.storage.get<number>("pendingViews")) ?? 0
		await this.state.storage.put({ pendingViews: pending + 1, shareId })
		if (pending === 0) {
			await this.state.storage.put("viewFlushAt", Date.now() + VIEW_FLUSH_MS)
		}
		await this.rearm()
	}

	private async flushViews(now: number): Promise<void> {
		const due = await this.state.storage.get<number>("viewFlushAt")
		if (due === undefined || now < due) return

		const pending = (await this.state.storage.get<number>("pendingViews")) ?? 0
		const shareId = await this.state.storage.get<string>("shareId")
		// Zero the counter first: a failed write costs a few counted views, while a
		// failed reset would count them again on the next alarm.
		await this.state.storage.put("pendingViews", 0)
		await this.state.storage.delete("viewFlushAt")
		if (pending === 0 || !shareId) return
		await recordViews(this.env.DB, shareId, pending, now, now + RETENTION_MS)
	}

	// ── Autosave ───────────────────────────────────────────────────────────────

	/**
	 * Notes that D1 is behind, and when it should stop being.
	 *
	 * The deadline is set by the *first* unsaved edit and not pushed back by the
	 * ones after it. Refreshing it on every op would mean a room edited
	 * continuously never saved at all, which is the opposite of what a debounce
	 * is for here: the aim is to bound how stale D1 gets, not to wait for a lull.
	 */
	private async markDirty(filename: string): Promise<void> {
		const pending = await this.state.storage.get<number>("docFlushAt")
		if (pending === undefined) {
			await this.state.storage.put("docFlushAt", Date.now() + AUTOSAVE_MS)
		}
		const counted = (await this.state.storage.get<number>("opsSinceMilestone")) ?? 0
		await this.state.storage.put({ dirtyFile: filename, opsSinceMilestone: counted + 1 })
		await this.rearm()
	}

	/**
	 * Brings D1 level with the room, and cuts a milestone when one is due.
	 *
	 * A milestone is written the first time a given `(hour, session)` is saved,
	 * and refreshed when the baton is put down — so an hour of continuous editing
	 * leaves exactly one row, holding the state that hour ended in.
	 * `appendMilestone` does the collapsing and the pruning; this only decides
	 * when to ask.
	 */
	private async flushDoc(
		now: number,
		options: { force?: boolean; milestone?: boolean } = {},
	): Promise<void> {
		const due = await this.state.storage.get<number>("docFlushAt")
		if (due === undefined || (!options.force && now < due)) return

		const filename = await this.state.storage.get<string>("dirtyFile")
		const shareId = await this.state.storage.get<string>("shareId")
		// Cleared first: a failed write costs one more stale window, while a failed
		// reset would retry the same save on every alarm from now on.
		await this.state.storage.delete("docFlushAt")
		if (!filename || !shareId) return

		const doc = await this.doc(filename)
		const file = await getFileRef(this.env.DB, shareId, filename)
		if (!doc || !file) return

		const source = (await this.state.storage.get<string>(sourceKey(filename))) ?? doc.xml
		const body = storedBody(source, doc.defs)
		const contentHash = await sha256Hex(body)
		// This save becomes the next one's source, so formatting keeps surviving.
		await this.state.storage.put(sourceKey(filename), body)

		await setCurrent(this.env.DB, {
			fileId: file.id,
			shareId,
			body,
			json: JSON.stringify(doc.defs),
			contentHash,
			expiresAt: now + RETENTION_MS,
			now,
		})

		const sessionId = (await this.state.storage.get<string>("sessionId")) ?? "anon"
		const bucket = bucketKey(now, sessionId)
		const lastBucket = await this.state.storage.get<string>("milestoneBucket")
		if (options.milestone || bucket !== lastBucket) {
			await appendMilestone(this.env.DB, {
				fileId: file.id,
				body,
				contentHash,
				semanticHash: semanticHash(doc.defs),
				sessionId,
				opCount: (await this.state.storage.get<number>("opsSinceMilestone")) ?? 0,
				now,
			})
			await this.state.storage.put("milestoneBucket", bucket)
			await this.state.storage.put("opsSinceMilestone", 0)
		}
	}

	// ── Plumbing ───────────────────────────────────────────────────────────────

	/**
	 * Points the single alarm at the earliest thing waiting to happen, and clears
	 * it when nothing is. Called after anything that creates or resolves a
	 * deadline, so a quiet room holds no timer at all.
	 */
	private async rearm(now = Date.now()): Promise<void> {
		const deadlines: number[] = []

		const viewFlushAt = await this.state.storage.get<number>("viewFlushAt")
		if (viewFlushAt !== undefined) deadlines.push(viewFlushAt)

		const docFlushAt = await this.state.storage.get<number>("docFlushAt")
		if (docFlushAt !== undefined) deadlines.push(docFlushAt)

		if ((await this.holder()) !== null) {
			const since = (await this.state.storage.get<number>("lastActivityAt")) ?? now
			deadlines.push(since + BATON_IDLE_MS - BATON_WARN_MS, since + BATON_IDLE_MS)
			// A dead socket is spotted between heartbeats, not at the idle deadline.
			deadlines.push(now + SOCKET_DEAD_MS)
		}

		const next = deadlines.filter((d) => d > now).sort((a, b) => a - b)[0]
		if (next === undefined) {
			await this.state.storage.deleteAlarm()
			return
		}
		const current = await this.state.storage.getAlarm()
		if (current === null || current > next) await this.state.storage.setAlarm(next)
	}

	private actorOf(ws: WebSocket): string | null {
		const attached = ws.deserializeAttachment() as Attachment | null
		if (attached?.actor) return attached.actor
		// Attachments survive hibernation, but tags are the belt to that braces.
		return this.state.getTags(ws)[0] ?? null
	}

	private send(ws: WebSocket, message: ServerMessage): void {
		try {
			ws.send(JSON.stringify(message))
		} catch {
			// socket already gone — ignore
		}
	}

	/** Sends to every connected socket. */
	private broadcast(message: ServerMessage): void {
		for (const ws of this.state.getWebSockets()) this.send(ws, message)
	}

	private async broadcastPresence(excluding?: WebSocket): Promise<void> {
		const holder = await this.holder()
		const file = await this.holderFile()
		const sockets = this.state.getWebSockets().filter((ws) => ws !== excluding)
		for (const ws of sockets) {
			this.send(ws, { type: "presence", viewers: sockets.length, holder, file })
		}
	}
}
