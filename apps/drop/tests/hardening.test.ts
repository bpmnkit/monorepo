/**
 * What a mutable drop breaks, and what puts it back.
 *
 * Every check Drop had was a check on an *upload*: the content hash was taken
 * once, the size was measured once, the entity tag identified the bytes that
 * arrived. None of those survive contact with a document that changes. These
 * are the three that had to move from upload time to edit time.
 */
import { Bpmn } from "@bpmnkit/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Env } from "../src/env.js"
import { getCurrentBody } from "../src/lib/db.js"
import { DocRoom } from "../src/room.js"
import { handleJson, handleRaw } from "../src/routes/drop.js"
import { AUTOSAVE_MS, MAX_ROW_BYTES } from "../src/shared/constants.js"
import { migratedDb, seedFile } from "./d1.js"
import { type FakeSocket, FakeState, stubWebSocketGlobals } from "./do-state.js"
import { SEEDED_FILE, SIMPLE_BPMN } from "./fixtures.js"

stubWebSocketGlobals()

const T0 = 1_800_000_000_000

let state: FakeState
let room: DocRoom
let db: D1Database
let env: Env

beforeEach(async () => {
	vi.useFakeTimers()
	vi.setSystemTime(T0)
	state = new FakeState()
	db = migratedDb()
	seedFile(db, { body: SIMPLE_BPMN })
	await state.storage.put("shareId", "share1")
	env = { DB: db } as unknown as Env
	room = new DocRoom(state as unknown as DurableObjectState, env)
})

function deliver(ws: FakeSocket, message: unknown) {
	return room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(message))
}

const claim = (ws: FakeSocket) => deliver(ws, { type: "claim", filename: SEEDED_FILE })

let seq = 0
const op = (ws: FakeSocket, body: unknown) => deliver(ws, { type: "op", seq: ++seq, op: body })
const move = (ws: FakeSocket) => op(ws, { kind: "move", moves: [{ id: "task", dx: 10, dy: 0 }] })

async function fire(at: number) {
	for (const ws of state.getWebSockets()) state.ping(ws, at)
	vi.setSystemTime(at)
	await room.alarm()
}

/** Bans whatever the file's current stored content is. */
async function banCurrent(): Promise<void> {
	const current = await getCurrentBody(db, "share1", SEEDED_FILE, "original")
	await db
		.prepare("INSERT INTO banned_hashes (content_hash, reason, created_at) VALUES (?, 'test', ?)")
		.bind(current?.hash, T0)
		.run()
}

describe("the ban list follows the content", () => {
	/**
	 * Drives the drop into a named state and returns what got stored for it.
	 *
	 * A rename is a single attribute spliced in place, so returning to a name
	 * returns to the same bytes — which is what makes "edit your way back to
	 * banned content" expressible at all.
	 */
	async function saveAs(ws: FakeSocket, name: string, at: number): Promise<string> {
		vi.setSystemTime(at)
		await op(ws, { kind: "rename", id: "task", name })
		await fire(at + AUTOSAVE_MS + 1)
		const row = await getCurrentBody(db, "share1", SEEDED_FILE, "original")
		return row?.hash ?? ""
	}

	async function ban(hash: string): Promise<void> {
		await db
			.prepare("INSERT INTO banned_hashes (content_hash, reason, created_at) VALUES (?, 'test', ?)")
			.bind(hash, T0)
			.run()
	}

	it("stops the room when an edit walks banned content back in", async () => {
		// The hole a mutable drop opens: the hash was checked once, at upload. Ban
		// something, upload something else, then *edit it into* the banned thing —
		// and without a re-check on save it is back in the store.
		const anna = state.join("anna")
		const ben = state.join("ben")
		await claim(anna)

		const bannedHash = await saveAs(anna, "Contraband", T0)
		const innocent = await saveAs(anna, "Perfectly fine", T0 + 60_000)
		expect(innocent).not.toBe(bannedHash)
		await ban(bannedHash)

		// Back to the banned state, byte for byte.
		const returned = await saveAs(anna, "Contraband", T0 + 120_000)
		expect(returned).toBe(innocent) // D1 was not moved on

		expect(anna.last("revoked")).toMatchObject({ reason: "banned" })
		expect(ben.last<{ holder: string | null }>("presence")?.holder).toBeNull()
	})

	it("does not write banned content to the store of record", async () => {
		const anna = state.join("anna")
		await claim(anna)
		const bannedHash = await saveAs(anna, "Contraband", T0)
		await saveAs(anna, "Perfectly fine", T0 + 60_000)
		await ban(bannedHash)
		await saveAs(anna, "Contraband", T0 + 120_000)

		const saved = await getCurrentBody(db, "share1", SEEDED_FILE, "original")
		expect(saved?.body).toContain("Perfectly fine")
		expect(saved?.body).not.toContain("Contraband")
	})

	it("refuses every edit from then on", async () => {
		const anna = state.join("anna")
		await claim(anna)
		const bannedHash = await saveAs(anna, "Contraband", T0)
		await saveAs(anna, "Perfectly fine", T0 + 60_000)
		await ban(bannedHash)
		await saveAs(anna, "Contraband", T0 + 120_000)

		await move(anna)
		expect(anna.last("rejected")).toMatchObject({ reason: "banned" })

		// And nobody can pick the baton up again.
		const ben = state.join("ben")
		await claim(ben)
		expect(ben.last("rejected")).toMatchObject({ reason: "banned" })
		expect(ben.last("granted")).toBeUndefined()
	})

	it("leaves an unbanned drop alone", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await move(anna)
		await fire(T0 + AUTOSAVE_MS + 1)
		expect(anna.last("revoked")).toBeUndefined()
	})
})

describe("the size cap follows the edits", () => {
	/**
	 * A whole document a little over the cap.
	 *
	 * It has to be a `snapshot`: every other op is bounded by the shape guard —
	 * a name caps at 4 KB, a list at 5,000 entries — so a snapshot, which
	 * carries a document wholesale, is the only way a single edit can outgrow a
	 * row. That is also why the cap lives after the replay rather than in the
	 * guard: only the document that comes out can be measured.
	 */
	function oversized() {
		const defs = Bpmn.parse(SIMPLE_BPMN)
		const process = defs.processes[0]
		const plane = defs.diagrams[0]?.plane
		if (!process || !plane) throw new Error("fixture changed")
		const task = process.flowElements.find((e) => e.id === "task")
		const shape = plane.shapes.find((s) => s.bpmnElement === "task")
		if (!task || !shape) throw new Error("fixture changed")
		for (let i = 0; i < 300; i++) {
			const id = `filler_${i}`
			process.flowElements.push({
				...task,
				id,
				name: "x".repeat(4_000),
				incoming: [],
				outgoing: [],
			})
			plane.shapes.push({ ...shape, id: `${id}_di`, bpmnElement: id })
		}
		return { kind: "snapshot", defs }
	}

	it("refuses an edit that would outgrow a D1 row", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await op(anna, oversized())

		expect(anna.last("rejected")).toMatchObject({ reason: "too-large" })
		expect(anna.last<{ detail: string }>("rejected")?.detail).toContain("KB limit")
		expect(anna.last("applied")).toBeUndefined()
	})

	it("says so while the change is still the last thing you did", async () => {
		// The answer arrives on the op, not thirty seconds later on the save —
		// which is the difference between "undo that" and "something is wrong".
		const anna = state.join("anna")
		await claim(anna)
		await op(anna, oversized())
		expect(await state.storage.get("docFlushAt")).toBeUndefined()
	})

	it("keeps taking edits that fit", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await op(anna, { kind: "rename", id: "task", name: "x".repeat(1_000) })
		expect(anna.last("applied")).toBeDefined()
		expect(anna.last("rejected")).toBeUndefined()
	})
})

describe("the entity tag identifies the representation", () => {
	const get = (rep: "raw" | "json", version?: number, headers?: HeadersInit) => {
		const request = new Request("https://x/", { headers })
		return rep === "json"
			? handleJson(request, "share1", SEEDED_FILE, env, version)
			: handleRaw(request, "share1", SEEDED_FILE, env, version)
	}

	it("gives the XML and the JSON of one state different tags", async () => {
		const xml = await get("raw")
		const model = await get("json")
		// They are different bytes under the same name; one tag for both was a bug.
		expect(xml.headers.get("ETag")).not.toBe(model.headers.get("ETag"))
	})

	it("moves when the file is edited", async () => {
		const before = (await get("raw")).headers.get("ETag")
		const anna = state.join("anna")
		await claim(anna)
		await move(anna)
		await fire(T0 + AUTOSAVE_MS + 1)
		expect((await get("raw")).headers.get("ETag")).not.toBe(before)
	})

	it("does not move for the uploaded original, however much is edited", async () => {
		const before = (await get("raw", 0)).headers.get("ETag")
		const anna = state.join("anna")
		await claim(anna)
		await move(anna)
		await fire(T0 + AUTOSAVE_MS + 1)
		expect((await get("raw", 0)).headers.get("ETag")).toBe(before)
		// And it names the version it pins, so it cannot collide with "now".
		expect(before).toContain("v0.")
	})

	it("answers a matching conditional request with 304 and no body", async () => {
		const tag = (await get("raw")).headers.get("ETag") ?? ""
		const second = await get("raw", undefined, { "If-None-Match": tag })
		expect(second.status).toBe(304)
		expect(await second.text()).toBe("")
		expect(second.headers.get("ETag")).toBe(tag)
	})

	it("accepts a weakened tag and a list", async () => {
		const tag = (await get("raw")).headers.get("ETag") ?? ""
		expect((await get("raw", undefined, { "If-None-Match": `W/${tag}` })).status).toBe(304)
		expect((await get("raw", undefined, { "If-None-Match": `"other", ${tag}` })).status).toBe(304)
		expect((await get("raw", undefined, { "If-None-Match": "*" })).status).toBe(304)
	})

	it("serves the body when the tag is stale", async () => {
		const stale = (await get("raw")).headers.get("ETag") ?? ""
		const anna = state.join("anna")
		await claim(anna)
		await move(anna)
		await fire(T0 + AUTOSAVE_MS + 1)

		const fresh = await get("raw", undefined, { "If-None-Match": stale })
		expect(fresh.status).toBe(200)
		expect(await fresh.text()).toContain("<bpmn:definitions")
	})

	it("does not answer a JSON request from an XML tag", async () => {
		const xmlTag = (await get("raw")).headers.get("ETag") ?? ""
		expect((await get("json", undefined, { "If-None-Match": xmlTag })).status).toBe(200)
	})
})

describe("challenging the claim", () => {
	/** Answers `siteverify` for the duration of one test. */
	function siteverify(success: boolean) {
		const calls: Array<Record<string, string>> = []
		vi.stubGlobal("fetch", async (_url: string, init: { body: FormData }) => {
			calls.push(Object.fromEntries(init.body as unknown as Iterable<[string, string]>))
			return new Response(JSON.stringify({ success }), { status: 200 })
		})
		return calls
	}

	/** A room whose deployment asks for a token. */
	function guarded() {
		env = { DB: db, TURNSTILE_SECRET: "sekret" } as unknown as Env
		room = new DocRoom(state as unknown as DurableObjectState, env)
	}

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("refuses a claim with no token at all", async () => {
		guarded()
		const calls = siteverify(true)
		const anna = state.join("anna")
		await claim(anna)

		expect(anna.last("rejected")).toMatchObject({ reason: "unverified" })
		expect(anna.last("granted")).toBeUndefined()
		expect(await state.storage.get("holder")).toBeUndefined()
		// A missing token is refused without asking Cloudflare about it.
		expect(calls).toHaveLength(0)
	})

	it("refuses a token Cloudflare does not accept", async () => {
		guarded()
		const calls = siteverify(false)
		const anna = state.join("anna")
		await deliver(anna, { type: "claim", filename: SEEDED_FILE, token: "forged" })

		expect(anna.last("rejected")).toMatchObject({ reason: "unverified" })
		expect(calls[0]).toMatchObject({ secret: "sekret", response: "forged" })
	})

	it("grants the baton on a good token", async () => {
		guarded()
		siteverify(true)
		const anna = state.join("anna")
		await deliver(anna, { type: "claim", filename: SEEDED_FILE, token: "good" })

		expect(anna.last("granted")).toMatchObject({ holder: "anna" })
		expect(anna.last("rejected")).toBeUndefined()
	})

	it("challenges once a session, not once an op", async () => {
		guarded()
		const calls = siteverify(true)
		const anna = state.join("anna")
		await deliver(anna, { type: "claim", filename: SEEDED_FILE, token: "good" })
		await move(anna)
		await move(anna)
		await move(anna)

		expect(anna.count("applied")).toBe(3)
		// The whole point of the placement: a person is asked once and edits for
		// half an hour; a script pays per drop it wants to rewrite.
		expect(calls).toHaveLength(1)
	})

	it("stops answering a socket that keeps failing", async () => {
		guarded()
		const calls = siteverify(false)
		const anna = state.join("anna")
		for (let i = 0; i < 6; i++) {
			await deliver(anna, { type: "claim", filename: SEEDED_FILE, token: `try-${i}` })
		}
		// Verification is an outbound request made inside the handler, so it stalls
		// the room. Three is what a prober gets before the connection stops earning
		// one; the rest are refused for free.
		expect(calls).toHaveLength(3)
		expect(anna.count("rejected")).toBe(6)
	})

	it("does not challenge at all when no secret is configured", async () => {
		const calls = siteverify(true)
		const anna = state.join("anna")
		await claim(anna)
		expect(anna.last("granted")).toBeDefined()
		expect(calls).toHaveLength(0)
	})

	it("treats a verification outage as a refusal, not a pass", async () => {
		guarded()
		vi.stubGlobal("fetch", async () => {
			throw new Error("network down")
		})
		const anna = state.join("anna")
		await deliver(anna, { type: "claim", filename: SEEDED_FILE, token: "good" })
		// Failing open would mean anyone who can cause an outage can skip the check.
		expect(anna.last("rejected")).toMatchObject({ reason: "unverified" })
	})
})
