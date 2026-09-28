import type { BpmnTimerEventDefinition } from "@bpmnkit/core"

/**
 * The time source every engine timer is scheduled on. The default is the real
 * clock; `@bpmnkit/engine/testing` swaps in a virtual one so tests can advance
 * time instead of waiting for it.
 */
export interface TimerClock {
	now(): number
	setTimeout(callback: () => void, ms: number): unknown
	clearTimeout(handle: unknown): void
}

const realClock: TimerClock = {
	now: () => Date.now(),
	setTimeout: (callback, ms) => setTimeout(callback, ms),
	clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

let clock: TimerClock = realClock

/**
 * Route timers scheduled from now on through `next` (or back to the real clock
 * with `undefined`). Timers already scheduled stay on the clock they started on.
 */
export function setTimerClock(next: TimerClock | undefined): void {
	clock = next ?? realClock
}

/**
 * Schedule a timer from a BPMN timer event definition.
 * Supports ISO 8601 durations (PT2M), dates (2025-06-01T00:00:00Z),
 * and cycles (R3/PT5S — fires N times or indefinitely when R/...).
 * Returns a cancel function.
 */
export function scheduleTimer(def: BpmnTimerEventDefinition, callback: () => void): () => void {
	if (def.timeDuration !== undefined) {
		return scheduleAfterDuration(def.timeDuration, callback)
	}
	if (def.timeDate !== undefined) {
		return scheduleAtDate(def.timeDate, callback)
	}
	if (def.timeCycle !== undefined) {
		return scheduleCycle(def.timeCycle, callback)
	}
	// No timer definition — fire immediately
	const c = clock
	const id = c.setTimeout(callback, 0)
	return () => c.clearTimeout(id)
}

function scheduleAfterDuration(duration: string, cb: () => void): () => void {
	const ms = parseDurationMs(duration)
	const c = clock
	const id = c.setTimeout(cb, ms)
	return () => c.clearTimeout(id)
}

function scheduleAtDate(dateStr: string, cb: () => void): () => void {
	const target = new Date(dateStr).getTime()
	const c = clock
	const ms = Math.max(0, target - c.now())
	const id = c.setTimeout(cb, ms)
	return () => c.clearTimeout(id)
}

function scheduleCycle(cycle: string, cb: () => void): () => void {
	// Format: R<n>/<duration> or R/<duration> (infinite) or just <duration>
	const cycleMatch = /^R(\d*)\/(.+)$/.exec(cycle)
	if (cycleMatch === null) {
		return scheduleAfterDuration(cycle, cb)
	}
	const countStr = cycleMatch[1]
	const durationStr = cycleMatch[2] ?? ""
	const maxFires =
		countStr === "" || countStr === undefined ? Number.POSITIVE_INFINITY : Number(countStr)
	const ms = parseDurationMs(durationStr)

	const c = clock
	let fired = 0
	let cancelled = false
	let timerId: unknown

	const fire = (): void => {
		if (cancelled) return
		cb()
		fired++
		if (fired < maxFires) {
			timerId = c.setTimeout(fire, ms)
		}
	}

	timerId = c.setTimeout(fire, ms)
	return () => {
		cancelled = true
		if (timerId !== undefined) c.clearTimeout(timerId)
	}
}

/**
 * Parse an ISO 8601 duration string into milliseconds.
 * Handles: PT#S, PT#M, PT#H, P#D, P#W, and combinations.
 */
export function parseDurationMs(duration: string): number {
	const re =
		/^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
	const m = re.exec(duration.trim())
	if (m === null) return 0

	const years = Number(m[1] ?? 0)
	const months = Number(m[2] ?? 0)
	const weeks = Number(m[3] ?? 0)
	const days = Number(m[4] ?? 0)
	const hours = Number(m[5] ?? 0)
	const minutes = Number(m[6] ?? 0)
	const seconds = Number(m[7] ?? 0)

	return (
		years * 365.25 * 24 * 3600 * 1000 +
		months * 30.44 * 24 * 3600 * 1000 +
		weeks * 7 * 24 * 3600 * 1000 +
		days * 24 * 3600 * 1000 +
		hours * 3600 * 1000 +
		minutes * 60 * 1000 +
		seconds * 1000
	)
}
