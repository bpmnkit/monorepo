import type { FeelNode } from "./ast.js"
import { compareValues, getBuiltin, parseTemporal } from "./builtins.js"
import type { FeelContext, FeelFunction, FeelValue } from "./types.js"
import {
	getProperty,
	isFeelContext,
	isFeelDate,
	isFeelDateTime,
	isFeelDayTimeDuration,
	isFeelList,
	isFeelRange,
	isFeelTime,
	isFeelYearsMonthsDuration,
} from "./types.js"

export interface EvalContext {
	vars: Record<string, FeelValue>
	parent?: EvalContext
	input?: FeelValue
}

function lookupVar(ctx: EvalContext, name: string): FeelValue {
	if (name === "?") return ctx.input ?? null
	const v = ctx.vars[name]
	if (v !== undefined) return v
	if (ctx.parent) return lookupVar(ctx.parent, name)
	return null
}

function childCtx(parent: EvalContext, vars: Record<string, FeelValue> = {}): EvalContext {
	return { vars, parent, input: parent.input }
}

// -------------------------------------------------------------------------
// Arithmetic helpers for temporal types
// -------------------------------------------------------------------------

function addDuration(date: FeelValue, dur: FeelValue): FeelValue {
	if (isFeelDate(date) && isFeelYearsMonthsDuration(dur)) {
		let m = date.month + dur.months
		let y = date.year
		y += Math.floor((m - 1) / 12)
		m = ((m - 1 + 1200) % 12) + 1
		return { type: "date", year: y, month: m, day: date.day }
	}
	if (isFeelDate(date) && isFeelDayTimeDuration(dur)) {
		const EPOCH = dateToEpochDays(date)
		const newEpoch = EPOCH + Math.floor(dur.seconds / 86400)
		return epochDaysToDate(newEpoch)
	}
	if (isFeelDateTime(date) && isFeelDayTimeDuration(dur)) {
		const totalSec = dateTimeToEpochSeconds(date) + dur.seconds
		return epochSecondsToDateTime(totalSec, date.time.offsetSeconds, date.time.timezone)
	}
	if (isFeelDateTime(date) && isFeelYearsMonthsDuration(dur)) {
		const d = date.date
		let m = d.month + dur.months
		let y = d.year
		y += Math.floor((m - 1) / 12)
		m = ((m - 1 + 1200) % 12) + 1
		return {
			type: "date-time",
			date: { type: "date", year: y, month: m, day: d.day },
			time: date.time,
		}
	}
	if (isFeelDayTimeDuration(date) && isFeelDayTimeDuration(dur)) {
		return { type: "days-time-duration", seconds: date.seconds + dur.seconds }
	}
	if (isFeelYearsMonthsDuration(date) && isFeelYearsMonthsDuration(dur)) {
		return { type: "years-months-duration", months: date.months + dur.months }
	}
	return null
}

function subtractValues(a: FeelValue, b: FeelValue): FeelValue {
	if (typeof a === "number" && typeof b === "number") return a - b
	if (isFeelDate(a) && isFeelDate(b)) {
		const diff = dateToEpochDays(a) - dateToEpochDays(b)
		return { type: "days-time-duration", seconds: diff * 86400 }
	}
	if (isFeelDate(a) && isFeelDayTimeDuration(b)) {
		return addDuration(a, { type: "days-time-duration", seconds: -b.seconds })
	}
	if (isFeelDate(a) && isFeelYearsMonthsDuration(b)) {
		return addDuration(a, { type: "years-months-duration", months: -b.months })
	}
	if (isFeelDateTime(a) && isFeelDateTime(b)) {
		const diff = dateTimeToEpochSeconds(a) - dateTimeToEpochSeconds(b)
		return { type: "days-time-duration", seconds: diff }
	}
	if (isFeelDateTime(a) && isFeelDayTimeDuration(b)) {
		return addDuration(a, { type: "days-time-duration", seconds: -b.seconds })
	}
	if (isFeelDateTime(a) && isFeelYearsMonthsDuration(b)) {
		return addDuration(a, { type: "years-months-duration", months: -b.months })
	}
	if (isFeelDayTimeDuration(a) && isFeelDayTimeDuration(b)) {
		return { type: "days-time-duration", seconds: a.seconds - b.seconds }
	}
	if (isFeelYearsMonthsDuration(a) && isFeelYearsMonthsDuration(b)) {
		return { type: "years-months-duration", months: a.months - b.months }
	}
	return null
}

function DAYS_IN_MONTH_TABLE(y: number, m: number): number {
	const table = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
	if (m === 2 && ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)) return 29
	return table[m] ?? 30
}

function dateToEpochDays(d: import("./types.js").FeelDate): number {
	const y = d.year - 1
	let days = 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400)
	for (let m = 1; m < d.month; m++) days += DAYS_IN_MONTH_TABLE(d.year, m)
	days += d.day
	return days - 719163
}

function epochDaysToDate(days: number): import("./types.js").FeelDate {
	let remaining = days + 719162
	const year400 = Math.floor(remaining / 146097)
	remaining %= 146097
	const year100 = Math.min(Math.floor(remaining / 36524), 3)
	remaining -= year100 * 36524
	const year4 = Math.floor(remaining / 1461)
	remaining %= 1461
	const year1 = Math.min(Math.floor(remaining / 365), 3)
	remaining -= year1 * 365
	const year = year400 * 400 + year100 * 100 + year4 * 4 + year1 + 1
	let month = 1
	while (month <= 12 && remaining >= DAYS_IN_MONTH_TABLE(year, month)) {
		remaining -= DAYS_IN_MONTH_TABLE(year, month)
		month++
	}
	return { type: "date", year, month, day: remaining + 1 }
}

function dateTimeToEpochSeconds(dt: import("./types.js").FeelDateTime): number {
	const days = dateToEpochDays(dt.date)
	return (
		days * 86400 +
		dt.time.hour * 3600 +
		dt.time.minute * 60 +
		dt.time.second -
		(dt.time.offsetSeconds ?? 0)
	)
}

function epochSecondsToDateTime(
	secs: number,
	offsetSeconds: number | undefined,
	timezone: string | undefined,
): import("./types.js").FeelDateTime {
	const localSecs = secs + (offsetSeconds ?? 0)
	const days = Math.floor(localSecs / 86400)
	const rem = ((localSecs % 86400) + 86400) % 86400
	const date = epochDaysToDate(days)
	const time: import("./types.js").FeelTime = {
		type: "time",
		hour: Math.floor(rem / 3600),
		minute: Math.floor((rem % 3600) / 60),
		second: rem % 60,
		offsetSeconds,
		timezone,
	}
	return { type: "date-time", date, time }
}

// -------------------------------------------------------------------------
// Core evaluator
// -------------------------------------------------------------------------

export function evaluate(node: FeelNode, ctx: EvalContext): FeelValue {
	switch (node.kind) {
		case "null":
			return null
		case "boolean":
			return node.value
		case "number":
			return node.value
		case "string":
			return node.value
		case "temporal":
			return parseTemporal(node.raw)

		case "name": {
			if (node.name === "?") return ctx.input ?? null
			// Check built-in
			const builtin = getBuiltin(node.name)
			if (builtin) return builtin
			return lookupVar(ctx, node.name)
		}

		case "unary-minus": {
			const val = evaluate(node.operand, ctx)
			if (typeof val === "number") return -val
			if (isFeelDayTimeDuration(val)) return { type: "days-time-duration", seconds: -val.seconds }
			if (isFeelYearsMonthsDuration(val))
				return { type: "years-months-duration", months: -val.months }
			return null
		}

		case "binary":
			return evalBinary(node.op, node.left, node.right, ctx)

		case "list":
			return node.items.map((item) => evaluate(item, ctx))

		case "context": {
			const result: FeelContext = {}
			for (const entry of node.entries) {
				result[entry.key] = evaluate(entry.value, ctx)
			}
			return result
		}

		case "range": {
			const rangeStart = evaluate(node.low, ctx)
			const rangeEnd = evaluate(node.high, ctx)
			return {
				type: "range",
				start: rangeStart,
				startIncluded: node.startIncluded,
				end: rangeEnd,
				endIncluded: node.endIncluded,
			}
		}

		case "path": {
			const base = evaluate(node.base, ctx)
			if (base === null) return null
			// Path on a list maps over elements
			if (isFeelList(base)) {
				return base.map((item) => getProperty(item, node.key))
			}
			return getProperty(base, node.key)
		}

		case "filter": {
			const base = evaluate(node.base, ctx)
			if (!isFeelList(base)) {
				if (base === null) return []
				// single value
				const result = evaluate(node.condition, childCtx(ctx, { item: base }))
				return typeof result === "number" ? [base] : result ? [base] : []
			}
			// Numeric index filter
			const first = evaluate(node.condition, childCtx(ctx, { item: base[0] ?? null }))
			if (typeof first === "number") {
				const idx = first > 0 ? first - 1 : base.length + first
				const val = base[Math.floor(idx)]
				return val !== undefined ? val : null
			}
			return base.filter((item) => {
				const r = evaluate(node.condition, childCtx(ctx, { item }))
				return r === true || (r !== false && r !== null)
			})
		}

		case "call":
			return evalCall(node.callee, node.args, ctx)

		case "call-named": {
			const builtin = getBuiltin(node.callee)
			if (!builtin) {
				const fn = lookupVar(ctx, node.callee)
				if (fn === null || typeof fn !== "object" || !("call" in fn)) return null
				const args = node.args.map((a) => evaluate(a.value, ctx))
				return (fn as FeelFunction).call(args)
			}
			// Map named args to positional (built-ins don't declare param names in registry)
			const args = node.args.map((a) => evaluate(a.value, ctx))
			return builtin.call(args)
		}

		case "if": {
			const cond = evaluate(node.condition, ctx)
			return cond === true ? evaluate(node.then, ctx) : evaluate(node.else, ctx)
		}

		case "for": {
			const domains: FeelValue[][] = []
			for (const binding of node.bindings) {
				const d = evaluate(binding.domain, ctx)
				domains.push(isFeelList(d) ? d : [d])
			}
			const partial: FeelValue[] = []
			const results = evalCartesian(node.bindings, domains, 0, ctx, node, partial)
			return results
		}

		case "some": {
			const domains: FeelValue[][] = []
			for (const binding of node.bindings) {
				const d = evaluate(binding.domain, ctx)
				domains.push(isFeelList(d) ? d : [d])
			}
			return evalQuantifier("some", node.bindings, domains, 0, ctx, node.satisfies)
		}

		case "every": {
			const domains: FeelValue[][] = []
			for (const binding of node.bindings) {
				const d = evaluate(binding.domain, ctx)
				domains.push(isFeelList(d) ? d : [d])
			}
			return evalQuantifier("every", node.bindings, domains, 0, ctx, node.satisfies)
		}

		case "between": {
			const val = evaluate(node.value, ctx)
			const low = evaluate(node.low, ctx)
			const high = evaluate(node.high, ctx)
			const cmpLow = compareValues(val, low)
			const cmpHigh = compareValues(val, high)
			if (cmpLow === null || cmpHigh === null) return null
			return cmpLow >= 0 && cmpHigh <= 0
		}

		case "in-test": {
			const val = evaluate(node.value, ctx)
			const test = evaluate(node.test, ctx)
			return testIncludes(test, val)
		}

		case "instance-of": {
			const val = evaluate(node.value, ctx)
			return checkInstanceOf(val, node.typeName)
		}

		case "function-def":
			return {
				type: "function",
				paramNames: node.params,
				call: (args: FeelValue[]) => {
					const vars: Record<string, FeelValue> = {}
					for (let i = 0; i < node.params.length; i++) {
						vars[node.params[i] ?? ""] = args[i] ?? null
					}
					return evaluate(node.body, childCtx(ctx, vars))
				},
			} satisfies FeelFunction

		case "any-input":
			return true

		case "unary-test-list": {
			const input = ctx.input ?? null
			for (const test of node.tests) {
				const r = evaluateUnaryTest(test, input, ctx)
				if (r) return true
			}
			return false
		}

		case "unary-not": {
			const input = ctx.input ?? null
			for (const test of node.tests) {
				const r = evaluateUnaryTest(test, input, ctx)
				if (r) return false
			}
			return true
		}
	}
}

function evalBinary(
	op: import("./ast.js").BinaryOp,
	leftNode: FeelNode,
	rightNode: FeelNode,
	ctx: EvalContext,
): FeelValue {
	// Short-circuit for and/or
	if (op === "and") {
		const l = evaluate(leftNode, ctx)
		if (l === false) return false
		const r = evaluate(rightNode, ctx)
		if (r === false) return false
		if (l === null || r === null) return null
		return true
	}
	if (op === "or") {
		const l = evaluate(leftNode, ctx)
		if (l === true) return true
		const r = evaluate(rightNode, ctx)
		if (r === true) return true
		if (l === null || r === null) return null
		return false
	}

	const left = evaluate(leftNode, ctx)
	const right = evaluate(rightNode, ctx)

	if (op === "=") return deepEqual(left, right)
	if (op === "!=") return !deepEqual(left, right)

	if (left === null || right === null) return null

	if (op === "+" || op === "-") {
		if (typeof left === "number" && typeof right === "number") {
			return op === "+" ? left + right : left - right
		}
		if (typeof left === "string" && typeof right === "string" && op === "+") {
			return left + right
		}
		if (op === "+") return addDuration(left, right)
		return subtractValues(left, right)
	}
	if (op === "*") {
		if (typeof left === "number" && typeof right === "number") return left * right
		if (typeof left === "number" && isFeelDayTimeDuration(right))
			return { type: "days-time-duration", seconds: left * right.seconds }
		if (typeof left === "number" && isFeelYearsMonthsDuration(right))
			return { type: "years-months-duration", months: left * right.months }
		if (isFeelDayTimeDuration(left) && typeof right === "number")
			return { type: "days-time-duration", seconds: left.seconds * right }
		if (isFeelYearsMonthsDuration(left) && typeof right === "number")
			return { type: "years-months-duration", months: left.months * right }
		return null
	}
	if (op === "/") {
		if (typeof left === "number" && typeof right === "number") {
			return right === 0 ? null : left / right
		}
		if (isFeelDayTimeDuration(left) && typeof right === "number")
			return { type: "days-time-duration", seconds: left.seconds / right }
		if (isFeelYearsMonthsDuration(left) && typeof right === "number")
			return { type: "years-months-duration", months: left.months / right }
		return null
	}
	if (op === "**") {
		if (typeof left === "number" && typeof right === "number") return left ** right
		return null
	}

	// Comparison
	const cmp = compareValues(left, right)
	if (cmp === null) return null
	if (op === "<") return cmp < 0
	if (op === "<=") return cmp <= 0
	if (op === ">") return cmp > 0
	if (op === ">=") return cmp >= 0
	return null
}

function evalCall(callee: string, argNodes: FeelNode[], ctx: EvalContext): FeelValue {
	const builtin = getBuiltin(callee)
	if (builtin) {
		const args = argNodes.map((a) => evaluate(a, ctx))
		return builtin.call(args)
	}
	const fn = lookupVar(ctx, callee)
	if (fn === null || typeof fn !== "object" || !("call" in fn)) return null
	const args = argNodes.map((a) => evaluate(a, ctx))
	return (fn as FeelFunction).call(args)
}

function evalCartesian(
	bindings: Array<{ name: string; domain: FeelNode }>,
	domains: FeelValue[][],
	idx: number,
	ctx: EvalContext,
	forNode: FeelNode & { kind: "for"; body: FeelNode },
	partial: FeelValue[],
): FeelValue[] {
	if (idx === bindings.length) {
		const vars: Record<string, FeelValue> = { partial: [...partial] }
		const binding = bindings[idx - 1]
		if (binding) vars[binding.name] = partial[partial.length - 1] ?? null
		const result = evaluate(forNode.body, childCtx(ctx, vars))
		partial.push(result)
		return [result]
	}
	const binding = bindings[idx]
	if (!binding) return []
	const domain = domains[idx] ?? []
	const results: FeelValue[] = []
	for (const val of domain) {
		const vars: Record<string, FeelValue> = { partial: [...partial] }
		vars[binding.name] = val
		// Propagate earlier bindings too
		for (let i = 0; i < idx; i++) {
			const b = bindings[i]
			if (b) vars[b.name] = partial[i] ?? null
		}
		const sub = evalCartesian(bindings, domains, idx + 1, childCtx(ctx, vars), forNode, [
			...partial,
			val,
		])
		results.push(...sub)
	}
	return results
}

function evalQuantifier(
	kind: "some" | "every",
	bindings: Array<{ name: string; domain: FeelNode }>,
	domains: FeelValue[][],
	idx: number,
	ctx: EvalContext,
	satisfies: FeelNode,
): FeelValue {
	if (idx === bindings.length) {
		return evaluate(satisfies, ctx)
	}
	const binding = bindings[idx]
	if (!binding) return kind === "every"
	const domain = domains[idx] ?? []
	if (domain.length === 0) return kind === "every"
	let hasNull = false
	for (const val of domain) {
		const vars: Record<string, FeelValue> = {}
		vars[binding.name] = val
		const r = evalQuantifier(kind, bindings, domains, idx + 1, childCtx(ctx, vars), satisfies)
		if (kind === "some" && r === true) return true
		if (kind === "every" && r === false) return false
		if (r === null) hasNull = true
	}
	if (kind === "some") return hasNull ? null : false
	return hasNull ? null : true
}

function deepEqual(a: FeelValue, b: FeelValue): boolean {
	if (a === b) return true
	if (a === null || b === null) return false
	if (typeof a !== typeof b) return false
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i] ?? null, b[i] ?? null)) return false
		}
		return true
	}
	if (typeof a === "object" && typeof b === "object") {
		const aKeys = Object.keys(a)
		const bKeys = Object.keys(b)
		if (aKeys.length !== bKeys.length) return false
		for (const k of aKeys) {
			const av = (a as Record<string, FeelValue>)[k] ?? null
			const bv = (b as Record<string, FeelValue>)[k] ?? null
			if (!deepEqual(av, bv)) return false
		}
		return true
	}
	return false
}

function testIncludes(test: FeelValue, val: FeelValue): FeelValue {
	if (isFeelRange(test)) {
		const cmpStart = compareValues(val, test.start)
		const cmpEnd = compareValues(val, test.end)
		if (cmpStart === null || cmpEnd === null) return null
		const startOk = test.startIncluded ? cmpStart >= 0 : cmpStart > 0
		const endOk = test.endIncluded ? cmpEnd <= 0 : cmpEnd < 0
		return startOk && endOk
	}
	if (isFeelList(test)) {
		for (const t of test) {
			const r = testIncludes(t, val)
			if (r === true) return true
		}
		return false
	}
	return deepEqual(val, test)
}

function checkInstanceOf(val: FeelValue, typeName: string): boolean {
	switch (typeName) {
		case "number":
			return typeof val === "number"
		case "string":
			return typeof val === "string"
		case "boolean":
			return typeof val === "boolean"
		case "date":
			return isFeelDate(val)
		case "time":
			return isFeelTime(val)
		case "date and time":
			return isFeelDateTime(val)
		case "days and time duration":
			return isFeelDayTimeDuration(val)
		case "years and months duration":
			return isFeelYearsMonthsDuration(val)
		case "list":
			return Array.isArray(val)
		case "context":
			return isFeelContext(val)
		case "function":
			return typeof val === "object" && val !== null && "call" in val
		case "Any":
			return true
		case "null":
			return val === null
		default:
			return false
	}
}

/** Evaluate a unary test against an input value. Returns boolean. */
export function evaluateUnaryTest(node: FeelNode, input: FeelValue, ctx: EvalContext): boolean {
	const withInput: EvalContext = { ...ctx, input }
	const result = evaluate(node, withInput)
	if (typeof result === "boolean") return result
	// Range result in unary-test context → membership test
	if (isFeelRange(result)) return testIncludes(result, input) === true
	// List result → any element matches
	if (isFeelList(result)) return result.some((r) => testIncludes(r, input) === true)
	// A plain expression in unary test mode is an equality test
	if (result !== null && result !== undefined) return deepEqual(result, input)
	return false
}

/** Evaluate a full unary-test node (the root returned by parseUnaryTests). */
export function evaluateUnaryTests(node: FeelNode, input: FeelValue, ctx: EvalContext): boolean {
	return evaluateUnaryTest(node, input, ctx)
}
