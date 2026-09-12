/**
 * Watching someone else edit.
 *
 * A watcher is not sent the document on every keystroke — that would be
 * hundreds of kilobytes per drag. It is sent the *op*, and it runs the same
 * `applyOp` the writer and the room both ran. Three machines, one function, and
 * the ids travel in the op, so all three land on byte-identical XML.
 *
 * Which is a claim, and the reason every `applied` message carries a hash. The
 * watcher re-serialises what it produced and compares. Agreement is the normal
 * case and costs a hash; disagreement means this watcher has drifted, and the
 * answer is not to guess which side is right — the room is right — but to throw
 * the local document away and ask for the current one. One round trip, and the
 * watcher is correct again rather than subtly wrong forever.
 *
 * **Exactly one resync per divergence.** Ops keep arriving while the answer is
 * in flight, and replaying them onto a document already declared lost would
 * produce more mismatches and more requests. So a watcher awaiting `state`
 * drops everything until it arrives.
 *
 * No DOM: this decides *what the document is*, and the viewer decides what to
 * draw. That split is what lets the interesting cases — a missed op, a corrupted
 * document, a resync racing an edit — be tested without a browser.
 */
import { Bpmn, type BpmnDefinitions, sha256Hex } from "@bpmnkit/core"
import { type EditorOp, applyOp } from "@bpmnkit/editor/headless"
import type { ClientMessage, ServerMessage } from "../shared/room-protocol.js"

/** The document a watcher believes in. */
export interface WatcherDoc {
	filename: string
	version: number
	xml: string
	hash: string
	defs: BpmnDefinitions
}

/** What an op did, for the viewer to draw attention to. */
export interface Change {
	/** Elements the op altered or removed. */
	touched: string[]
	/** Elements it brought into being. */
	created: string[]
}

/** Why a watcher gave up on its document. Surfaced for logging, not for the user. */
export type DriftReason = "gap" | "hash" | "threw"

export interface WatcherHooks {
	send(message: ClientMessage): void
	/** A new document to draw. `change` is null when it arrived whole, via resync. */
	render(doc: WatcherDoc, change: Change | null): void
	/** Called on every divergence, before the resync goes out. */
	onDrift?(reason: DriftReason): void
}

export class DocWatcher {
	private doc: WatcherDoc | null = null
	private filename: string | null = null
	private awaitingState = false
	/**
	 * Messages are handled one at a time even though hashing is async.
	 * `addEventListener` delivers in order, but an `await` inside the handler
	 * would let the next message overtake the one before it — and two ops applied
	 * out of order is precisely the divergence this class exists to avoid.
	 */
	private chain: Promise<void> = Promise.resolve()

	constructor(private readonly hooks: WatcherHooks) {}

	/**
	 * Points the watcher at one of the drop's files, or at none.
	 *
	 * The viewer shows one file at a time and only BPMN has an op vocabulary, so
	 * switching tabs drops the old document rather than keeping several in sync.
	 */
	watch(filename: string | null): void {
		if (filename === this.filename) return
		this.filename = filename
		this.doc = null
		this.awaitingState = false
	}

	/** Feeds the watcher a message from the room. Safe to call with any of them. */
	handle(message: ServerMessage): void {
		switch (message.type) {
			case "hello":
			case "presence":
				// Only when the file *this* viewer is showing is the one being edited.
				// Nobody editing means the page's own copy is already current, and
				// someone editing a different file of the same drop changes nothing
				// here — asking anyway would wake the room for viewers with nothing to
				// watch, which is the cost the room was built to avoid.
				if (message.holder !== null && message.file === this.filename) this.ensureSynced()
				return
			case "applied":
				if (message.filename !== this.filename) return
				this.enqueue(() => this.applyOne(message))
				return
			case "state":
				if (message.filename !== this.filename) return
				this.enqueue(() => this.adopt(message))
				return
			default:
				return
		}
	}

	/** The document as the watcher currently believes it, for the viewer to draw. */
	current(): WatcherDoc | null {
		return this.doc
	}

	// ── Internals ──────────────────────────────────────────────────────────────

	private enqueue(step: () => Promise<void>): void {
		this.chain = this.chain.then(step).catch(() => {
			// A step that threw has already given up its document; swallowing keeps
			// one bad message from wedging the queue for every message after it.
		})
	}

	private async applyOne(message: {
		version: number
		op: EditorOp
		hash: string
	}): Promise<void> {
		// A resync is already on its way. Anything applied now is applied to a
		// document we have declared lost, so it can only produce more mismatches.
		if (this.awaitingState) return
		const doc = this.doc
		if (!doc) return this.ensureSynced()

		// Not the next version: an op went missing, and replaying this one would
		// build on a document that never existed.
		if (message.version !== doc.version + 1) return this.drift("gap")

		let next: BpmnDefinitions
		let created: string[]
		try {
			const result = applyOp(doc.defs, message.op)
			next = result.defs
			created = result.created
		} catch {
			return this.drift("threw")
		}

		const xml = Bpmn.export(next)
		const hash = await sha256Hex(xml)
		// The whole point. Everything upstream is an argument that this matches;
		// this is the check that the argument held.
		if (hash !== message.hash) return this.drift("hash")

		this.doc = { filename: doc.filename, version: message.version, xml, hash, defs: next }
		this.hooks.render(this.doc, { touched: touchedBy(message.op), created })
	}

	private async adopt(message: {
		filename: string
		version: number
		xml: string
		hash: string
	}): Promise<void> {
		this.awaitingState = false
		let defs: BpmnDefinitions
		try {
			defs = Bpmn.parse(message.xml)
		} catch {
			// The room sent something unparseable, which a retry will not fix.
			this.doc = null
			return
		}
		this.doc = {
			filename: message.filename,
			version: message.version,
			xml: message.xml,
			hash: message.hash,
			defs,
		}
		this.hooks.render(this.doc, null)
	}

	/** Asks for the current document, unless a request is already outstanding. */
	private ensureSynced(): void {
		if (!this.filename || this.doc || this.awaitingState) return
		this.awaitingState = true
		this.hooks.send({ type: "resync", filename: this.filename })
	}

	/** Throws the local document away and asks for the room's. */
	private drift(reason: DriftReason): void {
		this.hooks.onDrift?.(reason)
		this.doc = null
		this.ensureSynced()
	}

	/**
	 * Drifts the watcher's document, for the test that a divergence heals.
	 *
	 * A guarantee that only holds when nothing goes wrong is not a guarantee, and
	 * the only honest way to see the recovery path run is to break the state on
	 * purpose. It moves a *shape*, not the stored hash: the hash is recomputed
	 * from the document on every op, so falsifying the bookkeeping would prove
	 * nothing. Nothing in the viewer calls this.
	 */
	corruptForTest(): void {
		const shape = this.doc?.defs.diagrams[0]?.plane.shapes[0]
		if (shape) shape.bounds = { ...shape.bounds, x: shape.bounds.x + 1 }
	}
}

/**
 * The elements an op altered, from the op alone.
 *
 * Creations are absent here on purpose: what a creating op makes is known only
 * after it runs, and `applyOp` reports it. This covers the rest.
 */
export function touchedBy(op: EditorOp): string[] {
	switch (op.kind) {
		case "move":
			return op.moves.map((m) => m.id)
		case "delete":
			return op.ids
		case "resize":
		case "rename":
		case "labelPosition":
		case "color":
		case "changeType":
			return [op.id]
		case "reconnect":
		case "insertWaypoint":
		case "moveWaypoint":
		case "moveSegment":
			return [op.edgeId]
		case "createBoundaryEvent":
			return [op.hostId]
		case "createAnnotationFor":
		case "createConnected":
			return [op.sourceId]
		case "createConnection":
			return [op.sourceId, op.targetId]
		default:
			// createShape, createAnnotation, paste, autoLayout, snapshot — either
			// nothing existing was touched, or everything was, and flashing the whole
			// diagram says less than flashing none of it.
			return []
	}
}
