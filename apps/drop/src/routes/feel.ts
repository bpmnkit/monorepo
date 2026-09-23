/**
 * Updating a shared FEEL statement from the page that shows it.
 *
 * A BPMN drop is edited through the room — a baton, an op vocabulary, watchers
 * replaying each change. A statement has none of that and needs none of it: it
 * is two boxes of text, and an edit is the whole document. So one request
 * replaces it, and the guards the room applies to a save are applied here
 * instead: the carve-outs (the demo has no row to write to, a pinned drop is
 * not anyone's to rewrite), the ban list, and Turnstile where it is configured.
 *
 * **What stops one tab overwriting another.** Not a baton — a precondition. The
 * page sends the hash of the document it opened, and a save whose base is no
 * longer current is refused rather than applied. Two people editing the same
 * statement at once is rare; silently losing one of them would not be.
 *
 * **The state being replaced becomes a milestone first**, exactly as an editing
 * session's does, so the guarantee the version log exists to keep holds for a
 * statement as well: anyone with the link may overwrite a drop, and nobody can
 * destroy what it was.
 */
import type { Env } from "../env.js"
import { findBannedHashes, getCurrentBody, getDrop, getFileRef, setFileLabel } from "../lib/db.js"
import { isDemo } from "../lib/demo.js"
import { clientIp, json } from "../lib/http.js"
import { sha256Hex } from "../lib/ids.js"
import { extractMeta } from "../lib/meta.js"
import { verifyTurnstile } from "../lib/turnstile.js"
import { byteLength } from "../lib/validate.js"
import { appendMilestone, setCurrent } from "../lib/versions.js"
import { MAX_FILE_BYTES, MAX_ROW_BYTES, RETENTION_MS } from "../shared/constants.js"
import {
	type FeelDocument,
	FeelDocumentError,
	parseFeelDocument,
	serializeFeelDocument,
} from "../shared/feel-doc.js"

/** What the share page sends. Everything but the document is optional. */
interface UpdateRequest {
	document?: unknown
	/** The hash of the document the page opened, so a stale save is refused. */
	baseHash?: unknown
	/** Identifies one person's editing session, for milestone collapsing. */
	sessionId?: unknown
	/** Turnstile token, when the deployment challenges writes. */
	token?: unknown
}

/** Session ids come from the browser, so they are bounded before they key anything. */
const SESSION_ID = /^[\w-]{1,64}$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * The document the request describes, through the same gate an upload meets.
 *
 * Re-serialising and re-parsing rather than trusting the JSON is the point:
 * `parseFeelDocument` is what decides that a context is an object of variables,
 * that a mode is one of two, and that the expression parses — and a saved
 * statement has to clear exactly the bar an uploaded one did.
 */
function readDocument(value: unknown): FeelDocument {
	if (!isPlainObject(value) || typeof value.expression !== "string") {
		throw new FeelDocumentError('"expression" must be a string')
	}
	return parseFeelDocument(JSON.stringify(value))
}

/**
 * PUT /drop/:shareId/feel/:filename — replace a FEEL drop's statement.
 *
 * Answers `{ hash }`: the hash of the document as stored, which the page keeps
 * as the base for its next save.
 */
export async function handleFeelUpdate(
	request: Request,
	shareId: string,
	filename: string,
	env: Env,
	now: number,
): Promise<Response> {
	if (isDemo(shareId)) {
		return json({ error: "the demo drop cannot be edited — share a copy instead" }, { status: 403 })
	}

	const found = await getDrop(env.DB, shareId)
	if (!found) return json({ error: "not found" }, { status: 404 })
	// An operator pinned this drop: it never expires, and anyone-with-the-link
	// editing is right for an ordinary drop and wrong for a fixture.
	if (found.drop.expires_at === null) {
		return json({ error: "this drop is pinned by an operator and is read-only" }, { status: 403 })
	}
	const ref = await getFileRef(env.DB, shareId, filename)
	if (!ref) return json({ error: "not found" }, { status: 404 })
	if (ref.kind !== "feel") {
		return json({ error: "this file is not a FEEL statement" }, { status: 400 })
	}

	let payload: UpdateRequest
	try {
		payload = (await request.json()) as UpdateRequest
	} catch {
		return json({ error: "expected a JSON body" }, { status: 400 })
	}

	// The challenge sits on the write, not on opening the editor: trying
	// somebody's expression with your own numbers never leaves the browser, and
	// only a save is worth asking a person to prove they are one.
	const secret = env.TURNSTILE_SECRET
	if (secret) {
		const token = typeof payload.token === "string" ? payload.token : ""
		if (!(await verifyTurnstile(secret, token, clientIp(request)))) {
			return json({ error: "that check did not go through" }, { status: 403 })
		}
	}

	let doc: FeelDocument
	try {
		doc = readDocument(payload.document)
	} catch (error) {
		const message = error instanceof FeelDocumentError ? error.message : "invalid statement"
		return json({ error: message }, { status: 400 })
	}

	const body = serializeFeelDocument(doc)
	const modelJson = JSON.stringify(doc)
	if (byteLength(body) > MAX_FILE_BYTES || byteLength(modelJson) > MAX_ROW_BYTES) {
		return json({ error: "that statement is too large to store" }, { status: 413 })
	}

	const live = await getCurrentBody(env.DB, shareId, filename, "original")
	if (!live) return json({ error: "not found" }, { status: 404 })
	// A stale base means somebody else saved while this page was editing. Saying
	// so beats applying it: the other edit would be gone with nothing to say it
	// ever happened.
	if (typeof payload.baseHash === "string" && payload.baseHash !== live.hash) {
		return json(
			{
				error:
					"this drop changed while you were editing — reload to see it, or share yours as a new drop",
				hash: live.hash,
			},
			{ status: 409 },
		)
	}

	const contentHash = await sha256Hex(body)
	if (contentHash === live.hash) return json({ hash: contentHash, filename, unchanged: true })
	// The same re-check the room does on every save: an edit must not walk banned
	// content back into the store one statement at a time.
	if ((await findBannedHashes(env.DB, [contentHash])).length > 0) {
		return json({ error: "this content is blocked" }, { status: 403 })
	}

	await setCurrent(env.DB, {
		fileId: ref.id,
		shareId,
		body,
		json: modelJson,
		contentHash,
		expiresAt: now + RETENTION_MS,
		now,
	})

	const sessionId =
		typeof payload.sessionId === "string" && SESSION_ID.test(payload.sessionId)
			? payload.sessionId
			: `feel-${now}`
	// The rule the room's autosave follows, applied to a save that is pressed
	// rather than scheduled: one milestone per editing session per hour, holding
	// the state that hour ended in. A statement has no diagram interchange, so
	// there is no layout-only change to tell from a real one — its content hash
	// is its semantic hash.
	await appendMilestone(env.DB, {
		fileId: ref.id,
		body,
		contentHash,
		semanticHash: contentHash,
		sessionId,
		now,
	})

	// A statement's name *is* its expression — it is what the tab strip and the
	// page title show — so unlike every other kind, an edit renames the file.
	const { name, meta } = extractMeta({ kind: "feel", model: doc })
	await setFileLabel(env.DB, ref.id, name, meta)

	return json({ hash: contentHash, filename })
}
