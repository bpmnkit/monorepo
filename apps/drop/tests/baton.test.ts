import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Env } from "../src/env.js"
import { DocRoom } from "../src/room.js"
import { BATON_IDLE_MS, BATON_WARN_MS, SOCKET_DEAD_MS } from "../src/shared/room-protocol.js"
import { migratedDb } from "./d1.js"
import { type FakeSocket, FakeState, stubWebSocketGlobals } from "./do-state.js"

stubWebSocketGlobals()

const T0 = 1_800_000_000_000

let state: FakeState
let room: DocRoom

beforeEach(() => {
	// One clock for the whole test: a claim recorded at the real `Date.now()` and
	// an alarm fired at a mocked one would read as millions of minutes idle.
	vi.useFakeTimers()
	vi.setSystemTime(T0)
	state = new FakeState()
	room = new DocRoom(state as unknown as DurableObjectState, { DB: migratedDb() } as unknown as Env)
})

afterEach(() => {
	vi.useRealTimers()
})

/** Sends a client message the way the runtime delivers one. */
function send(ws: FakeSocket, type: "claim" | "release") {
	return room.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ type }))
}

/**
 * Runs the alarm as if the clock had reached `at`, with every connection healthy.
 *
 * Refreshing the heartbeats is what makes this the *idle* case rather than the
 * dead-socket one: a browser sitting untouched still pings every thirty seconds,
 * so the socket is alive and only the human is absent. `fireSilent` is the other
 * case, where nothing has been heard from the socket at all.
 */
function fire(at: number) {
	for (const ws of state.getWebSockets()) state.ping(ws, at)
	return fireSilent(at)
}

/** Runs the alarm at `at` without refreshing any heartbeat. */
function fireSilent(at: number) {
	vi.setSystemTime(at)
	return room.alarm()
}

describe("claiming", () => {
	it("grants the baton to the first claimant", async () => {
		const anna = state.join("anna")
		await send(anna, "claim")

		expect(anna.last("granted")).toMatchObject({ holder: "anna", idleMs: BATON_IDLE_MS })
		expect(await state.storage.get("holder")).toBe("anna")
	})

	it("denies a second claimant and names who holds it", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		await send(anna, "claim")
		await send(ben, "claim")

		expect(ben.last("denied")).toMatchObject({ holder: "anna" })
		expect(ben.last("granted")).toBeUndefined()
		expect(await state.storage.get("holder")).toBe("anna")
	})

	it("is idempotent for the holder — re-claiming is not a denial", async () => {
		const anna = state.join("anna")
		await send(anna, "claim")
		await send(anna, "claim")
		expect(anna.count("granted")).toBe(2)
		expect(anna.last("denied")).toBeUndefined()
	})

	it("tells the room who holds it", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		await send(anna, "claim")
		expect(ben.last<{ holder: string | null }>("presence")?.holder).toBe("anna")
	})
})

describe("releasing", () => {
	it("frees the baton and says so", async () => {
		const anna = state.join("anna")
		await send(anna, "claim")
		await send(anna, "release")

		expect(anna.last("revoked")).toMatchObject({ reason: "released" })
		expect(await state.storage.get("holder")).toBeUndefined()
	})

	it("ignores a release from someone who does not hold it", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		await send(anna, "claim")
		await send(ben, "release")

		expect(ben.last("revoked")).toBeUndefined()
		expect(await state.storage.get("holder")).toBe("anna")
	})

	it("frees the baton when the holder's tab closes", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		await send(anna, "claim")
		await room.webSocketClose(anna as unknown as WebSocket)

		expect(await state.storage.get("holder")).toBeUndefined()
		expect(ben.last<{ holder: string | null }>("presence")?.holder).toBeNull()
	})

	it("leaves the baton alone when a watcher's tab closes", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		await send(anna, "claim")
		await room.webSocketClose(ben as unknown as WebSocket)
		expect(await state.storage.get("holder")).toBe("anna")
	})
})

describe("reclaiming from an absent holder", () => {
	it("warns once before taking it", async () => {
		const anna = state.join("anna")
		await send(anna, "claim")

		await fire(T0 + BATON_IDLE_MS - BATON_WARN_MS + 1_000)
		expect(anna.last<{ secondsLeft: number }>("warning")?.secondsLeft).toBeGreaterThan(0)
		expect(anna.last("revoked")).toBeUndefined()

		// A second alarm inside the window must not nag again.
		await fire(T0 + BATON_IDLE_MS - BATON_WARN_MS + 20_000)
		expect(anna.count("warning")).toBe(1)
	})

	it("takes it once the idle window elapses", async () => {
		const anna = state.join("anna")
		await send(anna, "claim")

		await fire(T0 + BATON_IDLE_MS + 1)
		expect(anna.last("revoked")).toMatchObject({ reason: "idle" })
		expect(await state.storage.get("holder")).toBeUndefined()
	})

	it("does not take it from someone who is still working", async () => {
		const anna = state.join("anna")
		await send(anna, "claim")

		// Any message that wakes the room is activity — that is the whole point of
		// keying the idle clock on those rather than on heartbeats.
		await send(anna, "claim")
		await fire(T0 + BATON_IDLE_MS - 1_000)

		expect(anna.last("revoked")).toBeUndefined()
		expect(await state.storage.get("holder")).toBe("anna")
	})

	it("clears a pending warning when the holder acts again", async () => {
		const anna = state.join("anna")
		await send(anna, "claim")
		await fire(T0 + BATON_IDLE_MS - BATON_WARN_MS + 1_000)
		expect(anna.count("warning")).toBe(1)

		await send(anna, "claim")
		expect(await state.storage.get("warnedAt")).toBeUndefined()
	})
})

describe("reclaiming from a dead socket", () => {
	it("takes the baton when the holder stops pinging", async () => {
		// A closed laptop lid: the socket is still attached, but nothing is behind it.
		const anna = state.join("anna")
		await send(anna, "claim")
		state.ping(anna, T0)

		await fireSilent(T0 + SOCKET_DEAD_MS + 1_000)
		expect(anna.last("revoked")).toMatchObject({ reason: "disconnected" })
		expect(await state.storage.get("holder")).toBeUndefined()
	})

	it("keeps the baton while heartbeats keep arriving", async () => {
		const anna = state.join("anna")
		await send(anna, "claim")
		state.ping(anna, T0 + SOCKET_DEAD_MS)

		await fireSilent(T0 + SOCKET_DEAD_MS + 1_000)
		expect(anna.last("revoked")).toBeUndefined()
		expect(await state.storage.get("holder")).toBe("anna")
	})

	it("takes the baton when the socket is gone entirely", async () => {
		const anna = state.join("anna")
		const ben = state.join("ben")
		await send(anna, "claim")
		state.vanish(anna)

		await fireSilent(T0 + 1_000)
		expect(await state.storage.get("holder")).toBeUndefined()
		expect(ben.last<{ holder: string | null }>("presence")?.holder).toBeNull()
	})

	it("does not call a socket dead before it has ever pinged", async () => {
		const anna = state.join("anna")
		await send(anna, "claim")
		// No ping recorded yet — a connection seconds old must not be reaped.
		await fireSilent(T0 + 1_000)
		expect(await state.storage.get("holder")).toBe("anna")
	})
})

describe("the single alarm", () => {
	it("arms while the baton is held", async () => {
		const anna = state.join("anna")
		await send(anna, "claim")
		expect(await state.alarm).not.toBeNull()
	})

	it("clears once nothing is waiting", async () => {
		const anna = state.join("anna")
		await send(anna, "claim")
		await send(anna, "release")
		// No holder and no pending views: a quiet room should hold no timer at all.
		await fire(T0)
		expect(await state.alarm).toBeNull()
	})
})
