import type { FeelNode } from "./ast.js"
import { compareValues, getBuiltin, orderNamedArgs, parseTemporal } from "./builtins.js"
import type { FeelContext, FeelFunction, FeelValue } from "./types.js"
import {
	getProperty,
	isFeelContext,
	isFeelDate,
	isFeelDateTime,
	isFeelDayTimeDuration,
	isFeelFunction,
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

/** Whether `name` is bound in this scope or an enclosing one, even to `null`. */
function isBound(ctx: EvalContext, name: string): boolean {
	if (Object.hasOwn(ctx.vars, name)) return true
	return ctx.parent ? isBound(ctx.parent, name) : false
}

function childCtx(parent: EvalContext, vars: Record<string, FeelValue> = {}): EvalContext {
	return { vars, parent, input: parent.input }
}

/**
 * The scope a filter condition runs in. The element is bound to `item`, and
 * when it is a context its entries are in scope directly, so a list of
 * records filters on their fields: `[{a: 1}, {a: 2}][a >= 2]`. An entry
 * called `item` is the element's own, not the element.
 */
function filterCtx(parent: EvalContext, item: FeelValue): EvalContext {
	const vars: Record<string, FeelValue> = { item }
	if (isFeelContext(item)) Object.assign(vars, item)
	return childCtx(parent, vars)
}

/**
 * Expands the domain of a `for`/`some`/`every` binding into the values to
 * iterate. A numeric or date range yields its whole span, counting down when
 * it runs backwards; anything else iterates as a single-element list. A range
 * over values that cannot be stepped through has no iteration, which is null.
 */
function iterationValues(domain: FeelValue): FeelValue[] | null {
	if (isFeelList(domain)) return domain
	if (!isFeelRange(domain)) return [domain]
	const { start, end } = domain
	if (typeof start === "number" && typeof end === "number") {
		return span(start, end).map((n) => n as FeelValue)
	}
	if (isFeelDate(start) && isFeelDate(end)) {
		return span(dateToEpochDays(start), dateToEpochDays(end)).map((d) => epochDaysToDate(d))
	}
	return null
}

/** Every integer from `from` to `to`, in whichever direction that runs. */
function span(from: number, to: number): number[] {
	const step = from <= to ? 1 : -1
	const values: number[] = []
	for (let v = from; step > 0 ? v <= to : v >= to; v += step) values.push(v)
	return values
}

// -------------------------------------------------------------------------
// Arithmetic helpers for temporal types
// -------------------------------------------------------------------------

/**
 * Shifts a date by whole months. The day is clamped to the length of the
 * month it lands in, so 2020-01-31 plus P1M is 2020-02-29 rather than a
 * February 31st that no calendar has.
 */
function shiftMonths(
	date: import("./types.js").FeelDate,
	months: number,
): import("./types.js").FeelDate {
	const total = date.month + months
	const year = date.year + Math.floor((total - 1) / 12)
	const month = ((((total - 1) % 12) + 12) % 12) + 1
	return { type: "date", year, month, day: Math.min(date.day, DAYS_IN_MONTH_TABLE(year, month)) }
}

function addDuration(date: FeelValue, dur: FeelValue): FeelValue {
	if (isFeelDate(date) && isFeelYearsMonthsDuration(dur)) {
		return shiftMonths(date, dur.months)
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
		return { type: "date-time", date: shiftMonths(date.date, dur.months), time: date.time }
	}
	if (isFeelTime(date) && isFeelDayTimeDuration(dur)) return shiftTime(date, dur.seconds)
	if (isFeelDayTimeDuration(date) && isFeelDayTimeDuration(dur)) {
		return { type: "days-time-duration", seconds: date.seconds + dur.seconds }
	}
	if (isFeelYearsMonthsDuration(date) && isFeelYearsMonthsDuration(dur)) {
		return { type: "years-months-duration", months: date.months + dur.months }
	}
	return null
}

/** A time moved by some seconds, around the clock: 23:00 plus two hours is 01:00. */
function shiftTime(
	t: import("./types.js").FeelTime,
	seconds: number,
): import("./types.js").FeelTime {
	const total = (((t.hour * 3600 + t.minute * 60 + t.second + seconds) % 86400) + 86400) % 86400
	return {
		...t,
		hour: Math.floor(total / 3600),
		minute: Math.floor((total % 3600) / 60),
		second: total % 60,
	}
}

function subtractValues(a: FeelValue, b: FeelValue): FeelValue {
	if (typeof a === "number" && typeof b === "number") return a - b
	if (isFeelTime(a) && isFeelTime(b)) {
		// Null when one is local and the other is not: they have no common clock.
		const diff = compareValues(a, b)
		return diff === null ? null : { type: "days-time-duration", seconds: diff }
	}
	if (isFeelTime(a) && isFeelDayTimeDuration(b)) return shiftTime(a, -b.seconds)
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
			// A variable shadows a built-in of the same name (`count`, `sum`); calls
			// resolve their callee separately, so `count(xs)` still reaches the built-in.
			if (isBound(ctx, node.name)) return lookupVar(ctx, node.name)
			return getBuiltin(node.name) ?? null
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
			// Entries are evaluated in order in a scope that already holds the
			// preceding ones, so `{a: 1, b: a + 1}` resolves `a` in `b`.
			const result: FeelContext = {}
			const entryCtx = childCtx(ctx, result)
			for (const entry of node.entries) {
				// A key given twice names two different values, which is not a
				// context at all.
				if (entry.key in result) return null
				result[entry.key] = evaluate(entry.value, entryCtx)
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
			const value = evaluate(node.base, ctx)
			if (value === null) return []
			// A value that is not a list is filtered as a list holding just it,
			// so `true[1]` is true and `true[0]` is null.
			const base = isFeelList(value) ? value : [value]
			// Numeric index filter
			const first = evaluate(node.condition, filterCtx(ctx, base[0] ?? null))
			if (typeof first === "number") {
				const idx = first > 0 ? first - 1 : base.length + first
				const val = base[Math.floor(idx)]
				return val !== undefined ? val : null
			}
			return base.filter((item) => evaluate(node.condition, filterCtx(ctx, item)) === true)
		}

		case "call":
			return evalCall(node.callee, node.args, ctx)

		case "call-expr": {
			const target = evaluate(node.target, ctx)
			if (!isFeelFunction(target)) return null
			return target.call(node.args.map((a) => evaluate(a, ctx)))
		}

		case "call-named": {
			const argNames = node.args.map((a) => a.name)
			const values = node.args.map((a) => evaluate(a.value, ctx))
			const builtin = getBuiltin(node.callee)
			if (builtin) {
				const order = orderNamedArgs(node.callee, argNames)
				if (order === null) return null
				return builtin.call(order.map((idx) => values[idx] ?? null))
			}
			const fn = lookupVar(ctx, node.callee)
			if (!isFeelFunction(fn)) return null
			return fn.call(orderArgs(fn.paramNames, argNames, values))
		}

		case "if": {
			const cond = evaluate(node.condition, ctx)
			return cond === true ? evaluate(node.then, ctx) : evaluate(node.else, ctx)
		}

		case "for":
			return evalFor(node.bindings, node.body, ctx)

		case "some":
		case "every":
			return evalQuantifier(node.kind, node.bindings, node.satisfies, ctx)

		case "between": {
			const val = evaluate(node.value, ctx)
			const low = evaluate(node.low, ctx)
			const high = evaluate(node.high, ctx)
			const cmpLow = compareValues(val, low)
			const cmpHigh = compareValues(val, high)
			if (cmpLow === null || cmpHigh === null) return null
			return cmpLow >= 0 && cmpHigh <= 0
		}

		case "in-test":
			// The right-hand side is a unary test, evaluated with the left-hand
			// value as its implicit input. Unlike a decision table's test, this
			// one keeps an unknown answer unknown.
			return unaryTestValue(node.test, evaluate(node.value, ctx), ctx)

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
		// Anything that is not a boolean leaves the result unknown.
		return l === true && r === true ? true : null
	}
	if (op === "or") {
		const l = evaluate(leftNode, ctx)
		if (l === true) return true
		const r = evaluate(rightNode, ctx)
		if (r === true) return true
		return l === false && r === false ? false : null
	}

	const left = evaluate(leftNode, ctx)
	const right = evaluate(rightNode, ctx)

	if (op === "=" || op === "!=") {
		// Comparing values of different types says nothing, so it is null
		// rather than false. Comparing against null stays a real answer.
		if (left !== null && right !== null && typeTag(left) !== typeTag(right)) return null
		// Temporal values are equal when they name the same point, however
		// each was written: 12:00-01:00 and 17:00+04:00 are one instant.
		const instant = isTemporal(left) ? compareValues(left, right) : null
		const equal = instant !== null ? instant === 0 : deepEqual(left, right)
		return op === "=" ? equal : !equal
	}

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
		// How many times one duration fits in another: P1Y / P1M is 12.
		if (isFeelDayTimeDuration(left) && isFeelDayTimeDuration(right))
			return right.seconds === 0 ? null : left.seconds / right.seconds
		if (isFeelYearsMonthsDuration(left) && isFeelYearsMonthsDuration(right))
			return right.months === 0 ? null : left.months / right.months
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

/**
 * Orders the arguments of a named invocation of a user-defined function. A
 * function that declares no parameter names, or that is handed a name it does
 * not declare, gets nulls rather than a silently mis-ordered argument list.
 */
function orderArgs(
	paramNames: string[] | undefined,
	argNames: string[],
	values: FeelValue[],
): FeelValue[] {
	if (!paramNames) return []
	return paramNames.map((param) => {
		const idx = argNames.indexOf(param)
		return idx >= 0 ? (values[idx] ?? null) : null
	})
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

type Binding = { name: string; domain: FeelNode }

/**
 * Evaluates a `for`. Each binding's domain is evaluated with the bindings to
 * its left already in scope, so `for x in xs, y in x` works, and the body sees
 * the results produced so far as `partial`.
 */
function evalFor(bindings: Binding[], body: FeelNode, ctx: EvalContext): FeelValue {
	const results: FeelValue[] = []
	let failed = false

	const iterate = (idx: number, scope: EvalContext): void => {
		if (failed) return
		if (idx === bindings.length) {
			results.push(evaluate(body, childCtx(scope, { partial: [...results] })))
			return
		}
		const binding = bindings[idx]
		if (!binding) return
		const domain = iterationValues(evaluate(binding.domain, scope))
		if (domain === null) {
			failed = true
			return
		}
		for (const value of domain) {
			iterate(idx + 1, childCtx(scope, { [binding.name]: value }))
		}
	}

	iterate(0, ctx)
	return failed ? null : results
}

/**
 * Evaluates `some`/`every`. A definite answer wins over an unknown one: one
 * true satisfies `some` whatever else the domain holds, and one false settles
 * `every`. Otherwise an unknown anywhere makes the whole answer unknown.
 */
function evalQuantifier(
	kind: "some" | "every",
	bindings: Binding[],
	satisfies: FeelNode,
	ctx: EvalContext,
): FeelValue {
	let sawTrue = false
	let sawFalse = false
	let sawUnknown = false
	let failed = false

	const visit = (idx: number, scope: EvalContext): void => {
		if (failed) return
		if (idx === bindings.length) {
			const result = asBoolean(evaluate(satisfies, scope))
			if (result === true) sawTrue = true
			else if (result === false) sawFalse = true
			else sawUnknown = true
			return
		}
		const binding = bindings[idx]
		if (!binding) return
		const domain = iterationValues(evaluate(binding.domain, scope))
		if (domain === null) {
			failed = true
			return
		}
		for (const value of domain) {
			visit(idx + 1, childCtx(scope, { [binding.name]: value }))
		}
	}

	visit(0, ctx)
	if (failed) return null
	if (kind === "some") return sawTrue ? true : sawUnknown ? null : false
	return sawFalse ? false : sawUnknown ? null : true
}

function asBoolean(v: FeelValue): boolean | null {
	return typeof v === "boolean" ? v : null
}

/** True for the values that name a point in time or a length of it. */
function isTemporal(v: FeelValue): boolean {
	return (
		isFeelDate(v) ||
		isFeelTime(v) ||
		isFeelDateTime(v) ||
		isFeelDayTimeDuration(v) ||
		isFeelYearsMonthsDuration(v)
	)
}

/** The FEEL type of a value, for deciding whether two values are comparable. */
function typeTag(v: FeelValue): string {
	if (v === null) return "null"
	if (Array.isArray(v)) return "list"
	const t = typeof v
	if (t !== "object") return t
	const tagged = (v as { type?: unknown }).type
	return typeof tagged === "string" ? tagged : "context"
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
	// Two lists are compared, not searched: [1,2,3] is a member of
	// [[1,2,3,4], [1,2,3]] rather than of its elements.
	if (isFeelList(test) && isFeelList(val)) return deepEqual(test, val)
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
	// null is not an instance of anything, Any included: it is the absence of
	// a value rather than a value of some type.
	if (val === null) return typeName === "null" || typeName === "Null"
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
		case "dayTimeDuration":
			return isFeelDayTimeDuration(val)
		case "years and months duration":
		case "yearMonthDuration":
			return isFeelYearsMonthsDuration(val)
		case "list":
			return Array.isArray(val)
		case "context":
			return isFeelContext(val)
		case "function":
			return typeof val === "object" && val !== null && "call" in val
		case "Any":
		case "any":
			return true
		case "null":
		case "Null":
			return false
		default:
			return false
	}
}

/**
 * Evaluates a unary test, keeping an unknown answer unknown. A range whose
 * bound is null, or an input of null, says nothing about membership.
 */
/** Whether an expression reads the unary-test input `?`, explicitly or implicitly. */
function readsInput(node: FeelNode): boolean {
	if (node.kind === "name") return node.name === "?"
	// These already test the input; their boolean is the outcome.
	if (node.kind === "unary-not" || node.kind === "unary-test-list" || node.kind === "any-input") {
		return true
	}
	for (const value of Object.values(node)) {
		if (Array.isArray(value)) {
			if (value.some((item) => isNode(item) && readsInput(item))) return true
		} else if (isNode(value) && readsInput(value)) {
			return true
		}
	}
	return false
}

function isNode(value: unknown): value is FeelNode {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { kind?: unknown }).kind === "string"
	)
}

function unaryTestValue(node: FeelNode, input: FeelValue, ctx: EvalContext): FeelValue {
	const withInput: EvalContext = { ...ctx, input }
	const result = evaluate(node, withInput)
	// A boolean that does not depend on `?` (the literal `true` in a boolean input
	// column) is a value to compare with, not the outcome of the test.
	if (typeof result === "boolean" && typeof input === "boolean" && !readsInput(node)) {
		return result === input
	}
	if (typeof result === "boolean") return result
	// Range result in unary-test context → membership test
	if (isFeelRange(result)) return testIncludes(result, input)
	// List result → any element matches
	if (isFeelList(result)) {
		let unknown = false
		for (const item of result) {
			const match = testIncludes(item, input)
			if (match === true) return true
			if (match === null) unknown = true
		}
		return unknown ? null : false
	}
	// A plain expression in unary test mode is an equality test.
	// When the result is null: only match if the node itself is the null literal
	// (null arithmetic in comparisons also yields null but must not match anything).
	if (result !== null) return deepEqual(result, input)
	return node.kind === "null" ? input === null : false
}

/**
 * Evaluates a unary test against an input value. A decision table's rule
 * either matches or it does not, so an unknown answer is not a match.
 */
export function evaluateUnaryTest(node: FeelNode, input: FeelValue, ctx: EvalContext): boolean {
	return unaryTestValue(node, input, ctx) === true
}

/** Evaluate a full unary-test node (the root returned by parseUnaryTests). */
export function evaluateUnaryTests(node: FeelNode, input: FeelValue, ctx: EvalContext): boolean {
	return evaluateUnaryTest(node, input, ctx)
}
