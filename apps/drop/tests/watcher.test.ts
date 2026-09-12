/**
 * A watcher keeping up with a writer it cannot see.
 *
 * The two things D5 promises are here: a writer's commits land in more than one
 * watcher, and a watcher whose document has gone wrong notices, asks once, and
 * comes back correct. The second is the one worth the machinery — the first
 * works by construction, the second only works if the check is real.
 *
 * The room is driven for real rather than stubbed: the messages a watcher reacts
 * to are the ones `DocRoom` actually broadcasts, so a protocol change breaks
 * this file instead of production.
 */
import { Bpmn } from "@bpmnkit/core"
import type { EditorOp } from "@bpmnkit/editor/headless"
import { beforeEach, describe, expect, it } from "vitest"
import { type Change, DocWatcher, type WatcherDoc, touchedBy } from "../src/client/watcher.js"
import type { Env } from "../src/env.js"
import { DocRoom } from "../src/room.js"
import type { ClientMessage, ServerMessage } from "../src/shared/room-protocol.js"
import { migratedDb, seedFile } from "./d1.js"
import { type FakeSocket, FakeState, stubWebSocketGlobals } from "./do-state.js"
import { SEEDED_FILE, SIMPLE_BPMN } from "./fixtures.js"

stubWebSocketGlobals()

let state: FakeState
let room: DocRoom

beforeEach(async () => {
	state = new FakeState()
	const db = migratedDb()
	const seeded = seedFile(db, { body: SIMPLE_BPMN })
	await state.storage.put("shareId", seeded.shareId)
	room = new DocRoom(state as unknown as DurableObjectState, { DB: db } as unknown as Env)
})

function deliver(ws: FakeSocket, message: unknown) {
	return room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(message))
}

/**
 * A watcher wired to a socket, relaying the room's messages into it and its
 * requests back — the loop `viewer.ts` builds, minus the drawing.
 */
function attach(ws: FakeSocket, filename: string | null = SEEDED_FILE) {
	const renders: Array<{ doc: WatcherDoc; change: Change | null }> = []
	const sent: ClientMessage[] = []
	const drifts: string[] = []
	const inFlight: Array<Promise<unknown>> = []
	const watcher = new DocWatcher({
		send: (message) => {
			sent.push(message)
			inFlight.push(deliver(ws, message))
		},
		render: (doc, change) => renders.push({ doc, change }),
		onDrift: (reason) => drifts.push(reason),
	})
	watcher.watch(filename)

	let delivered = 0
	/**
	 * Runs the loop to a standstill.
	 *
	 * One round is not enough: handing a watcher a message can make it ask for
	 * something, which makes the room say something else. Each turn of the macro
	 * task queue also drains the microtasks the watcher's hashing sits on, so by
	 * the time this returns nothing is still in flight.
	 */
	const pump = async () => {
		for (let round = 0; round < 20; round++) {
			await Promise.all(inFlight.splice(0))
			await new Promise((resolve) => setTimeout(resolve, 0))
			const pending = ws.messages<ServerMessage>().slice(delivered)
			if (pending.length === 0 && inFlight.length === 0) return
			delivered += pending.length
			for (const message of pending) watcher.handle(message)
		}
		throw new Error("the room and the watcher never settled")
	}

	return {
		watcher,
		renders,
		sent,
		drifts,
		pump,
		resyncs: () => sent.filter((m) => m.type === "resync"),
	}
}

/** Gives the baton to `ws` and makes it the writer. */
async function takeBaton(ws: FakeSocket) {
	await deliver(ws, { type: "claim", filename: SEEDED_FILE })
}

const MOVE: EditorOp = { kind: "move", moves: [{ id: "task", dx: 40, dy: 0 }] }
const RENAME: EditorOp = { kind: "rename", id: "task", name: "Renamed" }

const sendOp = (ws: FakeSocket, seq: number, op: EditorOp) => deliver(ws, { type: "op", seq, op })

/** Where the seeded task sits in a watcher's document. */
const taskX = (doc: WatcherDoc) =>
	doc.defs.diagrams[0]?.plane.shapes.find((s) => s.bpmnElement === "task")?.bounds.x

describe("keeping up", () => {
	it("lands a writer's commits in two watchers", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		const cara = state.join("cara")
		const w1 = attach(ben)
		const w2 = attach(cara)

		await takeBaton(anna)
		// Both watchers see a holder and ask for the current document.
		await w1.pump()
		await w2.pump()

		await sendOp(anna, 1, MOVE)
		await sendOp(anna, 2, RENAME)
		await w1.pump()
		await w2.pump()

		for (const w of [w1, w2]) {
			const doc = w.watcher.current()
			expect(doc?.version).toBe(2)
			expect(taskX(doc as WatcherDoc)).toBe(240)
			expect(doc?.xml).toContain("Renamed")
			expect(w.drifts).toEqual([])
			// One resync at the start, then pure replay: no document was shipped
			// for either op.
			expect(w.resyncs()).toHaveLength(1)
		}
		// And the two agree byte for byte, which is the claim replay rests on.
		expect(w1.watcher.current()?.xml).toBe(w2.watcher.current()?.xml)
	})

	it("agrees with the room's own hash on every op", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		const w = attach(ben)
		await takeBaton(anna)
		await w.pump()

		await sendOp(anna, 1, MOVE)
		await w.pump()
		const applied = ben.last<{ hash: string }>("applied")
		expect(w.watcher.current()?.hash).toBe(applied?.hash)
	})

	it("reports what changed, so the viewer can flash it", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		const w = attach(ben)
		await takeBaton(anna)
		await w.pump()

		await sendOp(anna, 1, {
			kind: "createConnected",
			sourceId: "task",
			type: "userTask",
			bounds: { x: 500, y: 60, width: 100, height: 80 },
			waypoints: [
				{ x: 300, y: 100 },
				{ x: 500, y: 100 },
			],
			seed: "s",
		})
		await w.pump()

		const change = w.renders[w.renders.length - 1]?.change
		expect(change?.touched).toEqual(["task"])
		// The new shape and its flow — ids the op never carried, known only by
		// running it.
		expect(change?.created).toHaveLength(2)
	})

	it("ignores a file it is not showing, without even asking about it", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		const w = attach(ben, "something-else.bpmn")
		await takeBaton(anna)
		await sendOp(anna, 1, MOVE)
		await w.pump()
		expect(w.renders).toEqual([])
		// `presence` names the file the baton covers, so a viewer on another tab of
		// the same drop knows there is nothing here to watch and stays quiet. Without
		// that field it would resync on every edit to every other file.
		expect(w.resyncs()).toEqual([])
	})

	it("asks for nothing while nobody is editing", async () => {
		const ben = state.join("ben")
		const w = attach(ben)
		// A room with viewers and no writer: the page's own copy is current, and
		// waking the room per viewer is the cost it was built to avoid.
		w.watcher.handle({ type: "presence", viewers: 3, holder: null, file: null })
		await w.pump()
		expect(w.resyncs()).toEqual([])
	})
})

describe("recovering from a divergence", () => {
	it("resyncs exactly once and comes back correct", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		const w = attach(ben)
		await takeBaton(anna)
		await w.pump()
		expect(w.resyncs()).toHaveLength(1)

		// Break it on purpose: the next op will hash to something the room does
		// not agree with, which is the only honest way to see recovery run.
		w.watcher.corruptForTest()

		await sendOp(anna, 1, MOVE)
		await w.pump()
		expect(w.drifts).toEqual(["hash"])

		await sendOp(anna, 2, RENAME)
		await sendOp(anna, 3, MOVE)
		await w.pump()

		// Exactly one more request, however many ops arrived while it was in flight.
		expect(w.resyncs()).toHaveLength(2)
		expect(w.drifts).toEqual(["hash"])

		const doc = w.watcher.current()
		expect(doc?.version).toBe(3)
		expect(doc?.xml).toContain("Renamed")
		expect(taskX(doc as WatcherDoc)).toBe(280)
		// Recovered means *identical* to the room, not merely plausible.
		expect(doc?.hash).toBe(ben.last<{ hash: string }>("applied")?.hash)
	})

	it("resyncs when an op goes missing", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		const w = attach(ben)
		await takeBaton(anna)
		await w.pump()

		// A version 2 arriving where 1 was expected: replaying it would build on a
		// document that never existed.
		w.watcher.handle({
			type: "applied",
			version: 2,
			seq: 2,
			filename: SEEDED_FILE,
			op: MOVE,
			hash: "whatever",
		})
		await w.pump()
		expect(w.drifts).toEqual(["gap"])
		expect(w.resyncs()).toHaveLength(2)
	})

	it("keeps replaying after it has healed", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		const w = attach(ben)
		await takeBaton(anna)
		await w.pump()

		w.watcher.corruptForTest()
		await sendOp(anna, 1, MOVE)
		await w.pump()
		const afterHeal = w.resyncs().length

		await sendOp(anna, 2, RENAME)
		await w.pump()
		// Back to plain replay — no further requests, and the document advanced.
		expect(w.resyncs()).toHaveLength(afterHeal)
		expect(w.watcher.current()?.version).toBe(2)
	})

	it("drops its document when the viewer switches files", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		const w = attach(ben)
		await takeBaton(anna)
		await w.pump()
		expect(w.watcher.current()).not.toBeNull()

		w.watcher.watch("other.bpmn")
		expect(w.watcher.current()).toBeNull()
	})
})

describe("touchedBy", () => {
	it("names the elements an op alters", () => {
		expect(touchedBy(MOVE)).toEqual(["task"])
		expect(touchedBy({ kind: "delete", ids: ["a", "b"] })).toEqual(["a", "b"])
		expect(touchedBy({ kind: "rename", id: "a", name: "x" })).toEqual(["a"])
		expect(
			touchedBy({ kind: "moveWaypoint", edgeId: "f1", wpIdx: 0, point: { x: 0, y: 0 } }),
		).toEqual(["f1"])
	})

	it("says nothing for an op that touched everything or nothing", () => {
		// Flashing the whole diagram communicates less than flashing none of it.
		expect(touchedBy({ kind: "autoLayout" })).toEqual([])
		expect(
			touchedBy({
				kind: "createShape",
				type: "task",
				bounds: { x: 0, y: 0, width: 1, height: 1 },
				seed: "s",
			}),
		).toEqual([])
	})
})

/** Kept honest: the fixture's task starts where the assertions above assume. */
it("starts from the fixture's known geometry", () => {
	const shapes = Bpmn.parse(SIMPLE_BPMN).diagrams[0]?.plane.shapes
	expect(shapes?.find((s) => s.bpmnElement === "task")?.bounds.x).toBe(200)
})
