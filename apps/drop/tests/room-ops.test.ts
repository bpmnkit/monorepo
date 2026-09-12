/**
 * The room as the authority on what a drop is.
 *
 * These drive the three things D4 promises: an op from someone without the
 * baton does not happen, an op whose *result* could not be served is refused
 * with a reason rather than silently dropped, and a room evicted from memory
 * mid-session picks the document back up exactly where it left it.
 */
import { Bpmn } from "@bpmnkit/core"
import type { EditorOp } from "@bpmnkit/editor/headless"
import { beforeEach, describe, expect, it } from "vitest"
import type { Env } from "../src/env.js"
import { DocRoom } from "../src/room.js"
import { migratedDb, seedFile } from "./d1.js"
import { type FakeSocket, FakeState, stubWebSocketGlobals } from "./do-state.js"
import { SEEDED_FILE, SIMPLE_BPMN } from "./fixtures.js"

stubWebSocketGlobals()

let state: FakeState
let room: DocRoom
let db: D1Database

/** A fresh room over a seeded drop, as `fetch` would have left it. */
function makeRoom(): DocRoom {
	return new DocRoom(state as unknown as DurableObjectState, { DB: db } as unknown as Env)
}

beforeEach(async () => {
	state = new FakeState()
	db = migratedDb()
	const seeded = seedFile(db, { body: SIMPLE_BPMN })
	await state.storage.put("shareId", seeded.shareId)
	room = makeRoom()
})

function deliver(ws: FakeSocket, message: unknown) {
	return room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(message))
}

const claim = (ws: FakeSocket) => deliver(ws, { type: "claim", filename: SEEDED_FILE })

const sendOp = (ws: FakeSocket, seq: number, op: unknown) => deliver(ws, { type: "op", seq, op })

/** Moves the seeded task — the simplest op that changes something. */
const MOVE: EditorOp = { kind: "move", moves: [{ id: "task", dx: 40, dy: 0 }] }

/** The document as the room would serve it right now. */
async function currentXml(): Promise<string> {
	const holder = state.join("peek")
	await deliver(holder, { type: "resync", filename: SEEDED_FILE })
	return holder.last<{ xml: string }>("state")?.xml ?? ""
}

describe("permission", () => {
	it("refuses an op from someone who does not hold the baton", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		await claim(anna)
		await sendOp(ben, 1, MOVE)

		expect(ben.last("rejected")).toMatchObject({ seq: 1, reason: "not-holder" })
		expect(ben.last("applied")).toBeUndefined()
		expect(anna.last("applied")).toBeUndefined()
	})

	it("refuses an op when nobody holds the baton at all", async () => {
		const anna = state.join("anna")
		await sendOp(anna, 1, MOVE)
		expect(anna.last("rejected")).toMatchObject({ reason: "not-holder" })
	})

	it("stops accepting ops the moment the baton is released", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await sendOp(anna, 1, MOVE)
		expect(anna.last("applied")).toBeDefined()

		await deliver(anna, { type: "release" })
		await sendOp(anna, 2, MOVE)
		expect(anna.last("rejected")).toMatchObject({ seq: 2, reason: "not-holder" })
	})
})

describe("applying", () => {
	it("replays the op and tells the whole room", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		await claim(anna)
		await sendOp(anna, 7, MOVE)

		const applied = ben.last<{ version: number; seq: number; hash: string; filename: string }>(
			"applied",
		)
		expect(applied).toMatchObject({ version: 1, seq: 7, filename: SEEDED_FILE })
		// The writer is told too: it applied the op optimistically and this is the
		// room agreeing, not news.
		expect(anna.last<{ hash: string }>("applied")?.hash).toBe(applied?.hash)

		const shape = Bpmn.parse(await currentXml()).diagrams[0]?.plane.shapes.find(
			(s) => s.bpmnElement === "task",
		)
		expect(shape?.bounds.x).toBe(240)
	})

	it("counts a version per op", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await sendOp(anna, 1, MOVE)
		await sendOp(anna, 2, MOVE)
		await sendOp(anna, 3, { kind: "rename", id: "task", name: "Renamed" })
		expect(anna.last<{ version: number }>("applied")?.version).toBe(3)
	})

	it("hands the writer the document itself when granting the baton", async () => {
		const anna = state.join("anna")
		await claim(anna)
		const granted = anna.last<{ version: number; hash: string; filename: string; xml: string }>(
			"granted",
		)
		expect(granted).toMatchObject({ version: 0, filename: SEEDED_FILE })
		expect(granted?.hash).toMatch(/^[0-9a-f]{64}$/)
		// The room had to load it to answer the claim, so sending it costs nothing
		// and saves the round trip between pressing Edit and the editor appearing.
		expect(granted?.xml).toContain('id="task"')
		expect(await currentXml()).toBe(granted?.xml)
	})

	it("grants the document as it is now, not as it was uploaded", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await sendOp(anna, 1, MOVE)
		await deliver(anna, { type: "release" })

		const ben = state.join("ben")
		await claim(ben)
		const granted = ben.last<{ version: number; xml: string }>("granted")
		expect(granted?.version).toBe(1)
		expect(granted?.xml).toBe(await currentXml())
	})

	it("broadcasts a hash that matches replaying the op locally", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await sendOp(anna, 1, MOVE)

		// What a watcher does in D5: replay, re-serialise, compare.
		const { applyOp } = await import("@bpmnkit/editor/headless")
		const { sha256Hex } = await import("@bpmnkit/core")
		const replayed = applyOp(Bpmn.parse(SIMPLE_BPMN), MOVE).defs
		const expected = await sha256Hex(Bpmn.export(replayed))
		expect(anna.last<{ hash: string }>("applied")?.hash).toBe(expected)
	})
})

describe("refusal with a reason", () => {
	/** Applies an op and returns the rejection it produced, if any. */
	async function reject(op: unknown) {
		const anna = state.join("anna")
		await claim(anna)
		await sendOp(anna, 1, op)
		return anna
	}

	it("refuses an op that would leave a flow pointing at nothing", async () => {
		// Deleting the task alone would orphan both flows attached to it, if
		// `deleteElements` did not cascade. The room does not rely on that: it
		// judges the document, so a cascade regression is caught here rather than
		// stored.
		const anna = await reject({ kind: "snapshot", defs: danglingDefs() })
		expect(anna.last("rejected")).toMatchObject({ reason: "integrity" })
		expect(anna.last<{ detail: string }>("rejected")?.detail).toContain("point at nothing")
		expect(anna.last("applied")).toBeUndefined()
	})

	it("refuses an op that would draw an element twice under one id", async () => {
		const defs = Bpmn.parse(SIMPLE_BPMN)
		const process = defs.processes[0]
		const task = process?.flowElements.find((e) => e.id === "task")
		if (!process || !task) throw new Error("fixture changed")
		process.flowElements.push({ ...task, id: "start" })
		const anna = await reject({ kind: "snapshot", defs })
		expect(anna.last<{ detail: string }>("rejected")?.detail).toContain("share the id")
	})

	it("refuses an op that would leave an element with nothing to draw it", async () => {
		const defs = Bpmn.parse(SIMPLE_BPMN)
		const plane = defs.diagrams[0]?.plane
		if (!plane) throw new Error("fixture changed")
		plane.shapes = plane.shapes.filter((s) => s.bpmnElement !== "task")
		const anna = await reject({ kind: "snapshot", defs })
		expect(anna.last<{ detail: string }>("rejected")?.detail).toContain("nothing to draw it")
	})

	it("refuses a message that is not an op at all", async () => {
		const anna = await reject({ kind: "moveShapes", whatever: true })
		expect(anna.last("rejected")).toMatchObject({ reason: "malformed" })
	})

	it("refuses an op whose fields are the wrong shape", async () => {
		const anna = await reject({ kind: "delete", ids: "task" })
		expect(anna.last("rejected")).toMatchObject({ reason: "malformed" })
	})

	it("leaves the document untouched after a refusal", async () => {
		const before = await currentXml()
		await reject({ kind: "delete", ids: "task" })
		expect(await currentXml()).toBe(before)
	})

	it("refuses to hand out the baton for a file it cannot edit", async () => {
		const anna = state.join("anna")
		await deliver(anna, { type: "claim", filename: "nope.bpmn" })
		expect(anna.last("rejected")).toMatchObject({ reason: "no-document" })
		expect(anna.last("granted")).toBeUndefined()
		expect(await state.storage.get("holder")).toBeUndefined()
	})
})

describe("surviving hibernation", () => {
	it("picks the document back up mid-session", async () => {
		const anna = state.join("anna")
		await claim(anna)
		await sendOp(anna, 1, MOVE)
		const afterFirst = await currentXml()

		// Eviction: the instance goes, the sockets and the storage stay. A new
		// instance over the same state is exactly what the runtime hands back.
		room = makeRoom()

		await sendOp(anna, 2, { kind: "rename", id: "task", name: "After the nap" })
		const applied = anna.last<{ version: number }>("applied")
		// Version 2, not 1: the room knew what it had already applied.
		expect(applied?.version).toBe(2)

		const xml = await currentXml()
		expect(xml).not.toBe(afterFirst)
		expect(xml).toContain("After the nap")
		// And the first op is still in it — the reload was not a reload from D1.
		expect(
			Bpmn.parse(xml).diagrams[0]?.plane.shapes.find((s) => s.bpmnElement === "task")?.bounds.x,
		).toBe(240)
	})

	it("starts from D1 when it has never been edited", async () => {
		const anna = state.join("anna")
		await deliver(anna, { type: "resync", filename: SEEDED_FILE })
		const state0 = anna.last<{ version: number; xml: string }>("state")
		expect(state0?.version).toBe(0)
		expect(state0?.xml).toContain('id="task"')
		// Reading is not editing: a drop nobody has changed leaves nothing behind.
		expect(await state.storage.get(`doc:${SEEDED_FILE}`)).toBeUndefined()
	})

	it("keeps the document out of storage until an op lands", async () => {
		const anna = state.join("anna")
		await claim(anna)
		expect(await state.storage.get(`doc:${SEEDED_FILE}`)).toBeUndefined()
		await sendOp(anna, 1, MOVE)
		expect(await state.storage.get(`doc:${SEEDED_FILE}`)).toBeDefined()
	})
})

/** A document whose flow points at a task that is not there. */
function danglingDefs() {
	const defs = Bpmn.parse(SIMPLE_BPMN)
	const process = defs.processes[0]
	if (!process) throw new Error("fixture changed")
	process.flowElements = process.flowElements.filter((e) => e.id !== "task")
	const plane = defs.diagrams[0]?.plane
	if (plane) plane.shapes = plane.shapes.filter((s) => s.bpmnElement !== "task")
	return defs
}
