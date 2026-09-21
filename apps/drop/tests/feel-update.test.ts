/**
 * Saving a statement back to the drop that shares it.
 *
 * The share page's editor is local until Save is pressed, so this is the whole
 * of what a save can do — and, more to the point, the whole of what it must
 * refuse: a stale base, an expression that does not parse, a drop nobody is
 * meant to rewrite. The version log's promise has to survive it too, which is
 * why the milestone and the untouched original are asserted here rather than
 * left to the version tests.
 */
import { beforeEach, describe, expect, it } from "vitest"
import type { Env } from "../src/env.js"
import { getCurrentBody, getFileRef } from "../src/lib/db.js"
import { sha256Hex } from "../src/lib/ids.js"
import { getVersionBody } from "../src/lib/versions.js"
import { handleFeelUpdate } from "../src/routes/feel.js"
import { DEMO_SHARE_ID } from "../src/shared/constants.js"
import { type FeelDocument, serializeFeelDocument } from "../src/shared/feel-doc.js"
import { migratedDb, milestoneCount, seedFile } from "./d1.js"

const T0 = 1_800_000_000_000

const STORED: FeelDocument = {
	expression: "order.amount * (1 + vat)",
	context: { order: { amount: 100 }, vat: 0.19 },
	mode: "expression",
}

const EDITED: FeelDocument = {
	expression: "order.amount * (1 + vat)",
	context: { order: { amount: 250 }, vat: 0.19 },
	mode: "expression",
}

let db: D1Database
let env: Env
let baseHash: string

/** A drop holding one FEEL statement, stored exactly as an upload stores it. */
async function seedFeel(opts: { expiresAt?: number | null } = {}) {
	const body = serializeFeelDocument(STORED)
	baseHash = await sha256Hex(body)
	return seedFile(db, {
		filename: "expression.feel",
		kind: "feel",
		body,
		json: JSON.stringify(STORED),
		hash: baseHash,
		now: T0,
		...opts,
	})
}

function save(
	shareId: string,
	filename: string,
	payload: Record<string, unknown>,
	now = T0 + 60_000,
): Promise<Response> {
	const request = new Request(`https://bpmnkit.com/drop/${shareId}/feel/${filename}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	})
	return handleFeelUpdate(request, shareId, filename, env, now)
}

beforeEach(async () => {
	db = migratedDb()
	env = { DB: db } as unknown as Env
	await seedFeel()
})

describe("saving a statement", () => {
	it("replaces the document and answers the hash the next save is based on", async () => {
		const res = await save("share1", "expression.feel", { document: EDITED, baseHash })
		expect(res.status).toBe(200)

		const body = serializeFeelDocument(EDITED)
		const { hash } = (await res.json()) as { hash: string }
		expect(hash).toBe(await sha256Hex(body))

		const live = await getCurrentBody(db, "share1", "expression.feel", "original")
		expect(live?.body).toBe(body)
		expect(live?.hash).toBe(hash)
	})

	it("stores the JSON model beside it, so the share page reads the new statement", async () => {
		await save("share1", "expression.feel", { document: EDITED, baseHash })
		const model = await getCurrentBody(db, "share1", "expression.feel", "json")
		expect(JSON.parse(model?.body ?? "null")).toEqual(EDITED)
	})

	it("renames the file, because a statement's name is its expression", async () => {
		await save("share1", "expression.feel", {
			document: { expression: "1 + 1", context: {}, mode: "expression" },
			baseHash,
		})
		const row = await db
			.prepare("SELECT name, meta FROM files WHERE drop_id = ?")
			.bind("share1")
			.first<{ name: string; meta: string }>()
		expect(row?.name).toBe("1 + 1")
		expect(JSON.parse(row?.meta ?? "{}")).toEqual({ variables: 0, feelMode: "expression" })
	})

	it("cuts a milestone for the saved state, and leaves the upload untouched", async () => {
		await save("share1", "expression.feel", { document: EDITED, baseHash })
		const ref = await getFileRef(db, "share1", "expression.feel")
		expect(await milestoneCount(db, ref?.id ?? "")).toBe(1)
		expect((await getVersionBody(db, ref?.id ?? "", 1))?.body).toBe(serializeFeelDocument(EDITED))

		// The state before the edit is still reachable as `?v=0`, forever.
		const original = await db
			.prepare("SELECT body FROM file_content WHERE file_id = ? AND rep = 'original'")
			.bind(ref?.id)
			.first<{ body: string }>()
		expect(original?.body).toBe(serializeFeelDocument(STORED))
	})

	it("slides retention forward, as viewing does", async () => {
		const now = T0 + 60_000
		await save("share1", "expression.feel", { document: EDITED, baseHash }, now)
		const row = await db
			.prepare("SELECT updated_at, expires_at FROM drops WHERE id = ?")
			.bind("share1")
			.first<{ updated_at: number; expires_at: number }>()
		expect(row?.updated_at).toBe(now)
		expect(row?.expires_at).toBeGreaterThan(now)
	})

	it("writes nothing when the statement is the one already stored", async () => {
		const res = await save("share1", "expression.feel", { document: STORED, baseHash })
		expect(res.status).toBe(200)
		expect((await res.json()) as { unchanged?: boolean }).toMatchObject({ unchanged: true })
		const ref = await getFileRef(db, "share1", "expression.feel")
		expect(await milestoneCount(db, ref?.id ?? "")).toBe(0)
	})

	it("collapses a session's saves into one milestone, and a new session starts another", async () => {
		await save("share1", "expression.feel", { document: EDITED, baseHash, sessionId: "tab-1" })
		const second = { ...EDITED, expression: "order.amount * vat" }
		const hash = await sha256Hex(serializeFeelDocument(EDITED))
		await save("share1", "expression.feel", {
			document: second,
			baseHash: hash,
			sessionId: "tab-1",
		})
		const ref = await getFileRef(db, "share1", "expression.feel")
		expect(await milestoneCount(db, ref?.id ?? "")).toBe(1)
		// Collapsed, not dropped: the one row holds where the session got to.
		expect((await getVersionBody(db, ref?.id ?? "", 1))?.body).toBe(serializeFeelDocument(second))

		await save("share1", "expression.feel", {
			document: STORED,
			baseHash: await sha256Hex(serializeFeelDocument(second)),
			sessionId: "tab-2",
		})
		expect(await milestoneCount(db, ref?.id ?? "")).toBe(2)
	})
})

describe("what a save is refused for", () => {
	it("a base that is no longer current — and the drop is left alone", async () => {
		const res = await save("share1", "expression.feel", {
			document: EDITED,
			baseHash: "somebody-else-saved",
		})
		expect(res.status).toBe(409)
		expect((await res.json()) as { hash: string }).toMatchObject({ hash: baseHash })

		const live = await getCurrentBody(db, "share1", "expression.feel", "original")
		expect(live?.body).toBe(serializeFeelDocument(STORED))
	})

	it("an expression that does not parse, naming what is wrong", async () => {
		const res = await save("share1", "expression.feel", {
			document: { expression: "1 +", context: {}, mode: "expression" },
			baseHash,
		})
		expect(res.status).toBe(400)
		expect(((await res.json()) as { error: string }).error).not.toBe("")
	})

	it("a context that is not an object of variables", async () => {
		const res = await save("share1", "expression.feel", {
			document: { expression: "1", context: [1, 2], mode: "expression" },
			baseHash,
		})
		expect(res.status).toBe(400)
		expect(((await res.json()) as { error: string }).error).toMatch(/context/)
	})

	it("a body that is not a document at all", async () => {
		expect((await save("share1", "expression.feel", { document: "1 + 1" })).status).toBe(400)
		expect((await save("share1", "expression.feel", {})).status).toBe(400)
	})

	it("a drop an operator pinned", async () => {
		db = migratedDb()
		env = { DB: db } as unknown as Env
		await seedFeel({ expiresAt: null })
		const res = await save("share1", "expression.feel", { document: EDITED, baseHash })
		expect(res.status).toBe(403)
	})

	it("the demo, which has no row to write to", async () => {
		const res = await save(DEMO_SHARE_ID, "expression.feel", { document: EDITED })
		expect(res.status).toBe(403)
	})

	it("a drop or a file that is not there", async () => {
		expect((await save("nosuch", "expression.feel", { document: EDITED })).status).toBe(404)
		expect((await save("share1", "nosuch.feel", { document: EDITED })).status).toBe(404)
	})

	it("a file that is not a statement — the room's ops are what edits those", async () => {
		db = migratedDb()
		env = { DB: db } as unknown as Env
		seedFile(db, { now: T0 })
		const res = await save("share1", "order.bpmn", { document: EDITED })
		expect(res.status).toBe(400)
	})

	it("content that has been banned, so an edit cannot walk it back in", async () => {
		const banned = await sha256Hex(serializeFeelDocument(EDITED))
		await db
			.prepare("INSERT INTO banned_hashes (content_hash, created_at) VALUES (?, ?)")
			.bind(banned, T0)
			.run()
		const res = await save("share1", "expression.feel", { document: EDITED, baseHash })
		expect(res.status).toBe(403)
		const live = await getCurrentBody(db, "share1", "expression.feel", "original")
		expect(live?.body).toBe(serializeFeelDocument(STORED))
	})

	it("a missing Turnstile token, where the deployment asks for one", async () => {
		env = { DB: db, TURNSTILE_SECRET: "secret" } as unknown as Env
		const res = await save("share1", "expression.feel", { document: EDITED, baseHash })
		expect(res.status).toBe(403)
		const live = await getCurrentBody(db, "share1", "expression.feel", "original")
		expect(live?.body).toBe(serializeFeelDocument(STORED))
	})
})
