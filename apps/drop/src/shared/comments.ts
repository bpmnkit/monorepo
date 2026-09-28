/**
 * Review comments: the shape both ends agree on, and the rules both apply.
 *
 * Shared by the Worker and the browser bundle, so the limits the composer shows
 * are the limits the route enforces. No DOM and no Worker APIs.
 *
 * **Identity without accounts.** A commenter is two things, neither of them an
 * account: a display name they typed, and a random *author token* the server
 * hands back on their first comment in a drop and the browser keeps. The token
 * is what makes "edit or delete your own comment" enforceable — the server
 * stores only its hash — and it is per drop, so a script that solves one
 * challenge has earned one drop's worth of comments, not the whole site's.
 * The name is self-asserted and proves nothing; two people can both call
 * themselves Anna.
 */

/** Longest comment body, in characters. */
export const MAX_COMMENT_CHARS = 2_000

/** Longest display name, in characters. */
export const MAX_NAME_CHARS = 40

/** Most comments (threads and replies, deleted ones included) one drop may hold. */
export const MAX_COMMENTS_PER_DROP = 500

/** Most comment writes (create, edit, resolve, delete) one address may make in an hour. */
export const MAX_COMMENT_WRITES_PER_HOUR = 60

/** Most distinct people one comment may mention. */
export const MAX_MENTIONS = 10

/** Longest element label kept with an anchor, so a removed element can still be named. */
export const MAX_LABEL_CHARS = 120

/** localStorage key for the name this browser comments and appears under. */
export const NAME_STORAGE_KEY = "bpmnkit-drop-name"

/** localStorage key for this browser's author tokens, one per drop. */
export const AUTHOR_STORAGE_KEY = "bpmnkit-drop-comment-authors"

/** The request header an author token travels in. */
export const AUTHOR_HEADER = "X-Drop-Author"

/**
 * A display name: a letter or digit first, then letters, digits, spaces and
 * `. _ ' -`. Narrow on purpose — no `@`, so a mention always ends where the
 * name does, and nothing that could read as markup even before escaping.
 */
const NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u

/** An element id, as BPMN writes them (an XML NCName, bounded). */
const ELEMENT_ID = /^[A-Za-z_][\w.-]{0,127}$/

/** An author token: 24 base58 characters, about 140 bits. */
const AUTHOR_TOKEN = /^[1-9A-HJ-NP-Za-km-z]{24}$/

/** A comment id, as `randomBase58(12)` mints them. */
const COMMENT_ID = /^[1-9A-HJ-NP-Za-km-z]{12}$/

/** A name tidied (trimmed, inner whitespace collapsed), or null when it is not one. */
export function normaliseName(raw: unknown): string | null {
	if (typeof raw !== "string") return null
	const name = raw.trim().replace(/\s+/g, " ")
	if (name.length === 0 || name.length > MAX_NAME_CHARS) return null
	return NAME.test(name) ? name : null
}

export function isElementId(value: unknown): value is string {
	return typeof value === "string" && ELEMENT_ID.test(value)
}

export function isAuthorToken(value: unknown): value is string {
	return typeof value === "string" && AUTHOR_TOKEN.test(value)
}

export function isCommentId(value: unknown): value is string {
	return typeof value === "string" && COMMENT_ID.test(value)
}

/**
 * The mentions a comment really makes: the names asked for that actually
 * appear in the body as `@name`, normalised and de-duplicated.
 *
 * The composer says who it meant, because a name may contain spaces and the
 * text alone cannot say where one ends; the body is what keeps it honest.
 */
export function confirmMentions(body: string, asked: unknown): string[] {
	if (!Array.isArray(asked)) return []
	const lower = body.toLowerCase()
	const out: string[] = []
	for (const raw of asked) {
		const name = normaliseName(raw)
		if (!name || !lower.includes(`@${name.toLowerCase()}`)) continue
		if (out.some((n) => n.toLowerCase() === name.toLowerCase())) continue
		out.push(name)
		if (out.length === MAX_MENTIONS) break
	}
	return out
}

/** Whether a comment mentions `name`. Case-insensitive, as names are typed by hand. */
export function mentions(comment: Pick<CommentView, "mentions">, name: string | null): boolean {
	if (!name) return false
	const target = name.toLowerCase()
	return comment.mentions.some((m) => m.toLowerCase() === target)
}

async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
	let hex = ""
	for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, "0")
	return hex
}

/** What the server stores for a token: its hash, never the token. */
export function authorHash(token: string): Promise<string> {
	return sha256Hex(token)
}

/**
 * The public face of an author: a hash of the stored hash.
 *
 * Published on every comment so a browser can tell which ones are its own
 * without the server knowing who is asking — and so a live update carries the
 * same answer to everyone. Knowing it gives nothing: it is two hashes away from
 * the token that authorises a write.
 */
export async function authorIdFromHash(hash: string): Promise<string> {
	return (await sha256Hex(hash)).slice(0, 16)
}

/** The public author id a token belongs to — what a browser compares against. */
export async function authorIdFromToken(token: string): Promise<string> {
	return authorIdFromHash(await authorHash(token))
}

/** One comment as the page sees it. A reply has a `parentId` and no anchor of its own. */
export interface CommentView {
	id: string
	filename: string
	/** The element it is on; null for the file as a whole. Replies carry their thread's. */
	elementId: string | null
	/** The element's name when the comment was made, for when it is gone. */
	elementLabel: string | null
	parentId: string | null
	authorName: string
	/** See {@link authorIdFromHash}. */
	authorId: string
	/** Empty once deleted. */
	body: string
	mentions: string[]
	createdAt: number
	editedAt: number | null
	/** Set when the author deleted it. Kept as a tombstone so its replies keep a thread. */
	deletedAt: number | null
	/** Threads only. */
	resolvedAt: number | null
	resolvedBy: string | null
}
