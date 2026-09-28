import { parseDurationMs, setTimerClock } from "../timers.js"
import type { TimerClock } from "../timers.js"

interface Scheduled {
	readonly id: number
	readonly at: number
	readonly callback: () => void
}

/**
 * A clock that only moves when told to. Engine timers scheduled on it fire from
 * {@link VirtualClock.takeDue}, never on their own.
 */
export class VirtualClock implements TimerClock {
	private current: number
	private nextId = 0
	private readonly pending = new Map<number, Scheduled>()

	constructor(start: number) {
		this.current = start
	}

	now(): number {
		return this.current
	}

	setTimeout(callback: () => void, ms: number): unknown {
		const id = ++this.nextId
		this.pending.set(id, { id, at: this.current + Math.max(0, ms), callback })
		return id
	}

	clearTimeout(handle: unknown): void {
		this.pending.delete(handle as number)
	}

	/** Timers still waiting to fire. */
	get pendingCount(): number {
		return this.pending.size
	}

	/**
	 * Remove and return the earliest timer due at or before `until`, moving the
	 * clock forward to its due time. Timers due at the same instant fire in the
	 * order they were scheduled.
	 */
	takeDue(until: number): (() => void) | undefined {
		let next: Scheduled | undefined
		for (const timer of this.pending.values()) {
			if (timer.at > until) continue
			if (next === undefined || timer.at < next.at) next = timer
		}
		if (next === undefined) return undefined
		this.pending.delete(next.id)
		if (next.at > this.current) this.current = next.at
		return next.callback
	}

	/** Move the clock to `time` without firing anything. Never moves backwards. */
	moveTo(time: number): void {
		if (time > this.current) this.current = time
	}
}

/**
 * Clocks currently installed, most recent last. Engine timers are a module-level
 * concern, so the most recently created test owns them until it is disposed.
 */
const installed: VirtualClock[] = []

export function installClock(clock: VirtualClock): void {
	installed.push(clock)
	setTimerClock(clock)
}

export function uninstallClock(clock: VirtualClock): void {
	const index = installed.indexOf(clock)
	if (index !== -1) installed.splice(index, 1)
	setTimerClock(installed[installed.length - 1])
}

/** Milliseconds in `duration` — a number of ms or an ISO 8601 duration such as `PT1H`. */
export function toMilliseconds(duration: string | number): number {
	if (typeof duration === "number") {
		if (!Number.isFinite(duration) || duration < 0) {
			throw new RangeError(`advanceTime expects a non-negative number of ms, got ${duration}`)
		}
		return duration
	}
	const ms = parseDurationMs(duration)
	// parseDurationMs reads anything it cannot parse as 0 — only accept a 0 that was written as one.
	if (ms === 0 && !/^P(T?0+(\.0+)?[YMWDHS])+$/.test(duration.trim())) {
		throw new RangeError(
			`advanceTime expects an ISO 8601 duration such as "PT30M" or "P2D", got "${duration}"`,
		)
	}
	return ms
}
