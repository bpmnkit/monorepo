/**
 * The document a room is editing: how it is loaded, advanced, and kept.
 *
 * The room is the single authority for a drop's current state while anyone has
 * it open — that is what having one writer buys, and it is why nothing here
 * merges anything. An op comes in, `applyOp` produces the next document, and
 * the result is the state, full stop.
 *
 * **Where it lives between events.** A Durable Object with hibernating sockets
 * is evicted from memory while its viewers stay connected, so in-memory state
 * is a cache and never the truth. The truth is one storage value per file,
 * written on every applied op. A SQLite-backed object allows 2 MB per key and
 * value together, comfortably above `MAX_FILE_BYTES`, so the whole document
 * fits in one write and waking the room costs one read and one parse — no op
 * log to replay, and nothing that grows without bound.
 *
 * **Where it comes from.** On the first op after a cold start there is no
 * stored document yet, so the room reads D1: the edited body if the drop has
 * ever been edited, the uploaded one if it has not. D1 stays behind until the
 * autosave checkpoint writes to it; the room is ahead, and the room is right.
 *
 * The hash is over `Bpmn.export(defs)` — the same canonical serialisation that
 * is stored, sent on a resync, and compared by watchers. One canonicalisation
 * for all three, so a mismatch means a real divergence rather than a formatting
 * difference.
 */
import { Bpmn, type BpmnDefinitions, exportPreserving, sha256Hex } from "@bpmnkit/core"
import { type EditorOp, applyOp } from "@bpmnkit/editor/headless"
import { getCurrentBody } from "./db.js"
import { type IntegrityProblem, checkIntegrity } from "./integrity.js"

/** A file's live state inside the room. */
export interface RoomDoc {
	filename: string
	/** Ops applied since the document was first loaded. Monotonic, never reused. */
	version: number
	/**
	 * The canonical serialisation: what is hashed, broadcast and resynced.
	 *
	 * Canonical rather than faithful on purpose — a watcher has to be able to
	 * reproduce it from the op alone, and it has no way to reproduce the
	 * uploader's whitespace. What reaches D1 is the faithful one; see
	 * {@link storedBody}.
	 */
	xml: string
	hash: string
	defs: BpmnDefinitions
}

/** What is written to storage: the parse is redone on wake rather than stored. */
interface StoredDoc {
	filename: string
	version: number
	xml: string
	hash: string
}

/** The outcome of feeding an op to a document. */
export type ApplyResult =
	| { ok: true; doc: RoomDoc }
	| { ok: false; reason: "invalid"; detail: string }
	| { ok: false; reason: "integrity"; problem: IntegrityProblem }

/** Storage key for one file's document. Scoped by filename: one room, many files. */
export function docKey(filename: string): string {
	return `doc:${filename}`
}

/**
 * Storage key for the file's source text — the bytes the room last read.
 *
 * Kept apart from the document rather than inside it for two reasons. It is
 * written once per load where the document is written on every op, so bundling
 * them would serialise a second copy of the file on every keystroke. And a
 * Durable Object caps a key and its value at 2 MB together, which two 900 KB
 * bodies in one value would come uncomfortably close to.
 */
export function sourceKey(filename: string): string {
	return `src:${filename}`
}

/**
 * What gets written to D1: the edit, spliced into the text it came from.
 *
 * `Bpmn.export` would reformat the whole file, so a drop that someone edits
 * once would come back reindented from top to bottom — every diff against the
 * original would be noise, and any comment or hand-alignment in the upload
 * would be gone. `exportPreserving` rewrites only what changed.
 *
 * Each save becomes the source for the next, so formatting survives a session
 * ending as well as an op.
 */
export function storedBody(source: string, defs: BpmnDefinitions): string {
	try {
		return exportPreserving(source, defs)
	} catch {
		// A source the splicer cannot work with must not cost the edit itself.
		return Bpmn.export(defs)
	}
}

/** Builds a `RoomDoc` from XML, parsing and hashing it once. */
export async function docFromXml(
	filename: string,
	xml: string,
	version: number,
): Promise<RoomDoc | null> {
	let defs: BpmnDefinitions
	try {
		defs = Bpmn.parse(xml)
	} catch {
		// An unparseable stored body is not something a retry fixes, and the room
		// refusing to edit is better than the room inventing a document.
		return null
	}
	// Re-serialise rather than hashing the input: what is compared has to be what
	// the next op will produce, and a parse is not byte-preserving.
	const canonical = Bpmn.export(defs)
	return { filename, version, xml: canonical, hash: await sha256Hex(canonical), defs }
}

/** Reads the stored document for a file, or null if the room has never loaded it. */
export async function readStoredDoc(
	storage: DurableObjectStorage,
	filename: string,
): Promise<RoomDoc | null> {
	const stored = await storage.get<StoredDoc>(docKey(filename))
	if (!stored) return null
	return await docFromXml(stored.filename, stored.xml, stored.version)
}

/**
 * Loads a file's current state from D1 — the cold-start path.
 *
 * Returns the source bytes alongside the document: they are what a later save
 * splices its changes into, and this is the only moment they are in hand.
 */
export async function loadDocFromDb(
	db: D1Database,
	shareId: string,
	filename: string,
): Promise<{ doc: RoomDoc; source: string } | null> {
	const file = await getCurrentBody(db, shareId, filename, "original")
	// Only BPMN has an op vocabulary; a DMN or form in the same drop is viewable
	// but not editable, and saying so here keeps the room from half-supporting it.
	if (!file || file.kind !== "bpmn") return null
	const doc = await docFromXml(filename, file.body, 0)
	return doc ? { doc, source: file.body } : null
}

/** Persists a document, replacing whatever the room held for that file. */
export async function writeDoc(storage: DurableObjectStorage, doc: RoomDoc): Promise<void> {
	const stored: StoredDoc = {
		filename: doc.filename,
		version: doc.version,
		xml: doc.xml,
		hash: doc.hash,
	}
	await storage.put(docKey(doc.filename), stored)
}

/**
 * Advances a document by one op, or explains why it will not.
 *
 * The order matters and is the whole point: replay first, judge the *result*,
 * and only then let it become the state. Judging the op instead would mean
 * teaching this function what every op does, which is the duplication `applyOp`
 * exists to avoid.
 */
export async function advance(doc: RoomDoc, op: EditorOp): Promise<ApplyResult> {
	let next: BpmnDefinitions
	try {
		next = applyOp(doc.defs, op).defs
	} catch (error) {
		return { ok: false, reason: "invalid", detail: String(error) }
	}

	const problem = checkIntegrity(next)
	if (problem) return { ok: false, reason: "integrity", problem }

	const xml = Bpmn.export(next)
	return {
		ok: true,
		doc: {
			filename: doc.filename,
			version: doc.version + 1,
			xml,
			hash: await sha256Hex(xml),
			defs: next,
		},
	}
}
