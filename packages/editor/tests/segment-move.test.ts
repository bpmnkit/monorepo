// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { EditorStateMachine } from "../src/state-machine.js"
import type { HitResult } from "../src/types.js"

// A Callbacks mock that records every invocation by name.
function makeCallbacks() {
	const calls: Record<string, unknown[][]> = {}
	// biome-ignore lint/suspicious/noExplicitAny: test stub proxying arbitrary callbacks
	const cb = new Proxy({} as any, {
		get: (_t, prop: string) => {
			return (...args: unknown[]) => {
				const list = calls[prop] ?? []
				list.push(args)
				calls[prop] = list
			}
		},
	})
	return { cb, calls }
}

const P = (clientX: number, clientY: number) => ({ clientX, clientY }) as PointerEvent

describe("segment move routing", () => {
	function segHit(nearMidpoint: boolean): HitResult {
		return {
			type: "edge-segment",
			id: "flow1",
			segIdx: 0,
			isHoriz: true,
			projPt: { x: 150, y: 100 },
			nearMidpoint,
		}
	}

	it("moves the segment when the drag starts away from the midpoint", () => {
		const { cb, calls } = makeCallbacks()
		const sm = new EditorStateMachine(cb)
		const hit = segHit(false)
		sm.onPointerDown(P(150, 100), { x: 150, y: 100 }, hit)
		sm.onPointerMove(P(150, 130), { x: 150, y: 130 }, hit)
		sm.onPointerUp(P(150, 130), { x: 150, y: 130 }, hit)

		expect(calls.commitSegmentMove?.[0]).toEqual(["flow1", 0, true, 30])
		expect(calls.commitWaypointInsert).toBeUndefined()
	})

	it("inserts a waypoint when the drag starts near the midpoint", () => {
		const { cb, calls } = makeCallbacks()
		const sm = new EditorStateMachine(cb)
		const hit = segHit(true)
		sm.onPointerDown(P(150, 100), { x: 150, y: 100 }, hit)
		sm.onPointerMove(P(150, 130), { x: 150, y: 130 }, hit)
		sm.onPointerUp(P(150, 130), { x: 150, y: 130 }, hit)

		expect(calls.commitWaypointInsert).toBeTruthy()
		expect(calls.commitSegmentMove).toBeUndefined()
	})
})
