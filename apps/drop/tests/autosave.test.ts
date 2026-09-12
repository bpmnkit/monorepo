/**
 * D1 catching up with the room.
 *
 * There is no save button, so the promises here are the ones a save button
 * would otherwise be making: an edit reaches the store of record without anyone
 * asking, and the version log fills up at a rate that keeps its own bound
 * meaningful. The two acceptance criteria — lose the writer's tab and the last
 * committed command is still there; an hour of continuous editing leaves *one*
 * milestone — are the first two tests.
 */
import { Bpmn } from "@bpmnkit/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Env } from "../src/env.js"
import { getCurrentBody } from "../src/lib/db.js"
import { listVersions } from "../src/lib/versions.js"
import { DocRoom } from "../src/room.js"
import { AUTOSAVE_MS, MILESTONE_BUCKET_MS } from "../src/shared/constants.js"
import { migratedDb, milestoneCount, seedFile, writeCount } from "./d1.js"
import { type FakeSocket, FakeState, stubWebSocketGlobals } from "./do-state.js"
import { SEEDED_FILE, SIMPLE_BPMN } from "./fixtures.js"

stubWebSocketGlobals()

const T0 = 1_800_000_000_000

let state: FakeState
let room: DocRoom
let db: D1Database
let fileId: string

beforeEach(async () => {
	vi.useFakeTimers()
	vi.setSystemTime(T0)
	state = new FakeState()
	db = migratedDb()
	const seeded = seedFile(db, { body: SIMPLE_BPMN })
	fileId = seeded.fileId
	await state.storage.put("shareId", seeded.shareId)
	room = new DocRoom(state as unknown as DurableObjectState, { DB: db } as unknown as Env)
})

afterEach(() => {
	vi.useRealTimers()
})

function deliver(ws: FakeSocket, message: unknown) {
	return room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(message))
}

const claim = (ws: FakeSocket) => deliver(ws, { type: "claim", filename: SEEDED_FILE })
const release = (ws: FakeSocket) => deliver(ws, { type: "release" })

let seq = 0
const move = (ws: FakeSocket, dx = 10) =>
	deliver(ws, { type: "op", seq: ++seq, op: { kind: "move", moves: [{ id: "task", dx, dy: 0 }] } })

const rename = (ws: FakeSocket, name: string) =>
	deliver(ws, { type: "op", seq: ++seq, op: { kind: "rename", id: "task", name } })

/** Runs the alarm as if the clock had reached `at`, keeping sockets healthy. */
async function fire(at: number) {
	for (const ws of state.getWebSockets()) state.ping(ws, at)
	vi.setSystemTime(at)
	await room.alarm()
}

/** What D1 would now serve for the file. */
async function stored() {
	return await getCurrentBody(db, "share1", SEEDED_FILE, "original")
}

/** Where the task sits in whatever D1 holds. */
async function storedTaskX(): Promise<number | undefined> {
	const body = (await stored())?.body ?? ""
	return Bpmn.parse(body).diagrams[0]?.plane.shapes.find((s) => s.bpmnElement === "task")?.bounds.x
}

describe("reaching D1", () => {
	it("keeps the last committed command through a lost tab", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await move(anna, 40)
		await rename(anna, "Survived")

		// Nothing written yet — the object's own storage is the durability layer.
		expect(await storedTaskX()).toBe(200)

		await fire(T0 + AUTOSAVE_MS + 1)

		// The tab is gone; what D1 holds is what a reload will show.
		expect(await storedTaskX()).toBe(240)
		expect((await stored())?.body).toContain("Survived")
	})

	it("saves thirty seconds after the first edit, not after the last", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await move(anna)

		// Editing continuously must not push the deadline out for ever: the debounce
		// bounds how stale D1 gets, it does not wait for a lull.
		vi.setSystemTime(T0 + AUTOSAVE_MS - 1_000)
		await move(anna)
		await fire(T0 + AUTOSAVE_MS + 1)
		expect(await storedTaskX()).toBe(220)
	})

	it("writes nothing when nobody has edited", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await fire(T0 + AUTOSAVE_MS + 1)
		expect(await stored()).toMatchObject({ body: SIMPLE_BPMN })
	})

	it("saves at once when the baton is put down", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await move(anna, 70)
		await release(anna)
		// No alarm has fired; releasing is itself a save.
		expect(await storedTaskX()).toBe(270)
	})

	it("slides the retention window forward on an edit", async () => {
		const before = await db
			.prepare("SELECT expires_at, updated_at FROM drops WHERE id = ?")
			.bind("share1")
			.first<{ expires_at: number; updated_at: number | null }>()
		expect(before?.updated_at).toBeNull()

		const anna = state.join("anna")
		await claim(anna)
		await move(anna)
		await fire(T0 + AUTOSAVE_MS + 1)

		const after = await db
			.prepare("SELECT expires_at, updated_at FROM drops WHERE id = ?")
			.bind("share1")
			.first<{ expires_at: number; updated_at: number }>()
		expect(after?.expires_at).toBeGreaterThan(before?.expires_at ?? 0)
		expect(after?.updated_at).toBeGreaterThan(0)
	})

	it("leaves the uploaded original untouched", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await move(anna, 40)
		await fire(T0 + AUTOSAVE_MS + 1)

		const original = await db
			.prepare("SELECT body FROM file_content WHERE file_id = ? AND rep = 'original'")
			.bind(fileId)
			.first<{ body: string }>()
		expect(original?.body).toBe(SIMPLE_BPMN)
	})
})

describe("preserving the file it was given", () => {
	it("rewrites only what changed", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await rename(anna, "Renamed")
		await fire(T0 + AUTOSAVE_MS + 1)

		const body = (await stored())?.body ?? ""
		expect(body).toContain("Renamed")
		// The uploader's own formatting is still there. A reformat-everything save
		// would make every diff against the original noise — and `Bpmn.export` of
		// the same model is demonstrably a different shape, so this is not passing
		// by the two happening to agree.
		expect(body.split("\n")).toHaveLength(SIMPLE_BPMN.split("\n").length)
		expect(body).not.toBe(Bpmn.export(Bpmn.parse(body)))
	})

	it("keeps preserving across a second session", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await rename(anna, "First")
		await release(anna)

		const ben = state.join("ben")
		vi.setSystemTime(T0 + 60_000)
		await claim(ben)
		await move(ben, 30)
		await release(ben)

		const body = (await stored())?.body ?? ""
		expect(body).toContain("First")
		expect(body).toContain('<bpmn:process id="proc" isExecutable="true">')
	})
})

describe("the milestone rate", () => {
	it("leaves one milestone for an hour of continuous editing", async () => {
		const anna = state.join("anna")
		await claim(anna)

		// Two minutes of edits, saved every thirty seconds, all inside one hour.
		const before = writeCount(db)
		for (let i = 0; i < 4; i++) {
			const at = T0 + i * AUTOSAVE_MS
			vi.setSystemTime(at)
			await move(anna)
			await fire(at + AUTOSAVE_MS + 1)
		}

		expect(await milestoneCount(db, fileId)).toBe(1)
		// One row is not the whole claim — a milestone written on every save would
		// also leave one row, at four times the writes. Each save is two statements
		// (`file_current`, `drops`); the milestone adds its insert and its prune to
		// the first save only.
		expect(writeCount(db) - before).toBe(4 * 2 + 2)
	})

	it("starts a new milestone when the hour turns", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await move(anna)
		await fire(T0 + AUTOSAVE_MS + 1)
		expect(await milestoneCount(db, fileId)).toBe(1)

		const nextHour = T0 + MILESTONE_BUCKET_MS + 1
		vi.setSystemTime(nextHour)
		await move(anna)
		await fire(nextHour + AUTOSAVE_MS + 1)
		expect(await milestoneCount(db, fileId)).toBe(2)
	})

	it("never lets one person's hour overwrite another's", async () => {
		// The failure the session id exists for: Anna edits, a stranger wrecks it
		// forty minutes later, same hour. Anna's milestone must survive.
		const anna = state.join("anna")
		await claim(anna)
		await rename(anna, "Anna's work")
		await release(anna)

		vi.setSystemTime(T0 + 40 * 60_000)
		const stranger = state.join("stranger")
		await claim(stranger)
		await rename(stranger, "Wrecked")
		await release(stranger)

		expect(await milestoneCount(db, fileId)).toBe(2)
		const entries = await listVersions(db, fileId, {
			createdAt: T0,
			bytes: SIMPLE_BPMN.length,
			contentHash: "hash-original",
		})
		// Newest first, ending in the pinned original.
		expect(entries).toHaveLength(3)
		expect(entries[2]?.label).toBe("original")
	})

	it("refreshes the session's milestone on release rather than adding one", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await move(anna)
		await fire(T0 + AUTOSAVE_MS + 1)
		expect(await milestoneCount(db, fileId)).toBe(1)

		await move(anna, 25)
		await release(anna)
		// Still one row for this (hour, session) — but holding the final state.
		expect(await milestoneCount(db, fileId)).toBe(1)
		expect(await storedTaskX()).toBe(235)
	})

	it("counts the ops a milestone covers", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await move(anna)
		await move(anna)
		await move(anna)
		await release(anna)

		const row = await db
			.prepare("SELECT op_count FROM file_versions WHERE file_id = ? ORDER BY seq DESC LIMIT 1")
			.bind(fileId)
			.first<{ op_count: number }>()
		expect(row?.op_count).toBe(3)
	})

	it("suppresses a milestone for a session that changed nothing", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await release(anna)
		expect(await milestoneCount(db, fileId)).toBe(0)
	})
})

describe("the single alarm", () => {
	it("arms for the save and clears once it has happened", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await move(anna)
		expect(await state.alarm).not.toBeNull()

		await fire(T0 + AUTOSAVE_MS + 1)
		await release(anna)
		await fire(T0 + AUTOSAVE_MS + 2)
		expect(await state.alarm).toBeNull()
	})
})
