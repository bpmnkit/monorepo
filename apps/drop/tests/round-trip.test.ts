// @vitest-environment happy-dom
/**
 * Editor → room → watcher, end to end, with nothing stubbed.
 *
 * Each track was tested against its neighbours: D3 that an op replays to
 * identical XML, D4 that the room judges one, D5 that a watcher follows one.
 * This is the claim those add up to, and the only way to be sure they do is to
 * run all three against each other — a real `BpmnEditor` driven through its
 * public API, a real `DocRoom` deciding, a real `DocWatcher` keeping up.
 *
 * The assertion is byte equality of three independently produced documents. Not
 * equivalence: the same bytes, from three machines that never shared one.
 *
 * This is the one file in the app that is neither Worker nor browser but both,
 * so it has its own `tsconfig.tests.json`: the Worker config has no DOM lib and
 * the client config has no `@cloudflare/workers-types`, and widening either
 * would let Worker source reach for `document` or client source reach for
 * `DurableObjectState`. Keeping those apart is worth the extra config file.
 */
import { Bpmn } from "@bpmnkit/core"
import { BpmnEditor } from "@bpmnkit/editor"
import { beforeEach, describe, expect, it } from "vitest"
import { DocWatcher } from "../src/client/watcher.js"
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
	gate = Promise.resolve()
	const db = migratedDb()
	const seeded = seedFile(db, { body: SIMPLE_BPMN })
	await state.storage.put("shareId", seeded.shareId)
	room = new DocRoom(state as unknown as DurableObjectState, { DB: db } as unknown as Env)
})

/**
 * Delivers messages to the room one at a time.
 *
 * workerd's input gate does this for real: a Durable Object handles one message
 * to completion before starting the next, which is the whole reason the baton
 * needs no lock. `FakeState` has no gate, so without this the editor's ops —
 * emitted synchronously, one after another — would interleave inside the room
 * and version each other out of order. Serialising here reproduces the runtime
 * rather than papering over it.
 */
let gate: Promise<unknown> = Promise.resolve()

function deliver(ws: FakeSocket, message: unknown): Promise<void> {
	gate = gate.then(() => room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(message)))
	return gate as Promise<void>
}

/** A container the editor can mount into. */
function host(): HTMLElement {
	const el = document.createElement("div")
	el.style.width = "900px"
	el.style.height = "600px"
	document.body.appendChild(el)
	return el
}

describe("editor → room → watcher", () => {
	it("leaves all three holding byte-identical XML", async () => {
		const writerSocket = state.join("writer")
		const watcherSocket = state.join("watcher")

		// ── The watcher, wired the way the viewer wires it ────────────────────
		const inFlight: Array<Promise<unknown>> = []
		const drifts: string[] = []
		let delivered = 0
		const watcher = new DocWatcher({
			send: (m: ClientMessage) => inFlight.push(deliver(watcherSocket, m)),
			render: () => {},
			onDrift: (reason) => drifts.push(reason),
		})
		watcher.watch(SEEDED_FILE)

		/** The newest version the room has broadcast, which the watcher must reach. */
		const roomVersion = () =>
			watcherSocket
				.messages<{ type: string; version?: number }>()
				.reduce((n, m) => (m.type === "applied" ? (m.version ?? n) : n), 0)

		/**
		 * Runs everything to a standstill.
		 *
		 * Quiet sockets are not enough to stop on: the watcher hashes, so its work
		 * sits on a promise chain this harness cannot see, and exiting on an empty
		 * queue would read a document that is still catching up. The condition is
		 * that the watcher has actually reached the room's latest version.
		 */
		const settle = async () => {
			for (let round = 0; round < 40; round++) {
				await Promise.all(inFlight.splice(0))
				await new Promise((resolve) => setTimeout(resolve, 0))
				const pending = watcherSocket.messages<ServerMessage>().slice(delivered)
				delivered += pending.length
				for (const message of pending) watcher.handle(message)
				const caughtUp = (watcher.current()?.version ?? -1) >= roomVersion()
				if (pending.length === 0 && inFlight.length === 0 && caughtUp) return
			}
			throw new Error("never settled")
		}

		// ── The writer claims, and gets the document with the grant ───────────
		await deliver(writerSocket, { type: "claim", filename: SEEDED_FILE })
		const granted = writerSocket.last<{ xml: string; version: number }>("granted")
		expect(granted?.version).toBe(0)
		expect(granted?.xml).toContain('id="task"')
		await settle()

		// ── A real editor, opened on exactly what the room handed over ────────
		const editor = new BpmnEditor({
			container: host(),
			xml: granted?.xml,
			grid: false,
			fit: "none",
		})
		let seq = 0
		editor.on("diagram:op", (op) => {
			seq += 1
			inFlight.push(deliver(writerSocket, { type: "op", seq, op }))
		})

		// Drive it the way a person would, through the public API only.
		editor.setSelection(["task"])
		editor.updateColor("task", { fill: "#e0f2f1", stroke: "#00695c" })
		editor.changeElementType("task", "userTask")
		editor.addConnectedElement("task", "exclusiveGateway", "Approved?")
		editor.createAnnotationFor("task")
		editor.setSelection(["end"])
		editor.deleteSelected()
		// An undo, which only reaches the room because it describes itself as a
		// snapshot — the whole reason D3's "undo says nothing" was wrong.
		editor.undo()
		await settle()

		expect(writerSocket.last("rejected")).toBeUndefined()
		expect(writerSocket.count("applied")).toBe(seq)

		// ── The three documents ───────────────────────────────────────────────
		const fromEditor = editor.exportXml()
		const fromWatcher = watcher.current()?.xml
		await deliver(watcherSocket, { type: "resync", filename: SEEDED_FILE })
		const fromRoom = watcherSocket.last<{ xml: string }>("state")?.xml

		expect(drifts).toEqual([])
		expect(fromWatcher).toBe(fromRoom)
		expect(fromEditor).toBe(fromRoom)
		// And it is a real document, not three identical failures.
		expect(Bpmn.parse(fromRoom ?? "").processes[0]?.flowElements.length).toBeGreaterThan(1)

		editor.destroy()
	})

	it("rejects a writer's op once the baton has gone, and the editor can recover", async () => {
		const writerSocket = state.join("writer")
		await deliver(writerSocket, { type: "claim", filename: SEEDED_FILE })
		const granted = writerSocket.last<{ xml: string }>("granted")
		const editor = new BpmnEditor({
			container: host(),
			xml: granted?.xml,
			grid: false,
			fit: "none",
		})

		await deliver(writerSocket, { type: "release" })
		await deliver(writerSocket, {
			type: "op",
			seq: 1,
			op: { kind: "rename", id: "task", name: "Too late" },
		})
		expect(writerSocket.last("rejected")).toMatchObject({ seq: 1, reason: "not-holder" })

		// What the viewer does with a rejection: take the room's document back.
		await deliver(writerSocket, { type: "resync", filename: SEEDED_FILE })
		const authoritative = writerSocket.last<{ xml: string }>("state")?.xml ?? ""
		editor.load(authoritative)
		expect(editor.exportXml()).toBe(authoritative)

		editor.destroy()
	})
})
