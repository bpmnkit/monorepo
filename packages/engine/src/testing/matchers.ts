/** Lifecycle state of a process instance under test. */
export type RunState = "active" | "completed" | "failed" | "terminated"

/** What the matchers read from a run — {@link ProcessRun} satisfies it. */
export interface RunSnapshot {
	readonly processId: string
	readonly state: RunState
	/** Why the instance failed, when it did. */
	readonly error: string | undefined
	/** Process-level variables right now. */
	readonly variables: Record<string, unknown>
	/** Elements that completed, in completion order (repeats included). */
	readonly completedElements: readonly string[]
	/** Elements holding a token right now. */
	readonly activeElements: readonly string[]
}

/**
 * The slice of Vitest's and Jest's matcher context these matchers use. Both
 * runners pass a superset of it as `this`.
 */
export interface BpmnMatcherContext {
	readonly isNot: boolean
	equals(a: unknown, b: unknown): boolean
}

export interface BpmnMatcherResult {
	pass: boolean
	message: () => string
}

/**
 * Assertion methods added by {@link bpmnMatchers}. `R` is the runner's return
 * type — used to augment Vitest's `Assertion` or Jest's `Matchers`.
 */
export interface BpmnMatchers<R = unknown> {
	/** The instance reached an end state normally. */
	toHaveCompleted(): R
	/** The instance failed; optionally with an error matching `error`. */
	toHaveFailed(error?: string | RegExp): R
	/** Every listed element currently holds a token. */
	toBeWaitingAt(elementIds: string | readonly string[]): R
	/** Every listed element completed at least once, in any order. */
	toHavePassed(elementIds: readonly string[]): R
	/** The listed elements completed in this order (others may come in between). */
	toHavePassedInOrder(elementIds: readonly string[]): R
	/** None of the listed elements completed. */
	toHaveNotPassed(elementIds: readonly string[]): R
	/** Each listed process variable equals the expected value (asymmetric matchers work). */
	toHaveVariables(expected: Record<string, unknown>): R
}

function asRun(received: unknown): RunSnapshot {
	const r = received as Partial<RunSnapshot> | null
	if (
		r === null ||
		typeof r !== "object" ||
		typeof r.state !== "string" ||
		!Array.isArray(r.completedElements) ||
		!Array.isArray(r.activeElements)
	) {
		throw new TypeError(
			`BPMN matchers expect a run returned by ProcessTest.start() — got ${describe(received)}`,
		)
	}
	return r as RunSnapshot
}

function describe(value: unknown): string {
	if (value === null || typeof value !== "object") return String(value)
	return Object.prototype.toString.call(value)
}

function list(ids: readonly string[]): string {
	return ids.length === 0 ? "(none)" : `[${ids.join(", ")}]`
}

function where(run: RunSnapshot): string {
	const state = run.error !== undefined ? `${run.state}: ${run.error}` : run.state
	return `process "${run.processId}" is ${state}; waiting at ${list(run.activeElements)}; completed ${list(run.completedElements)}`
}

function toArray(ids: string | readonly string[]): readonly string[] {
	return typeof ids === "string" ? [ids] : ids
}

/**
 * Custom matchers for runs of a {@link ProcessTest}. Register them with
 * `expect.extend(bpmnMatchers)` in Jest, or import
 * `@bpmnkit/engine/testing/vitest` in a Vitest setup file.
 */
export const bpmnMatchers = {
	toHaveCompleted(this: BpmnMatcherContext, received: unknown): BpmnMatcherResult {
		const run = asRun(received)
		const pass = run.state === "completed"
		return {
			pass,
			message: () =>
				pass
					? `expected process "${run.processId}" not to have completed`
					: `expected process "${run.processId}" to have completed — ${where(run)}`,
		}
	},

	toHaveFailed(
		this: BpmnMatcherContext,
		received: unknown,
		error?: string | RegExp,
	): BpmnMatcherResult {
		const run = asRun(received)
		const matches =
			error === undefined ||
			(run.error !== undefined &&
				(typeof error === "string" ? run.error.includes(error) : error.test(run.error)))
		const pass = run.state === "failed" && matches
		const wanted = error === undefined ? "" : ` with an error matching ${String(error)}`
		return {
			pass,
			message: () =>
				pass
					? `expected process "${run.processId}" not to have failed${wanted} — ${where(run)}`
					: `expected process "${run.processId}" to have failed${wanted} — ${where(run)}`,
		}
	},

	toBeWaitingAt(
		this: BpmnMatcherContext,
		received: unknown,
		elementIds: string | readonly string[],
	): BpmnMatcherResult {
		const run = asRun(received)
		const ids = toArray(elementIds)
		const missing = ids.filter((id) => !run.activeElements.includes(id))
		const pass = missing.length === 0
		return {
			pass,
			message: () =>
				pass
					? `expected process "${run.processId}" not to be waiting at ${list(ids)}`
					: `expected process "${run.processId}" to be waiting at ${list(missing)} — ${where(run)}`,
		}
	},

	toHavePassed(
		this: BpmnMatcherContext,
		received: unknown,
		elementIds: readonly string[],
	): BpmnMatcherResult {
		const run = asRun(received)
		const missing = elementIds.filter((id) => !run.completedElements.includes(id))
		const pass = missing.length === 0
		return {
			pass,
			message: () =>
				pass
					? `expected process "${run.processId}" not to have passed all of ${list(elementIds)}`
					: `expected process "${run.processId}" to have passed ${list(missing)} — ${where(run)}`,
		}
	},

	toHavePassedInOrder(
		this: BpmnMatcherContext,
		received: unknown,
		elementIds: readonly string[],
	): BpmnMatcherResult {
		const run = asRun(received)
		let cursor = 0
		let firstMissing: string | undefined
		for (const id of elementIds) {
			const index = run.completedElements.indexOf(id, cursor)
			if (index === -1) {
				firstMissing = id
				break
			}
			cursor = index + 1
		}
		const pass = firstMissing === undefined
		return {
			pass,
			message: () =>
				pass
					? `expected process "${run.processId}" not to have passed ${list(elementIds)} in order`
					: `expected process "${run.processId}" to have passed ${list(elementIds)} in order, but "${firstMissing}" did not complete after the ones before it — ${where(run)}`,
		}
	},

	toHaveNotPassed(
		this: BpmnMatcherContext,
		received: unknown,
		elementIds: readonly string[],
	): BpmnMatcherResult {
		const run = asRun(received)
		const passed = elementIds.filter((id) => run.completedElements.includes(id))
		const pass = passed.length === 0
		return {
			pass,
			message: () =>
				pass
					? `expected process "${run.processId}" to have passed at least one of ${list(elementIds)}`
					: `expected process "${run.processId}" not to have passed ${list(passed)} — ${where(run)}`,
		}
	},

	toHaveVariables(
		this: BpmnMatcherContext,
		received: unknown,
		expected: Record<string, unknown>,
	): BpmnMatcherResult {
		const run = asRun(received)
		const vars = run.variables
		const mismatched = Object.keys(expected).filter(
			(key) => !(key in vars) || !this.equals(vars[key], expected[key]),
		)
		const pass = mismatched.length === 0
		const show = (keys: readonly string[], from: Record<string, unknown>) =>
			keys.map((k) => `${k}=${k in from ? JSON.stringify(from[k]) : "<unset>"}`).join(", ")
		return {
			pass,
			message: () =>
				pass
					? `expected process "${run.processId}" variables not to match ${show(Object.keys(expected), expected)}`
					: `expected process "${run.processId}" variables ${show(mismatched, expected)}, got ${show(mismatched, vars)}`,
		}
	},
} as const
