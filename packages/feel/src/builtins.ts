import type {
	FeelContext,
	FeelDate,
	FeelDateTime,
	FeelDayTimeDuration,
	FeelFunction,
	FeelTime,
	FeelValue,
	FeelYearsMonthsDuration,
} from "./types.js"
import {
	isFeelContext,
	isFeelDate,
	isFeelDateTime,
	isFeelDayTimeDuration,
	isFeelList,
	isFeelRange,
	isFeelTime,
	isFeelYearsMonthsDuration,
} from "./types.js"

// -------------------------------------------------------------------------
// Temporal helpers
// -------------------------------------------------------------------------

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function isLeapYear(y: number): boolean {
	return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function daysInMonth(y: number, m: number): number {
	if (m === 2 && isLeapYear(y)) return 29
	return DAYS_IN_MONTH[m] ?? 30
}

function dateToEpochDays(d: FeelDate): number {
	// Days since 1970-01-01 (Gregorian proleptic)
	const y = d.year - 1
	let days = 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400)
	for (let m = 1; m < d.month; m++) {
		days += daysInMonth(d.year, m)
	}
	days += d.day
	// Subtract epoch offset (1970-01-01 = day 719163 in this counting)
	return days - 719163
}

function epochDaysToDate(days: number): FeelDate {
	// Naive implementation: add days to 1970-01-01
	let remaining = days + 719162 // days since year 0
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
	while (month <= 12 && remaining >= daysInMonth(year, month)) {
		remaining -= daysInMonth(year, month)
		month++
	}
	return { type: "date", year, month, day: remaining + 1 }
}

function parseDate(s: string): FeelDate | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
	if (!m) return null
	return { type: "date", year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

function parseTime(s: string): FeelTime | null {
	const m = /^(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)(?:([+-])(\d{2}):(\d{2})|Z)?(@(.+))?$/.exec(s)
	if (!m) return null
	const hour = Number(m[1])
	const minute = Number(m[2])
	const second = Number(m[3])
	let offsetSeconds: number | undefined
	let timezone: string | undefined
	if (m[4]) {
		const sign = m[4] === "+" ? 1 : -1
		offsetSeconds = sign * (Number(m[5]) * 3600 + Number(m[6]) * 60)
	} else if (m[3] && s.includes("Z")) {
		offsetSeconds = 0
	}
	if (m[8]) timezone = m[8]
	return { type: "time", hour, minute, second, offsetSeconds, timezone }
}

function parseDateTime(s: string): FeelDateTime | null {
	const idx = s.indexOf("T")
	if (idx < 0) return null
	const d = parseDate(s.slice(0, idx))
	const t = parseTime(s.slice(idx + 1))
	if (!d || !t) return null
	return { type: "date-time", date: d, time: t }
}

function parseDuration(s: string): FeelDayTimeDuration | FeelYearsMonthsDuration | null {
	// P[n]Y[n]M or P[n]DT[n]H[n]M[n]S
	const ymMatch = /^-?P(\d+Y)?(\d+M)?$/.exec(s)
	if (ymMatch) {
		const sign = s.startsWith("-") ? -1 : 1
		const years = ymMatch[1] ? Number(ymMatch[1].slice(0, -1)) : 0
		const months = ymMatch[2] ? Number(ymMatch[2].slice(0, -1)) : 0
		return { type: "years-months-duration", months: sign * (years * 12 + months) }
	}
	const dtMatch = /^-?P(\d+D)?(?:T(\d+H)?(\d+M)?(\d+(?:\.\d+)?S)?)?$/.exec(s)
	if (dtMatch && s.length > 1) {
		const sign = s.startsWith("-") ? -1 : 1
		const days = dtMatch[1] ? Number(dtMatch[1].slice(0, -1)) : 0
		const hours = dtMatch[2] ? Number(dtMatch[2].slice(0, -1)) : 0
		const minutes = dtMatch[3] ? Number(dtMatch[3].slice(0, -1)) : 0
		const seconds = dtMatch[4] ? Number(dtMatch[4].slice(0, -1)) : 0
		return {
			type: "days-time-duration",
			seconds: sign * (days * 86400 + hours * 3600 + minutes * 60 + seconds),
		}
	}
	return null
}

function parseTemporal(raw: string): FeelValue {
	// raw = @"..."
	const inner = raw.slice(2, -1)
	const d = parseDate(inner)
	if (d) return d
	const dt = parseDateTime(inner)
	if (dt) return dt
	const t = parseTime(inner)
	if (t) return t
	const dur = parseDuration(inner)
	if (dur) return dur
	return null
}

function formatDate(d: FeelDate): string {
	return `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`
}

function formatTime(t: FeelTime): string {
	let s = `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}:${String(t.second).padStart(2, "0")}`
	if (t.offsetSeconds !== undefined) {
		if (t.offsetSeconds === 0) {
			s += "Z"
		} else {
			const sign = t.offsetSeconds >= 0 ? "+" : "-"
			const abs = Math.abs(t.offsetSeconds)
			s += `${sign}${String(Math.floor(abs / 3600)).padStart(2, "0")}:${String(Math.floor((abs % 3600) / 60)).padStart(2, "0")}`
		}
	}
	if (t.timezone) s += `@${t.timezone}`
	return s
}

function dayOfWeek(d: FeelDate): number {
	// 0=Sunday, 1=Monday, ... 6=Saturday  →  FEEL: 1=Monday ... 7=Sunday
	const epochDays = dateToEpochDays(d)
	return ((epochDays % 7) + 7 + 4) % 7 // 1970-01-01 was Thursday (4)
}

function dayOfYear(d: FeelDate): number {
	let n = d.day
	for (let m = 1; m < d.month; m++) n += daysInMonth(d.year, m)
	return n
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function toNum(v: FeelValue): number | null {
	if (typeof v === "number") return v
	if (typeof v === "string") {
		const n = Number(v)
		return Number.isNaN(n) ? null : n
	}
	return null
}

function toStr(v: FeelValue): string | null {
	if (typeof v === "string") return v
	return null
}

function flattenToList(args: FeelValue[]): FeelValue[] {
	const first = args[0]
	if (args.length === 1 && first !== undefined && isFeelList(first)) return first
	return args
}

// Safe array element access (noUncheckedIndexedAccess compatibility)
function at(arr: FeelValue[], i: number): FeelValue {
	return arr[i] ?? null
}

// Unwrap single-list argument or return the flat array
function unwrapList(flat: FeelValue[]): FeelValue[] {
	const first = flat[0]
	return flat.length === 1 && first !== undefined && isFeelList(first) ? first : flat
}

function inRange(v: FeelValue, r: import("./types.js").FeelRange): boolean {
	const cmpStart = compareValues(v, r.start)
	const cmpEnd = compareValues(v, r.end)
	if (cmpStart === null || cmpEnd === null) return false
	const startOk = r.startIncluded ? cmpStart >= 0 : cmpStart > 0
	const endOk = r.endIncluded ? cmpEnd <= 0 : cmpEnd < 0
	return startOk && endOk
}

function compareValues(a: FeelValue, b: FeelValue): number | null {
	if (typeof a === "number" && typeof b === "number") return a - b
	if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0
	if (isFeelDate(a) && isFeelDate(b)) return dateToEpochDays(a) - dateToEpochDays(b)
	if (isFeelDayTimeDuration(a) && isFeelDayTimeDuration(b)) return a.seconds - b.seconds
	if (isFeelYearsMonthsDuration(a) && isFeelYearsMonthsDuration(b)) return a.months - b.months
	return null
}

// -------------------------------------------------------------------------
// Built-in registry
// -------------------------------------------------------------------------

type BuiltinFn = (...args: FeelValue[]) => FeelValue

const builtinMap = new Map<string, BuiltinFn>()

function reg(name: string, fn: BuiltinFn): void {
	builtinMap.set(name, fn)
}

// -------------------------------------------------------------------------
// String functions
// -------------------------------------------------------------------------

reg("string", (v) => {
	if (v === null) return "null"
	if (typeof v === "string") return v
	if (typeof v === "number") return String(v)
	if (typeof v === "boolean") return String(v)
	if (isFeelDate(v)) return formatDate(v)
	if (isFeelTime(v)) return formatTime(v)
	if (isFeelDateTime(v)) return `${formatDate(v.date)}T${formatTime(v.time)}`
	if (isFeelDayTimeDuration(v)) {
		const s = Math.abs(v.seconds)
		const d = Math.floor(s / 86400)
		const h = Math.floor((s % 86400) / 3600)
		const m = Math.floor((s % 3600) / 60)
		const sec = s % 60
		let r = v.seconds < 0 ? "-P" : "P"
		if (d) r += `${d}D`
		if (h || m || sec) r += `T${h ? `${h}H` : ""}${m ? `${m}M` : ""}${sec ? `${sec}S` : ""}`
		if (r === "P" || r === "-P") r += "T0S"
		return r
	}
	if (isFeelYearsMonthsDuration(v)) {
		const mo = Math.abs(v.months)
		const y = Math.floor(mo / 12)
		const m = mo % 12
		let r = v.months < 0 ? "-P" : "P"
		if (y) r += `${y}Y`
		if (m) r += `${m}M`
		if (r === "P" || r === "-P") r += "0M"
		return r
	}
	return null
})

reg("string length", (s) => {
	const str = toStr(s)
	return str === null ? null : str.length
})

reg("substring", (str, start, length) => {
	const s = toStr(str)
	if (s === null) return null
	const st = toNum(start)
	if (st === null) return null
	// FEEL substring is 1-based, negative counts from end
	const idx = st > 0 ? st - 1 : Math.max(0, s.length + st)
	if (length !== undefined && length !== null) {
		const len = toNum(length)
		if (len === null) return null
		return s.slice(idx, idx + len)
	}
	return s.slice(idx)
})

reg("substring before", (str, match) => {
	const s = toStr(str)
	const m = toStr(match)
	if (s === null || m === null) return null
	const idx = s.indexOf(m)
	return idx < 0 ? "" : s.slice(0, idx)
})

reg("substring after", (str, match) => {
	const s = toStr(str)
	const m = toStr(match)
	if (s === null || m === null) return null
	const idx = s.indexOf(m)
	return idx < 0 ? "" : s.slice(idx + m.length)
})

reg("upper case", (s) => {
	const str = toStr(s)
	return str === null ? null : str.toUpperCase()
})

reg("lower case", (s) => {
	const str = toStr(s)
	return str === null ? null : str.toLowerCase()
})

reg("contains", (str, match) => {
	const s = toStr(str)
	const m = toStr(match)
	if (s === null || m === null) return null
	return s.includes(m)
})

reg("starts with", (str, match) => {
	const s = toStr(str)
	const m = toStr(match)
	if (s === null || m === null) return null
	return s.startsWith(m)
})

reg("ends with", (str, match) => {
	const s = toStr(str)
	const m = toStr(match)
	if (s === null || m === null) return null
	return s.endsWith(m)
})

reg("matches", (str, pattern, flags) => {
	const s = toStr(str)
	const p = toStr(pattern)
	if (s === null || p === null) return null
	const f = flags !== undefined && flags !== null ? (toStr(flags) ?? "") : ""
	try {
		return new RegExp(p, f).test(s)
	} catch {
		return null
	}
})

reg("replace", (str, pattern, replacement, flags) => {
	const s = toStr(str)
	const p = toStr(pattern)
	const r = toStr(replacement)
	if (s === null || p === null || r === null) return null
	const f = flags !== undefined && flags !== null ? (toStr(flags) ?? "g") : "g"
	try {
		return s.replace(new RegExp(p, f.includes("g") ? f : `${f}g`), r)
	} catch {
		return null
	}
})

reg("split", (str, delimiter) => {
	const s = toStr(str)
	const d = toStr(delimiter)
	if (s === null || d === null) return null
	try {
		return s.split(new RegExp(d))
	} catch {
		return s.split(d)
	}
})

reg("string join", (...args) => {
	const flat = flattenToList(args)
	// string join(list) or string join(list, delimiter) or string join(list, delimiter, prefix, suffix)
	let list: FeelValue[]
	let delimiter = ""
	const first = flat[0]
	if (flat.length >= 1 && first !== undefined && isFeelList(first)) {
		list = first
		delimiter = flat.length >= 2 ? (toStr(at(flat, 1)) ?? "") : ""
	} else {
		list = flat
	}
	const parts: string[] = []
	for (const v of list) {
		const s = toStr(v)
		if (s !== null) parts.push(s)
	}
	return parts.join(delimiter)
})

// -------------------------------------------------------------------------
// Number functions
// -------------------------------------------------------------------------

reg("number", (v) => {
	if (typeof v === "number") return v
	if (typeof v === "string") {
		const n = Number(v)
		return Number.isNaN(n) ? null : n
	}
	return null
})

reg("decimal", (n, scale) => {
	const num = toNum(n)
	const sc = toNum(scale)
	if (num === null || sc === null) return null
	const factor = 10 ** sc
	return Math.round(num * factor) / factor
})

reg("floor", (n, scale) => {
	const num = toNum(n)
	if (num === null) return null
	if (scale !== undefined && scale !== null) {
		const sc = toNum(scale) ?? 0
		const factor = 10 ** sc
		return Math.floor(num * factor) / factor
	}
	return Math.floor(num)
})

reg("ceiling", (n, scale) => {
	const num = toNum(n)
	if (num === null) return null
	if (scale !== undefined && scale !== null) {
		const sc = toNum(scale) ?? 0
		const factor = 10 ** sc
		return Math.ceil(num * factor) / factor
	}
	return Math.ceil(num)
})

reg("round half up", (n, scale) => {
	const num = toNum(n)
	const sc = toNum(scale) ?? 0
	if (num === null) return null
	const factor = 10 ** sc
	return Math.round(num * factor) / factor
})

reg("round half down", (n, scale) => {
	const num = toNum(n)
	const sc = toNum(scale) ?? 0
	if (num === null) return null
	const factor = 10 ** sc
	const scaled = num * factor
	return (scaled > 0 ? Math.ceil(scaled - 0.5) : Math.floor(scaled + 0.5)) / factor
})

reg("round up", (n, scale) => {
	const num = toNum(n)
	const sc = toNum(scale) ?? 0
	if (num === null) return null
	const factor = 10 ** sc
	const scaled = num * factor
	return (scaled > 0 ? Math.ceil(scaled) : Math.floor(scaled)) / factor
})

reg("round down", (n, scale) => {
	const num = toNum(n)
	const sc = toNum(scale) ?? 0
	if (num === null) return null
	const factor = 10 ** sc
	return Math.trunc(num * factor) / factor
})

reg("abs", (n) => {
	if (typeof n === "number") return Math.abs(n)
	if (isFeelDayTimeDuration(n)) return { type: "days-time-duration", seconds: Math.abs(n.seconds) }
	if (isFeelYearsMonthsDuration(n))
		return { type: "years-months-duration", months: Math.abs(n.months) }
	return null
})

reg("modulo", (n, d) => {
	const num = toNum(n)
	const div = toNum(d)
	if (num === null || div === null || div === 0) return null
	return ((num % div) + div) % div
})

reg("sqrt", (n) => {
	const num = toNum(n)
	return num === null || num < 0 ? null : Math.sqrt(num)
})

reg("log", (n) => {
	const num = toNum(n)
	return num === null || num <= 0 ? null : Math.log(num)
})

reg("exp", (n) => {
	const num = toNum(n)
	return num === null ? null : Math.exp(num)
})

reg("odd", (n) => {
	const num = toNum(n)
	return num === null ? null : Math.abs(num) % 2 === 1
})

reg("even", (n) => {
	const num = toNum(n)
	return num === null ? null : num % 2 === 0
})

reg("random number", () => Math.random())

// -------------------------------------------------------------------------
// List functions
// -------------------------------------------------------------------------

reg("count", (...args) => {
	const list = flattenToList(args)
	const first = list[0]
	if (list.length === 1 && first !== undefined && isFeelList(first)) return first.length
	return list.length
})

reg("list contains", (list, item) => {
	if (!isFeelList(list)) return null
	return list.some((v) => v === item)
})

reg("min", (...args) => {
	const list = flattenToList(args)
	const listFirst = list[0]
	const flat =
		listFirst !== undefined && isFeelList(listFirst) && list.length === 1 ? listFirst : list
	if (flat.length === 0) return null
	let m: FeelValue = flat[0] ?? null
	for (let i = 1; i < flat.length; i++) {
		const v: FeelValue = flat[i] ?? null
		const cmp = compareValues(v, m)
		if (cmp !== null && cmp < 0) m = v
	}
	return m
})

reg("max", (...args) => {
	const list = flattenToList(args)
	const listFirst = list[0]
	const flat =
		listFirst !== undefined && isFeelList(listFirst) && list.length === 1 ? listFirst : list
	if (flat.length === 0) return null
	let m: FeelValue = flat[0] ?? null
	for (let i = 1; i < flat.length; i++) {
		const v: FeelValue = flat[i] ?? null
		const cmp = compareValues(v, m)
		if (cmp !== null && cmp > 0) m = v
	}
	return m
})

reg("sum", (...args) => {
	const list = unwrapList(flattenToList(args))
	let s = 0
	for (const v of list) {
		const n = toNum(v)
		if (n === null) return null
		s += n
	}
	return s
})

reg("product", (...args) => {
	const list = unwrapList(flattenToList(args))
	let p = 1
	for (const v of list) {
		const n = toNum(v)
		if (n === null) return null
		p *= n
	}
	return p
})

reg("mean", (...args) => {
	const list = unwrapList(flattenToList(args))
	if (list.length === 0) return null
	let s = 0
	for (const v of list) {
		const n = toNum(v)
		if (n === null) return null
		s += n
	}
	return s / list.length
})

reg("median", (...args) => {
	const list = unwrapList(flattenToList(args))
	const nums: number[] = []
	for (const v of list) {
		const n = toNum(v)
		if (n === null) return null
		nums.push(n)
	}
	if (nums.length === 0) return null
	nums.sort((a, b) => a - b)
	const mid = Math.floor(nums.length / 2)
	return nums.length % 2 === 0 ? ((nums[mid - 1] ?? 0) + (nums[mid] ?? 0)) / 2 : (nums[mid] ?? 0)
})

reg("stddev", (...args) => {
	const list = unwrapList(flattenToList(args))
	const nums: number[] = []
	for (const v of list) {
		const n = toNum(v)
		if (n === null) return null
		nums.push(n)
	}
	if (nums.length <= 1) return null
	const mean = nums.reduce((a, b) => a + b, 0) / nums.length
	const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (nums.length - 1)
	return Math.sqrt(variance)
})

reg("mode", (...args) => {
	const list = unwrapList(flattenToList(args))
	const counts = new Map<FeelValue, number>()
	for (const v of list) {
		counts.set(v, (counts.get(v) ?? 0) + 1)
	}
	let maxCount = 0
	for (const cnt of counts.values()) {
		if (cnt > maxCount) maxCount = cnt
	}
	const modes: FeelValue[] = []
	for (const [v, cnt] of counts) {
		if (cnt === maxCount) modes.push(v)
	}
	return modes
})

reg("all", (...args) => {
	const list = unwrapList(flattenToList(args))
	let hasNull = false
	for (const v of list) {
		if (v === false) return false
		if (v === null) hasNull = true
	}
	return hasNull ? null : true
})

reg("any", (...args) => {
	const list = unwrapList(flattenToList(args))
	let hasNull = false
	for (const v of list) {
		if (v === true) return true
		if (v === null) hasNull = true
	}
	return hasNull ? null : false
})

reg("sublist", (list, start, length) => {
	if (!isFeelList(list)) return null
	const st = toNum(start)
	if (st === null) return null
	const sliceIdx = st > 0 ? st - 1 : Math.max(0, list.length + st)
	if (length !== undefined && length !== null) {
		const len = toNum(length)
		if (len === null) return null
		return list.slice(sliceIdx, sliceIdx + len)
	}
	return list.slice(sliceIdx)
})

reg("append", (...args) => {
	if (args.length < 1) return null
	const list = at(args, 0)
	if (!isFeelList(list)) return null
	return [...list, ...args.slice(1)]
})

reg("concatenate", (...args) => {
	const flat = flattenToList(args)
	const result: FeelValue[] = []
	for (const v of flat) {
		if (isFeelList(v)) result.push(...v)
		else result.push(v)
	}
	return result
})

reg("insert before", (list, pos, newItem) => {
	if (!isFeelList(list)) return null
	const p = toNum(pos)
	if (p === null) return null
	const idx = p > 0 ? p - 1 : list.length + p
	const result = [...list]
	result.splice(idx, 0, newItem ?? null)
	return result
})

reg("remove", (list, pos) => {
	if (!isFeelList(list)) return null
	const p = toNum(pos)
	if (p === null) return null
	const idx = p > 0 ? p - 1 : list.length + p
	const result = [...list]
	result.splice(idx, 1)
	return result
})

reg("reverse", (list) => {
	if (!isFeelList(list)) return null
	return [...list].reverse()
})

reg("index of", (list, match) => {
	if (!isFeelList(list)) return null
	const result: FeelValue[] = []
	for (let i = 0; i < list.length; i++) {
		if (list[i] === match) result.push(i + 1)
	}
	return result
})

reg("union", (...args) => {
	const result: FeelValue[] = []
	for (const v of args) {
		if (isFeelList(v)) {
			for (const item of v) {
				if (!result.includes(item)) result.push(item)
			}
		} else if (!result.includes(v)) {
			result.push(v)
		}
	}
	return result
})

reg("distinct values", (list) => {
	if (!isFeelList(list)) return null
	const result: FeelValue[] = []
	for (const v of list) {
		if (!result.includes(v)) result.push(v)
	}
	return result
})

reg("flatten", (list) => {
	if (!isFeelList(list)) return null
	const flat = (arr: FeelValue[]): FeelValue[] => {
		const result: FeelValue[] = []
		for (const v of arr) {
			if (isFeelList(v)) result.push(...flat(v))
			else result.push(v)
		}
		return result
	}
	return flat(list)
})

reg("sort", (list, fn) => {
	if (!isFeelList(list)) return null
	const sorted = [...list]
	if (fn !== undefined && fn !== null && typeof fn === "object" && "call" in fn) {
		const f = fn as FeelFunction
		sorted.sort((a, b) => {
			const r = f.call([a, b])
			return r === true ? -1 : r === false ? 1 : 0
		})
	} else {
		sorted.sort((a, b) => compareValues(a, b) ?? 0)
	}
	return sorted
})

// -------------------------------------------------------------------------
// Boolean functions
// -------------------------------------------------------------------------

reg("not", (v) => {
	if (typeof v === "boolean") return !v
	return null
})

reg("is defined", (v) => v !== null && v !== undefined)

reg("get or else", (v, defaultVal) => {
	return v !== null && v !== undefined ? v : (defaultVal ?? null)
})

// -------------------------------------------------------------------------
// Context functions
// -------------------------------------------------------------------------

reg("get value", (ctx, key) => {
	if (!isFeelContext(ctx)) return null
	const k = toStr(key)
	if (k === null) return null
	const val = ctx[k]
	return val !== undefined ? val : null
})

reg("get entries", (ctx) => {
	if (!isFeelContext(ctx)) return null
	return Object.entries(ctx).map(([k, v]) => ({ key: k, value: v }) as FeelValue)
})

reg("context put", (ctx, key, value) => {
	if (!isFeelContext(ctx)) return null
	const k = toStr(key)
	if (k === null) return null
	const result: FeelContext = {}
	for (const [ck, cv] of Object.entries(ctx)) result[ck] = cv
	result[k] = value ?? null
	return result
})

reg("context merge", (...args) => {
	const result: FeelContext = {}
	for (const v of args) {
		if (!isFeelContext(v)) return null
		for (const [k, cv] of Object.entries(v)) result[k] = cv
	}
	return result
})

reg("context", (list) => {
	if (!isFeelList(list)) return null
	const result: FeelContext = {}
	for (const item of list) {
		if (!isFeelContext(item)) return null
		const k = item.key
		const v = item.value
		if (typeof k === "string") result[k] = v !== undefined ? v : null
	}
	return result
})

// -------------------------------------------------------------------------
// Conversion functions
// -------------------------------------------------------------------------

reg("date", (...args) => {
	if (args.length === 1) {
		const v = at(args, 0)
		if (typeof v === "string") return parseDate(v)
		if (isFeelDateTime(v)) return v.date
		return null
	}
	if (args.length === 3) {
		const y = toNum(at(args, 0))
		const m = toNum(at(args, 1))
		const d = toNum(at(args, 2))
		if (y === null || m === null || d === null) return null
		return { type: "date", year: y, month: m, day: d }
	}
	return null
})

reg("time", (...args) => {
	if (args.length === 1) {
		const v = at(args, 0)
		if (typeof v === "string") return parseTime(v)
		if (isFeelDateTime(v)) return v.time
		return null
	}
	if (args.length >= 3) {
		const h = toNum(at(args, 0))
		const m = toNum(at(args, 1))
		const s = toNum(at(args, 2))
		if (h === null || m === null || s === null) return null
		const t: FeelTime = { type: "time", hour: h, minute: m, second: s }
		const off = at(args, 3)
		if (off !== null && isFeelDayTimeDuration(off)) t.offsetSeconds = off.seconds
		return t
	}
	return null
})

reg("date and time", (...args) => {
	if (args.length === 1) {
		const v = at(args, 0)
		if (typeof v === "string") return parseDateTime(v)
		return null
	}
	if (args.length === 2) {
		const d = at(args, 0)
		const t = at(args, 1)
		if (isFeelDate(d) && isFeelTime(t)) return { type: "date-time", date: d, time: t }
		if (isFeelDateTime(d) && isFeelTime(t)) return { type: "date-time", date: d.date, time: t }
		return null
	}
	return null
})

reg("duration", (s) => {
	if (typeof s !== "string") return null
	return parseDuration(s)
})

reg("years and months duration", (from, to) => {
	let d1: FeelDate | null = null
	let d2: FeelDate | null = null
	if (isFeelDate(from)) d1 = from
	else if (isFeelDateTime(from)) d1 = from.date
	if (isFeelDate(to)) d2 = to
	else if (isFeelDateTime(to)) d2 = to.date
	if (!d1 || !d2) return null
	const months = (d2.year - d1.year) * 12 + (d2.month - d1.month)
	return { type: "years-months-duration", months }
})

// -------------------------------------------------------------------------
// Temporal utility functions
// -------------------------------------------------------------------------

reg("now", () => {
	const d = new Date()
	return {
		type: "date-time",
		date: { type: "date", year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() },
		time: {
			type: "time",
			hour: d.getHours(),
			minute: d.getMinutes(),
			second: d.getSeconds(),
			offsetSeconds: -d.getTimezoneOffset() * 60,
		},
	} satisfies FeelDateTime
})

reg("today", () => {
	const d = new Date()
	return {
		type: "date",
		year: d.getFullYear(),
		month: d.getMonth() + 1,
		day: d.getDate(),
	} satisfies FeelDate
})

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

reg("day of week", (d) => {
	let date: FeelDate | null = null
	if (isFeelDate(d)) date = d
	else if (isFeelDateTime(d)) date = d.date
	if (!date) return null
	const dow = dayOfWeek(date)
	return DAY_NAMES[dow] ?? null
})

reg("day of year", (d) => {
	let date: FeelDate | null = null
	if (isFeelDate(d)) date = d
	else if (isFeelDateTime(d)) date = d.date
	if (!date) return null
	return dayOfYear(date)
})

reg("week of year", (d) => {
	let date: FeelDate | null = null
	if (isFeelDate(d)) date = d
	else if (isFeelDateTime(d)) date = d.date
	if (!date) return null
	// ISO week number
	const epochDays = dateToEpochDays(date)
	// 1970-01-01 was Thursday (dow=4), ISO week 1
	const jan4 = dateToEpochDays({ type: "date", year: date.year, month: 1, day: 4 })
	const jan4dow = ((jan4 % 7) + 7 + 4) % 7 // Monday=0
	const weekStart = jan4 - ((jan4dow + 6) % 7)
	const week = Math.floor((epochDays - weekStart) / 7) + 1
	if (week < 1) return 52 // last week of previous year (simplified)
	return week
})

reg("month of year", (d) => {
	const MONTH_NAMES = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	]
	let date: FeelDate | null = null
	if (isFeelDate(d)) date = d
	else if (isFeelDateTime(d)) date = d.date
	if (!date) return null
	return MONTH_NAMES[date.month - 1] ?? null
})

reg("last day of month", (d) => {
	let date: FeelDate | null = null
	if (isFeelDate(d)) date = d
	else if (isFeelDateTime(d)) date = d.date
	if (!date) return null
	return daysInMonth(date.year, date.month)
})

// -------------------------------------------------------------------------
// Range / interval functions
// -------------------------------------------------------------------------

function toRangeOrScalar(
	v: FeelValue,
): { start: FeelValue; startIncluded: boolean; end: FeelValue; endIncluded: boolean } | FeelValue {
	if (isFeelRange(v)) return v
	return v
}

type Pt = { v: FeelValue; included: boolean }

function startOf(v: FeelValue): Pt {
	if (isFeelRange(v)) return { v: v.start, included: v.startIncluded }
	return { v, included: true }
}

function endOf(v: FeelValue): Pt {
	if (isFeelRange(v)) return { v: v.end, included: v.endIncluded }
	return { v, included: true }
}

function cmpPts(a: Pt, b: Pt, edge: "start" | "end"): number {
	const c = compareValues(a.v, b.v) ?? 0
	if (c !== 0) return c
	if (edge === "start") return a.included === b.included ? 0 : a.included ? -1 : 1
	return a.included === b.included ? 0 : a.included ? 1 : -1
}

reg("before", (a, b) => {
	const ae = endOf(a)
	const bs = startOf(b)
	const c = compareValues(ae.v, bs.v) ?? 0
	if (c < 0) return true
	if (c === 0) return !ae.included || !bs.included
	return false
})

reg("after", (a, b) => {
	const as_ = startOf(a)
	const be = endOf(b)
	const c = compareValues(as_.v, be.v) ?? 0
	if (c > 0) return true
	if (c === 0) return !as_.included || !be.included
	return false
})

reg("meets", (a, b) => {
	if (!isFeelRange(a) || !isFeelRange(b)) return null
	const c = compareValues(a.end, b.start) ?? 1
	return c === 0 && a.endIncluded && b.startIncluded
})

reg("met by", (a, b) => {
	if (!isFeelRange(a) || !isFeelRange(b)) return null
	const c = compareValues(a.start, b.end) ?? 1
	return c === 0 && a.startIncluded && b.endIncluded
})

reg("overlaps", (a, b) => {
	if (!isFeelRange(a) || !isFeelRange(b)) return null
	const ae = endOf(a)
	const bs = startOf(b)
	const as_ = startOf(a)
	const be = endOf(b)
	const c1 = compareValues(ae.v, bs.v) ?? -1
	const c2 = compareValues(as_.v, be.v) ?? 1
	if (c1 < 0 || c2 > 0) return false
	if (c1 === 0 && (!ae.included || !bs.included)) return false
	if (c2 === 0 && (!as_.included || !be.included)) return false
	return true
})

reg("overlaps before", (a, b) => {
	if (!isFeelRange(a) || !isFeelRange(b)) return null
	const as_ = startOf(a)
	const bs = startOf(b)
	const ae = endOf(a)
	const be = endOf(b)
	return cmpPts(as_, bs, "start") < 0 && cmpPts(ae, be, "end") < 0 && cmpPts(ae, bs, "end") >= 0
})

reg("overlaps after", (a, b) => {
	if (!isFeelRange(a) || !isFeelRange(b)) return null
	const as_ = startOf(a)
	const bs = startOf(b)
	const ae = endOf(a)
	const be = endOf(b)
	return cmpPts(as_, bs, "start") > 0 && cmpPts(ae, be, "end") > 0 && cmpPts(as_, be, "end") <= 0
})

reg("during", (a, b) => {
	if (!isFeelRange(b)) return null
	const as_ = startOf(a)
	const ae = endOf(a)
	const bs = startOf(b)
	const be = endOf(b)
	return cmpPts(bs, as_, "start") <= 0 && cmpPts(ae, be, "end") <= 0
})

reg("includes", (a, b) => {
	if (!isFeelRange(a)) return null
	const as_ = startOf(a)
	const ae = endOf(a)
	const bs = startOf(b)
	const be = endOf(b)
	return cmpPts(as_, bs, "start") <= 0 && cmpPts(be, ae, "end") <= 0
})

reg("starts", (a, b) => {
	if (!isFeelRange(a) || !isFeelRange(b)) return null
	const as_ = startOf(a)
	const bs = startOf(b)
	const ae = endOf(a)
	const be = endOf(b)
	return cmpPts(as_, bs, "start") === 0 && cmpPts(ae, be, "end") <= 0
})

reg("started by", (a, b) => {
	if (!isFeelRange(a) || !isFeelRange(b)) return null
	const as_ = startOf(a)
	const bs = startOf(b)
	const ae = endOf(a)
	const be = endOf(b)
	return cmpPts(as_, bs, "start") === 0 && cmpPts(be, ae, "end") <= 0
})

reg("finishes", (a, b) => {
	if (!isFeelRange(a) || !isFeelRange(b)) return null
	const ae = endOf(a)
	const be = endOf(b)
	const as_ = startOf(a)
	const bs = startOf(b)
	return cmpPts(ae, be, "end") === 0 && cmpPts(bs, as_, "start") <= 0
})

reg("finished by", (a, b) => {
	if (!isFeelRange(a) || !isFeelRange(b)) return null
	const ae = endOf(a)
	const be = endOf(b)
	const as_ = startOf(a)
	const bs = startOf(b)
	return cmpPts(ae, be, "end") === 0 && cmpPts(as_, bs, "start") <= 0
})

reg("coincides", (a, b) => {
	if (isFeelRange(a) && isFeelRange(b)) {
		return cmpPts(startOf(a), startOf(b), "start") === 0 && cmpPts(endOf(a), endOf(b), "end") === 0
	}
	if (!isFeelRange(a) && !isFeelRange(b)) {
		return compareValues(a, b) === 0
	}
	return null
})

// -------------------------------------------------------------------------
// Exports
// -------------------------------------------------------------------------

/** Look up a built-in function by name. Returns undefined if not found. */
export function getBuiltin(name: string): FeelFunction | undefined {
	const fn = builtinMap.get(name)
	if (!fn) return undefined
	return { type: "function", call: (args) => fn(...args) }
}

/** All built-in names. */
export function builtinNames(): string[] {
	return [...builtinMap.keys()]
}

/** Parse a @"..." temporal literal to a FeelValue. */
export { parseTemporal, compareValues }
