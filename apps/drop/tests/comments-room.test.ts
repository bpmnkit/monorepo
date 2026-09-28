/**
 * The room's two jobs for comments: carrying names, so there is someone to
 * @mention, and fanning a stored comment out to everyone connected.
 */
import { beforeEach, describe, expect, it } from "vitest"
import type { Env } from "../src/env.js"
import { DocRoom, ROOM_COMMENT_PATH } from "../src/room.js"
import type { CommentView } from "../src/shared/comments.js"
import { migratedDb, seedFile } from "./d1.js"
import { type FakeSocket, FakeState, stubWebSocketGlobals } from "./do-state.js"
import { SIMPLE_BPMN } from "./fixtures.js"

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

const say = (ws: FakeSocket, message: unknown) =>
	room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify(message))

const COMMENT: CommentView = {
	id: "Abc123def456",
	filename: "order.bpmn",
	elementId: "task",
	elementLabel: "Do Work",
	parentId: null,
	authorName: "Anna",
	authorId: "0123456789abcdef",
	body: "@Ben have a look",
	mentions: ["Ben"],
	createdAt: 1,
	editedAt: null,
	deletedAt: null,
	resolvedAt: null,
	resolvedBy: null,
}

describe("names", () => {
	it("tells everyone who is here by name", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		await say(anna, { type: "name", name: "  Anna   Lee " })
		await say(ben, { type: "name", name: "Ben" })

		expect(anna.last("presence")).toMatchObject({ viewers: 2, names: ["Anna Lee", "Ben"] })
		expect(ben.last("presence")).toMatchObject({ names: ["Anna Lee", "Ben"] })
	})

	it("ignores a name that is not one, and one that has not changed", async () => {
		const anna = state.join("anna")
		await say(anna, { type: "name", name: "<img src=x>" })
		await say(anna, { type: "name", name: 42 })
		expect(anna.count("presence")).toBe(0)

		await say(anna, { type: "name", name: "Anna" })
		await say(anna, { type: "name", name: "Anna" })
		expect(anna.count("presence")).toBe(1)
	})

	it("stops broadcasting renames past the per-connection allowance", async () => {
		const anna = state.join("anna")
		for (let i = 0; i < 30; i++) await say(anna, { type: "name", name: `Anna ${i}` })
		expect(anna.count("presence")).toBe(20)
	})

	it("drops a name when its viewer leaves", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		await say(ben, { type: "name", name: "Ben" })
		await room.webSocketClose(ben as unknown as WebSocket)
		expect(anna.last("presence")).toMatchObject({ viewers: 1, names: [] })
	})
})

describe("fan-out", () => {
	it("delivers a stored comment to every connected viewer", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		const res = await room.fetch(
			new Request(`https://room${ROOM_COMMENT_PATH}`, {
				method: "POST",
				body: JSON.stringify(COMMENT),
			}),
		)
		expect(res.status).toBe(204)
		expect(anna.last("comment")).toEqual({ type: "comment", comment: COMMENT })
		expect(ben.last("comment")).toEqual({ type: "comment", comment: COMMENT })
	})

	it("does not treat a viewer's request as a fan-out", async () => {
		const anna = state.join("anna")
		const res = await room.fetch(
			new Request("https://bpmnkit.com/drop/api/presence/share1", {
				method: "POST",
				body: JSON.stringify(COMMENT),
			}),
		)
		expect(res.status).toBe(426)
		expect(anna.count("comment")).toBe(0)
	})
})
