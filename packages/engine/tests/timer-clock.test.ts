import { afterEach, describe, expect, it } from "vitest"
import { scheduleTimer, setTimerClock } from "../src/timers.js"
import type { TimerClock } from "../src/timers.js"

function recordingClock(now: number): TimerClock & { scheduled: number[]; cleared: number } {
	const clock = {
		scheduled: [] as number[],
		cleared: 0,
		now: () => now,
		setTimeout: (_cb: () => void, ms: number) => {
			clock.scheduled.push(ms)
			return clock.scheduled.length
		},
		clearTimeout: () => {
			clock.cleared++
		},
	}
	return clock
}

describe("setTimerClock", () => {
	afterEach(() => setTimerClock(undefined))

	it("routes durations, dates and cycles through the installed clock", () => {
		const clock = recordingClock(Date.parse("2026-01-01T00:00:00Z"))
		setTimerClock(clock)

		scheduleTimer({ type: "timer", timeDuration: "PT1M" }, () => {})
		scheduleTimer({ type: "timer", timeDate: "2026-01-01T01:00:00Z" }, () => {})
		const cancel = scheduleTimer({ type: "timer", timeCycle: "R2/PT5S" }, () => {})
		cancel()

		expect(clock.scheduled).toEqual([60_000, 3_600_000, 5_000])
		expect(clock.cleared).toBe(1)
	})

	it("cancels a timer on the clock it was scheduled on, even after the clock is swapped", () => {
		const first = recordingClock(0)
		setTimerClock(first)
		const cancel = scheduleTimer({ type: "timer", timeDuration: "PT1S" }, () => {})
		setTimerClock(undefined)
		cancel()
		expect(first.cleared).toBe(1)
	})
})
