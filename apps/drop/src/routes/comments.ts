/**
 * Review comments on a drop.
 *
 * ```
 * GET    /drop/api/comments/:shareId         every comment on the drop
 * POST   /drop/api/comments/:shareId         a new thread, or a reply
 * PATCH  /drop/api/comments/:shareId/:id     edit your own; resolve or reopen a thread
 * DELETE /drop/api/comments/:shareId/:id     delete your own
 * ```
 *
 * Writes pass the gates an edit does, in the same order of cost: the demo has
 * no row to write to and a pinned drop is nobody's to annotate; content on the
 * ban list takes no more writes; an address gets a bounded number of writes an
 * hour. Then the challenge — but only once per browser per drop, because what
 * a passed challenge earns is an **author token**, and a request carrying one
 * this drop issued is not asked again. That is the claim's rule restated for
 * comments: invisible to a person leaving five of them, a real cost to a
 * script that wants to leave one on every drop it can find.
 *
 * The token is also the whole of "your own". Only its hash is stored; editing
 * or deleting a comment needs the token that made it. Resolving a thread is
 * open to any author of the drop — it is a reversible statement about the
 * review, not about the comment, and Web Modeler draws the line in the same
 * place.
 *
 * Stored first, then fanned out: D1 is where comments live, and the room only
 * tells whoever is connected. A room that cannot be reached costs live
 * delivery, never the comment.
 */
import type { Env } from "../env.js"
import {
	type StoredComment,
	addAuthor,
	countComments,
	countWrite,
	editComment,
	getComment,
	insertComment,
	isKnownAuthor,
	listComments,
	setResolved,
	toView,
	tombstoneComment,
} from "../lib/comments.js"
import { currentHashes, findBannedHashes, getDrop } from "../lib/db.js"
import { isDemo } from "../lib/demo.js"
import { clientIp, json } from "../lib/http.js"
import { hashIp, randomBase58 } from "../lib/ids.js"
import { verifyTurnstile } from "../lib/turnstile.js"
import { ROOM_COMMENT_PATH } from "../room.js"
import {
	AUTHOR_HEADER,
	type CommentView,
	MAX_COMMENTS_PER_DROP,
	MAX_COMMENT_CHARS,
	MAX_COMMENT_WRITES_PER_HOUR,
	MAX_LABEL_CHARS,
	authorHash,
	confirmMentions,
	isAuthorToken,
	isCommentId,
	isElementId,
	normaliseName,
} from "../shared/comments.js"

type Found = NonNullable<Awaited<ReturnType<typeof getDrop>>>

function fail(status: number, error: string, code?: string): Response {
	return json(code ? { error, code } : { error }, { status })
}

/** A comment body, trimmed, or the reason it is not one. */
function readBody(raw: unknown): { ok: true; body: string } | { ok: false; error: Response } {
	if (typeof raw !== "string" || raw.trim().length === 0) {
		return { ok: false, error: fail(400, "a comment needs some text") }
	}
	const body = raw.trim()
	if (body.length > MAX_COMMENT_CHARS) {
		return { ok: false, error: fail(400, `a comment is at most ${MAX_COMMENT_CHARS} characters`) }
	}
	return { ok: true, body }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
	const parsed = (await request.json().catch(() => null)) as unknown
	return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
		? (parsed as Record<string, unknown>)
		: null
}

/** Tells everyone in the drop's room. Best effort — see the file comment. */
async function fanOut(env: Env, shareId: string, comment: CommentView): Promise<void> {
	try {
		const stub = env.ROOM.get(env.ROOM.idFromName(shareId))
		await stub.fetch(`https://room${ROOM_COMMENT_PATH}`, {
			method: "POST",
			body: JSON.stringify(comment),
		})
	} catch (err) {
		console.error("comment fan-out failed", shareId, err)
	}
}

/**
 * The gates every write passes before its payload is read: the drop exists,
 * may be annotated, is not banned, and this address has writes left this hour.
 */
async function gate(
	request: Request,
	shareId: string,
	env: Env,
	now: number,
): Promise<{ ok: true; found: Found } | { ok: false; error: Response }> {
	if (isDemo(shareId)) {
		return {
			ok: false,
			error: fail(403, "the demo drop is read-only — drop a copy of it to comment on your own"),
		}
	}
	const found = await getDrop(env.DB, shareId)
	if (!found) return { ok: false, error: fail(404, "not found") }
	if (found.drop.expires_at === null) {
		return { ok: false, error: fail(403, "this drop is pinned by an operator and is read-only") }
	}
	if ((await findBannedHashes(env.DB, await currentHashes(env.DB, shareId))).length > 0) {
		return { ok: false, error: fail(403, "this content is blocked") }
	}

	const ipHash = env.REPORT_IP_SALT
		? await hashIp(clientIp(request), env.REPORT_IP_SALT)
		: clientIp(request)
	if (
		(await countWrite(env.DB, ipHash, Math.floor(now / 3_600_000))) > MAX_COMMENT_WRITES_PER_HOUR
	) {
		return { ok: false, error: fail(429, "too many comments from here — try again later") }
	}
	return { ok: true, found }
}

/** The hash of the request's author token, when it carries one this drop issued. */
async function knownAuthor(
	request: Request,
	shareId: string,
	env: Env,
): Promise<string | null | "unknown"> {
	const token = request.headers.get(AUTHOR_HEADER)
	if (token === null) return null
	if (!isAuthorToken(token)) return "unknown"
	const hash = await authorHash(token)
	return (await isKnownAuthor(env.DB, shareId, hash)) ? hash : "unknown"
}

const UNKNOWN_AUTHOR = () =>
	fail(403, "this browser's comment key is not one this drop knows", "unknown-author")

/** Routes `/drop/api/comments/:shareId[/:commentId]`. */
export async function handleComments(
	request: Request,
	shareId: string,
	commentId: string | null,
	env: Env,
	now: number,
): Promise<Response> {
	if (commentId === null) {
		if (request.method === "GET") return list(shareId, env)
		if (request.method === "POST") return create(request, shareId, env, now)
	} else {
		if (request.method === "PATCH") return update(request, shareId, commentId, env, now)
		if (request.method === "DELETE") return remove(request, shareId, commentId, env, now)
	}
	return fail(405, "method not allowed")
}

async function list(shareId: string, env: Env): Promise<Response> {
	if (isDemo(shareId)) return json({ comments: [] })
	if (!(await getDrop(env.DB, shareId))) return fail(404, "not found")
	return json({ comments: (await listComments(env.DB, shareId)).map(toView) })
}

async function create(request: Request, shareId: string, env: Env, now: number): Promise<Response> {
	const gated = await gate(request, shareId, env, now)
	if (!gated.ok) return gated.error
	const payload = await readJson(request)
	if (!payload) return fail(400, "expected a JSON body")

	const name = normaliseName(payload.name)
	if (!name) return fail(400, "a name is 1–40 letters, digits, spaces or . _ ' -")
	const read = readBody(payload.body)
	if (!read.ok) return read.error

	// A reply lives in its thread: same file, same element, whatever it says.
	let filename: string
	let elementId: string | null = null
	let elementLabel: string | null = null
	let parentId: string | null = null
	if (payload.parentId !== undefined && payload.parentId !== null) {
		const parent = isCommentId(payload.parentId)
			? await getComment(env.DB, shareId, payload.parentId)
			: null
		if (!parent) return fail(404, "that thread is not on this drop")
		if (parent.parentId !== null) return fail(400, "replies go on the thread, not on a reply")
		if (parent.deletedAt !== null) return fail(409, "that comment was deleted")
		;({ filename, elementId, elementLabel } = parent)
		parentId = parent.id
	} else {
		const file = gated.found.files.find((f) => f.filename === payload.filename)
		if (!file) return fail(400, "that file is not in this drop")
		filename = file.filename
		if (payload.elementId !== undefined && payload.elementId !== null) {
			// Only a diagram has elements a marker can sit on; everything else is
			// commented on as a whole.
			if (file.kind !== "bpmn") return fail(400, "only a BPMN file takes comments on elements")
			if (!isElementId(payload.elementId)) return fail(400, "that is not an element id")
			elementId = payload.elementId
			elementLabel =
				typeof payload.elementLabel === "string" && payload.elementLabel.trim()
					? payload.elementLabel.trim().slice(0, MAX_LABEL_CHARS)
					: null
		}
	}

	if ((await countComments(env.DB, shareId)) >= MAX_COMMENTS_PER_DROP) {
		return fail(409, `this drop has reached its ${MAX_COMMENTS_PER_DROP}-comment limit`)
	}

	// Last, because it is the one gate that costs a round trip to Cloudflare.
	const known = await knownAuthor(request, shareId, env)
	if (known === "unknown") return UNKNOWN_AUTHOR()
	let hash = known
	let issued: string | null = null
	if (hash === null) {
		const secret = env.TURNSTILE_SECRET
		if (secret) {
			const token = typeof payload.token === "string" ? payload.token : ""
			if (!(await verifyTurnstile(secret, token, clientIp(request)))) {
				return fail(403, "that check did not go through", "unverified")
			}
		}
		issued = randomBase58(24)
		hash = await authorHash(issued)
		await addAuthor(env.DB, shareId, hash, now)
	}

	const stored: Omit<StoredComment, "authorId"> = {
		id: randomBase58(12),
		filename,
		elementId,
		elementLabel,
		parentId,
		authorName: name,
		authorHash: hash,
		body: read.body,
		mentions: confirmMentions(read.body, payload.mentions),
		createdAt: now,
		editedAt: null,
		deletedAt: null,
		resolvedAt: null,
		resolvedBy: null,
	}
	await insertComment(env.DB, shareId, stored)
	const view = toView((await getComment(env.DB, shareId, stored.id)) as StoredComment)
	await fanOut(env, shareId, view)
	return json({ comment: view, ...(issued ? { authorToken: issued } : {}) }, { status: 201 })
}

/** The comment a PATCH or DELETE is about, and the author asking. */
async function target(
	request: Request,
	shareId: string,
	commentId: string,
	env: Env,
): Promise<{ ok: true; comment: StoredComment; author: string } | { ok: false; error: Response }> {
	const author = await knownAuthor(request, shareId, env)
	if (author === null || author === "unknown") return { ok: false, error: UNKNOWN_AUTHOR() }
	const comment = isCommentId(commentId) ? await getComment(env.DB, shareId, commentId) : null
	if (!comment) return { ok: false, error: fail(404, "not found") }
	if (comment.deletedAt !== null) return { ok: false, error: fail(409, "that comment was deleted") }
	return { ok: true, comment, author }
}

async function update(
	request: Request,
	shareId: string,
	commentId: string,
	env: Env,
	now: number,
): Promise<Response> {
	const gated = await gate(request, shareId, env, now)
	if (!gated.ok) return gated.error
	const found = await target(request, shareId, commentId, env)
	if (!found.ok) return found.error
	const { comment, author } = found
	const payload = await readJson(request)
	if (!payload) return fail(400, "expected a JSON body")

	if (payload.body !== undefined) {
		if (comment.authorHash !== author) return fail(403, "only its author can edit a comment")
		const read = readBody(payload.body)
		if (!read.ok) return read.error
		await editComment(
			env.DB,
			comment.id,
			read.body,
			confirmMentions(read.body, payload.mentions),
			now,
		)
	} else if (typeof payload.resolved === "boolean") {
		if (comment.parentId !== null) return fail(400, "a thread is resolved, not a reply")
		const name = normaliseName(payload.name)
		if (payload.resolved && !name) return fail(400, "say who is resolving it")
		await setResolved(env.DB, comment.id, payload.resolved ? name : null, now)
	} else {
		return fail(400, "nothing to change")
	}

	const view = toView((await getComment(env.DB, shareId, comment.id)) as StoredComment)
	await fanOut(env, shareId, view)
	return json({ comment: view })
}

async function remove(
	request: Request,
	shareId: string,
	commentId: string,
	env: Env,
	now: number,
): Promise<Response> {
	const gated = await gate(request, shareId, env, now)
	if (!gated.ok) return gated.error
	const found = await target(request, shareId, commentId, env)
	if (!found.ok) return found.error
	if (found.comment.authorHash !== found.author) {
		return fail(403, "only its author can delete a comment")
	}
	await tombstoneComment(env.DB, found.comment.id, now)
	const view = toView((await getComment(env.DB, shareId, found.comment.id)) as StoredComment)
	await fanOut(env, shareId, view)
	return json({ comment: view })
}
