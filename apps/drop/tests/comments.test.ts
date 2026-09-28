/**
 * Review comments: the routes, what they store, and what they refuse.
 *
 * Run against the real migrations (see `d1.ts`), because most of what matters
 * here is a statement about rows — a tombstone keeps its place, a deleted drop
 * takes its comments with it, a counter really counts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Env } from "../src/env.js"
import { deleteDrop, deleteExpired } from "../src/lib/db.js"
import { handleComments } from "../src/routes/comments.js"
import {
	AUTHOR_HEADER,
	type CommentView,
	MAX_COMMENTS_PER_DROP,
	MAX_COMMENT_CHARS,
	MAX_COMMENT_WRITES_PER_HOUR,
	authorIdFromToken,
} from "../src/shared/comments.js"
import { DEMO_SHARE_ID } from "../src/shared/constants.js"
import worker from "../src/worker.js"
import { migratedDb, seedFile } from "./d1.js"
import { SEEDED_FILE, SIMPLE_BPMN } from "./fixtures.js"

const T0 = 1_800_000_000_000

let db: D1Database
let env: Env
/** What the routes asked the room to broadcast, in order. */
let fanned: Array<{ shareId: string; path: string; comment: CommentView }>

function fakeRoom(): DurableObjectNamespace {
	return {
		idFromName: (name: string) => name,
		get: (id: string) => ({
			fetch: async (url: string, init: RequestInit) => {
				fanned.push({
					shareId: id,
					path: new URL(url).pathname,
					comment: JSON.parse(init.body as string) as CommentView,
				})
				return new Response(null, { status: 204 })
			},
		}),
	} as unknown as DurableObjectNamespace
}

beforeEach(() => {
	db = migratedDb()
	fanned = []
	env = { DB: db, ROOM: fakeRoom() } as unknown as Env
	seedFile(db, { body: SIMPLE_BPMN, now: T0, expiresAt: T0 + 1e9 })
})

afterEach(() => {
	vi.unstubAllGlobals()
})

interface Call {
	body?: unknown
	author?: string
	ip?: string
	shareId?: string
	now?: number
}

async function call(
	method: string,
	commentId: string | null,
	{ body, author, ip = "203.0.113.7", shareId = "share1", now = T0 + 1000 }: Call = {},
) {
	const headers: Record<string, string> = { "cf-connecting-ip": ip }
	if (author) headers[AUTHOR_HEADER] = author
	if (body !== undefined) headers["Content-Type"] = "application/json"
	const path = `/drop/api/comments/${shareId}${commentId ? `/${commentId}` : ""}`
	const request = new Request(`https://bpmnkit.com${path}`, {
		method,
		headers,
		...(body !== undefined ? { body: JSON.stringify(body) } : {}),
	})
	const res = await handleComments(request, shareId, commentId, env, now)
	return {
		status: res.status,
		json: (await res.json()) as {
			comment?: CommentView
			comments?: CommentView[]
			authorToken?: string
			error?: string
			code?: string
		},
	}
}

/** Posts a thread and answers the comment and the token it earned. */
async function post(body: Record<string, unknown>, opts: Call = {}) {
	const res = await call("POST", null, {
		body: { filename: SEEDED_FILE, name: "Anna", body: "Looks good", ...body },
		...opts,
	})
	return { ...res, comment: res.json.comment as CommentView, token: res.json.authorToken }
}

describe("creating", () => {
	it("stores a comment on an element and hands back an author token", async () => {
		const res = await post({
			elementId: "task",
			elementLabel: "Do Work",
			body: "Why a service task?",
		})
		expect(res.status).toBe(201)
		expect(res.token).toMatch(/^[1-9A-HJ-NP-Za-km-z]{24}$/)
		expect(res.comment).toMatchObject({
			filename: SEEDED_FILE,
			elementId: "task",
			elementLabel: "Do Work",
			parentId: null,
			authorName: "Anna",
			body: "Why a service task?",
			resolvedAt: null,
		})
		// The page recognises its own comments by this; the server never shows the hash.
		expect(res.comment.authorId).toBe(await authorIdFromToken(res.token as string))
		expect(res.comment).not.toHaveProperty("authorHash")

		const listed = await call("GET", null)
		expect(listed.json.comments).toHaveLength(1)
		expect(listed.json.comments?.[0]).not.toHaveProperty("authorHash")
	})

	it("stores a comment on the file as a whole", async () => {
		const res = await post({})
		expect(res.comment.elementId).toBeNull()
	})

	it("does not issue a second token to a browser that already has one", async () => {
		const first = await post({})
		const second = await post({ body: "Again" }, { author: first.token })
		expect(second.status).toBe(201)
		expect(second.token).toBeUndefined()
		expect(second.comment.authorId).toBe(first.comment.authorId)
	})

	it("puts a reply in its thread whatever anchor the reply claims", async () => {
		const root = await post({ elementId: "task" })
		const reply = await post({
			parentId: root.comment.id,
			elementId: "start",
			filename: "nope.bpmn",
		})
		expect(reply.status).toBe(201)
		expect(reply.comment).toMatchObject({
			parentId: root.comment.id,
			filename: SEEDED_FILE,
			elementId: "task",
		})
	})

	it("refuses a reply to a reply, to a missing thread, and to a deleted one", async () => {
		const root = await post({})
		const reply = await post({ parentId: root.comment.id })
		expect((await post({ parentId: reply.comment.id })).status).toBe(400)
		expect((await post({ parentId: "111111111111" })).status).toBe(404)

		await call("DELETE", root.comment.id, { author: root.token })
		expect((await post({ parentId: root.comment.id })).status).toBe(409)
	})

	it("keeps only the mentions the body really makes", async () => {
		const res = await post({
			body: "@Ben Lee and @carla, have a look",
			mentions: ["Ben Lee", "Carla", "Dora", "Ben Lee", "<script>"],
		})
		expect(res.comment.mentions).toEqual(["Ben Lee", "Carla"])
	})

	it.each([
		["no name", { name: "" }],
		["a name with markup", { name: "<b>x</b>" }],
		["a name that is too long", { name: "x".repeat(41) }],
		["an empty body", { body: "   " }],
		["a body past the limit", { body: "x".repeat(MAX_COMMENT_CHARS + 1) }],
		["a file not in the drop", { filename: "other.bpmn" }],
		["a malformed element id", { elementId: "<svg onload=x>" }],
	])("refuses %s", async (_label, body) => {
		const res = await post(body)
		expect(res.status).toBe(400)
		expect(res.json.error).toBeTruthy()
	})

	it("takes element comments on a diagram only", async () => {
		seedFile(db, {
			shareId: "share2",
			fileId: "file2",
			filename: "pricing.dmn",
			kind: "dmn",
			now: T0,
		})
		const onElement = await post(
			{ filename: "pricing.dmn", elementId: "Decision_price" },
			{ shareId: "share2" },
		)
		expect(onElement.status).toBe(400)
		const whole = await post({ filename: "pricing.dmn" }, { shareId: "share2" })
		expect(whole.status).toBe(201)
	})
})

describe("what may be annotated", () => {
	it("refuses the demo and a pinned drop, and lists nothing for the demo", async () => {
		expect((await post({}, { shareId: DEMO_SHARE_ID })).status).toBe(403)
		expect((await call("GET", null, { shareId: DEMO_SHARE_ID })).json.comments).toEqual([])

		seedFile(db, { shareId: "pinned", fileId: "pf", body: SIMPLE_BPMN, expiresAt: null })
		const pinned = await post({}, { shareId: "pinned" })
		expect(pinned.status).toBe(403)
		expect(pinned.json.error).toMatch(/pinned/)
	})

	it("answers 404 for a drop that does not exist", async () => {
		expect((await post({}, { shareId: "nope" })).status).toBe(404)
		expect((await call("GET", null, { shareId: "nope" })).status).toBe(404)
	})

	it("takes no more comments once the drop's content is banned", async () => {
		await db
			.prepare(
				"INSERT INTO banned_hashes (content_hash, reason, created_at) VALUES (?, 'policy', ?)",
			)
			.bind("hash-original", T0)
			.run()
		const res = await post({})
		expect(res.status).toBe(403)
		expect(res.json.error).toMatch(/blocked/)
	})
})

describe("abuse limits", () => {
	it("rate-limits writes per address per hour, and not across addresses", async () => {
		for (let i = 0; i < MAX_COMMENT_WRITES_PER_HOUR; i++) {
			expect((await post({ body: `#${i}` })).status).toBe(201)
		}
		expect((await post({ body: "one too many" })).status).toBe(429)
		expect((await post({ body: "someone else" }, { ip: "198.51.100.1" })).status).toBe(201)
		// The allowance is per hour.
		expect((await post({ body: "later" }, { now: T0 + 3_600_000 })).status).toBe(201)
	})

	it("stops at the per-drop cap", async () => {
		const statements = Array.from({ length: MAX_COMMENTS_PER_DROP }, (_, i) =>
			db
				.prepare(
					`INSERT INTO comments (id, drop_id, filename, author_name, author_hash, body, created_at)
					 VALUES (?, 'share1', ?, 'Bot', 'h', 'x', ?)`,
				)
				.bind(`c${String(i).padStart(11, "0")}`, SEEDED_FILE, T0),
		)
		await db.batch(statements)
		const res = await post({})
		expect(res.status).toBe(409)
		expect(res.json.error).toMatch(/limit/)
	})

	describe("with Turnstile configured", () => {
		function siteverify(success: boolean) {
			const calls: string[] = []
			vi.stubGlobal("fetch", async (_url: string, init: { body: FormData }) => {
				calls.push(String((init.body as FormData).get("response")))
				return new Response(JSON.stringify({ success }), { status: 200 })
			})
			return calls
		}

		beforeEach(() => {
			env = { ...env, TURNSTILE_SECRET: "sekret" } as Env
		})

		it("challenges the first comment and not the ones after it", async () => {
			const calls = siteverify(true)
			const refused = await post({})
			expect(refused.status).toBe(403)
			expect(refused.json.code).toBe("unverified")

			const first = await post({ token: "good" })
			expect(first.status).toBe(201)
			const second = await post({ body: "no challenge" }, { author: first.token })
			expect(second.status).toBe(201)
			// A missing token is refused without asking Cloudflare about it.
			expect(calls).toEqual(["good"])
		})

		it("refuses a token Cloudflare does not accept", async () => {
			siteverify(false)
			expect((await post({ token: "forged" })).status).toBe(403)
		})

		it("does not let a token from another drop stand in for a challenge", async () => {
			siteverify(true)
			seedFile(db, { shareId: "share2", fileId: "file2", body: SIMPLE_BPMN, now: T0 })
			const elsewhere = await post({ token: "good" }, { shareId: "share2" })
			const res = await post({}, { author: elsewhere.token })
			expect(res.status).toBe(403)
			expect(res.json.code).toBe("unknown-author")
		})
	})
})

describe("your own comments", () => {
	it("lets the author edit, and nobody else", async () => {
		const anna = await post({ body: "first draft" })
		const ben = await post({ name: "Ben", body: "hi" }, { ip: "198.51.100.1" })

		const byBen = await call("PATCH", anna.comment.id, {
			author: ben.token,
			body: { body: "hijacked" },
		})
		expect(byBen.status).toBe(403)
		const anon = await call("PATCH", anna.comment.id, { body: { body: "hijacked" } })
		expect(anon.status).toBe(403)
		expect(anon.json.code).toBe("unknown-author")

		const byAnna = await call("PATCH", anna.comment.id, {
			author: anna.token,
			body: { body: "second draft, @Ben", mentions: ["Ben"] },
		})
		expect(byAnna.status).toBe(200)
		expect(byAnna.json.comment).toMatchObject({ body: "second draft, @Ben", mentions: ["Ben"] })
		expect(byAnna.json.comment?.editedAt).not.toBeNull()
	})

	it("deletes to a tombstone, which keeps the thread its replies are in", async () => {
		const root = await post({ body: "question" })
		await post({ parentId: root.comment.id, name: "Ben", body: "answer" }, { ip: "198.51.100.1" })

		const other = await post({ name: "Ben", body: "x" }, { ip: "198.51.100.1" })
		expect((await call("DELETE", root.comment.id, { author: other.token })).status).toBe(403)

		const res = await call("DELETE", root.comment.id, { author: root.token })
		expect(res.status).toBe(200)
		expect(res.json.comment).toMatchObject({ body: "", mentions: [] })
		expect(res.json.comment?.deletedAt).not.toBeNull()

		const listed = (await call("GET", null)).json.comments ?? []
		expect(listed.find((c) => c.id === root.comment.id)?.body).toBe("")
		expect(listed.filter((c) => c.parentId === root.comment.id)).toHaveLength(1)
		// Deleted is final.
		const again = await call("PATCH", root.comment.id, {
			author: root.token,
			body: { body: "back" },
		})
		expect(again.status).toBe(409)
	})
})

describe("resolving", () => {
	it("lets any author of the drop resolve and reopen a thread", async () => {
		const anna = await post({ elementId: "task" })
		const ben = await post({ name: "Ben", body: "+1" }, { ip: "198.51.100.1" })

		const resolved = await call("PATCH", anna.comment.id, {
			author: ben.token,
			body: { resolved: true, name: "Ben" },
		})
		expect(resolved.status).toBe(200)
		expect(resolved.json.comment).toMatchObject({ resolvedBy: "Ben" })
		expect(resolved.json.comment?.resolvedAt).not.toBeNull()

		const reopened = await call("PATCH", anna.comment.id, {
			author: anna.token,
			body: { resolved: false },
		})
		expect(reopened.json.comment).toMatchObject({ resolvedAt: null, resolvedBy: null })
	})

	it("needs an author of this drop, a name, and a thread rather than a reply", async () => {
		const root = await post({})
		const reply = await post({ parentId: root.comment.id }, { author: root.token })
		expect(
			(await call("PATCH", root.comment.id, { body: { resolved: true, name: "X" } })).status,
		).toBe(403)
		expect(
			(await call("PATCH", root.comment.id, { author: root.token, body: { resolved: true } }))
				.status,
		).toBe(400)
		const onReply = await call("PATCH", reply.comment.id, {
			author: root.token,
			body: { resolved: true, name: "Anna" },
		})
		expect(onReply.status).toBe(400)
	})
})

describe("live delivery", () => {
	it("hands every stored change to the drop's room, without the author hash", async () => {
		const root = await post({ elementId: "task" })
		await call("PATCH", root.comment.id, {
			author: root.token,
			body: { resolved: true, name: "Anna" },
		})
		await call("DELETE", root.comment.id, { author: root.token })

		expect(fanned.map((f) => f.shareId)).toEqual(["share1", "share1", "share1"])
		expect(new Set(fanned.map((f) => f.path))).toEqual(new Set(["/internal/comment"]))
		expect(fanned[0]?.comment).toMatchObject({ id: root.comment.id, elementId: "task" })
		expect(fanned[1]?.comment.resolvedBy).toBe("Anna")
		expect(fanned[2]?.comment.deletedAt).not.toBeNull()
		for (const f of fanned) expect(f.comment).not.toHaveProperty("authorHash")
	})

	it("keeps the comment when the room cannot be reached", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {})
		env = {
			...env,
			ROOM: {
				idFromName: (n: string) => n,
				get: () => ({
					fetch: async () => {
						throw new Error("room down")
					},
				}),
			} as unknown as DurableObjectNamespace,
		}
		expect((await post({})).status).toBe(201)
		expect((await call("GET", null)).json.comments).toHaveLength(1)
		expect(error).toHaveBeenCalled()
		error.mockRestore()
	})

	it("is not announced for a refused write", async () => {
		await post({ body: "" })
		expect(fanned).toEqual([])
	})
})

describe("retention", () => {
	it("deleting a drop deletes its comments and authors", async () => {
		await post({})
		expect(await deleteDrop(db, "share1", { ban: false, now: T0 })).toBe(true)
		const left = await db
			.prepare(
				"SELECT (SELECT COUNT(*) FROM comments) + (SELECT COUNT(*) FROM comment_authors) AS n",
			)
			.first<{ n: number }>()
		expect(left?.n).toBe(0)
	})

	it("an expired drop takes its comments with it", async () => {
		await post({})
		await deleteExpired(db, T0 + 2e9)
		const left = await db.prepare("SELECT COUNT(*) AS n FROM comments").first<{ n: number }>()
		expect(left?.n).toBe(0)
	})
})

describe("routing", () => {
	const fetchWorker = (path: string, init?: RequestInit) =>
		(worker.fetch as (r: Request, e: Env) => Promise<Response>)(
			new Request(`https://bpmnkit.com${path}`, init),
			env,
		)

	it("serves the comment routes and refuses other methods", async () => {
		expect((await fetchWorker("/drop/api/comments/share1")).status).toBe(200)
		expect((await fetchWorker("/drop/api/comments/share1", { method: "PUT" })).status).toBe(405)
		expect((await fetchWorker("/drop/api/comments/share1/abc", { method: "GET" })).status).toBe(405)
	})

	it("never forwards the room's internal comment path from outside", async () => {
		const res = await fetchWorker("/drop/api/presence/share1/internal/comment", {
			method: "POST",
			body: "{}",
		})
		expect(res.status).toBe(404)
		expect(fanned).toEqual([])
	})
})
