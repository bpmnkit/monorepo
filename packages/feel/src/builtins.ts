import type {
	FeelContext,
	FeelDate,
	FeelDateTime,
	FeelDayTimeDuration,
	FeelFunction,
	FeelRange,
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

// The widest year XSD's date types allow, which bounds DMN's too.
const MAX_YEAR = 999999999

/** Builds a date, or null when the day does not exist in that month. */
function makeDate(year: number, month: number, day: number): FeelDate | null {
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
	if (Math.abs(year) > MAX_YEAR) return null
	if (month < 1 || month > 12) return null
	if (day < 1 || day > daysInMonth(year, month)) return null
	return { type: "date", year, month, day }
}

function parseDate(s: string): FeelDate | null {
	// Exactly four year digits: "01211" carries a leading zero and
	// "9999999999" is past any calendar, and neither is a date.
	const m = /^(-?)(\d{4})-(\d{2})-(\d{2})$/.exec(s)
	if (!m) return null
	const year = Number(m[2]) * (m[1] === "-" ? -1 : 1)
	return makeDate(year, Number(m[3]), Number(m[4]))
}

// The largest UTC offset XSD allows.
const MAX_OFFSET_SECONDS = 18 * 3600

/** True for a zone name the platform's time zone database knows. */
function isKnownTimezone(name: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: name })
		return true
	} catch {
		return false
	}
}

function parseTime(s: string): FeelTime | null {
	const m =
		/^(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)(?:([+-])(\d{2}):(\d{2})(?::(\d{2}))?|Z)?(?:@(.+)|\[(.+)\])?$/.exec(
			s,
		)
	if (!m) return null
	const hour = Number(m[1])
	const minute = Number(m[2])
	const second = Number(m[3])
	let offsetSeconds: number | undefined
	let timezone: string | undefined
	if (m[4]) {
		const sign = m[4] === "+" ? 1 : -1
		offsetSeconds = sign * (Number(m[5]) * 3600 + Number(m[6]) * 60 + (m[7] ? Number(m[7]) : 0))
		if (Math.abs(offsetSeconds) > MAX_OFFSET_SECONDS) return null
	} else if (s.includes("Z")) {
		offsetSeconds = 0
	}
	if (m[8]) {
		// A zone and an offset name the same thing twice, and may disagree.
		if (offsetSeconds !== undefined) return null
		if (!isKnownTimezone(m[8])) return null
		timezone = m[8]
	} else if (m[9]) {
		// Java's form, +02:00[Europe/Berlin]: the offset is the zone's at that
		// moment, and the zone is what the value keeps.
		if (!isKnownTimezone(m[9])) return null
		offsetSeconds = undefined
		timezone = m[9]
	}
	if (!isValidTime(hour, minute, second)) return null
	return { type: "time", hour, minute, second, offsetSeconds, timezone }
}

/** 24:00:00 is the end-of-day form the ISO calendar allows; 24:00:01 is not. */
function isValidTime(hour: number, minute: number, second: number): boolean {
	if (hour < 0 || hour > 24 || minute < 0 || minute > 59 || second < 0 || second >= 60) return false
	return hour !== 24 || (minute === 0 && second === 0)
}

function parseDateTime(s: string): FeelDateTime | null {
	const idx = s.indexOf("T")
	if (idx < 0) {
		const dateOnly = parseDate(s)
		return dateOnly
			? { type: "date-time", date: dateOnly, time: { type: "time", hour: 0, minute: 0, second: 0 } }
			: null
	}
	const d = parseDate(s.slice(0, idx))
	const t = parseTime(s.slice(idx + 1))
	if (!d || !t) return null
	return { type: "date-time", date: d, time: t }
}

function parseDuration(s: string): FeelDayTimeDuration | FeelYearsMonthsDuration | null {
	// P[n]Y[n]M or P[n]DT[n]H[n]M[n]S
	const ymMatch = /^-?P(\d+Y)?(\d+M)?$/.exec(s)
	if (ymMatch && /\d/.test(s)) {
		const sign = s.startsWith("-") ? -1 : 1
		const years = ymMatch[1] ? Number(ymMatch[1].slice(0, -1)) : 0
		const months = ymMatch[2] ? Number(ymMatch[2].slice(0, -1)) : 0
		// "|| 0" keeps a negative zero out: -P0M is the same duration as P0M.
		return { type: "years-months-duration", months: sign * (years * 12 + months) || 0 }
	}
	const dtMatch = /^-?P(\d+D)?(?:T(\d+H)?(\d+M)?(\d+(?:\.\d*)?S)?)?$/.exec(s)
	if (dtMatch && /\d/.test(s)) {
		const sign = s.startsWith("-") ? -1 : 1
		const days = dtMatch[1] ? Number(dtMatch[1].slice(0, -1)) : 0
		const hours = dtMatch[2] ? Number(dtMatch[2].slice(0, -1)) : 0
		const minutes = dtMatch[3] ? Number(dtMatch[3].slice(0, -1)) : 0
		const seconds = dtMatch[4] ? Number(dtMatch[4].slice(0, -1)) : 0
		return {
			type: "days-time-duration",
			seconds: sign * (days * 86400 + hours * 3600 + minutes * 60 + seconds) || 0,
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

/** Two digits before the decimal point, and the fraction as written. */
function formatSeconds(second: number): string {
	const whole = Math.floor(second)
	const fraction = `${second}`.split(".")[1]
	return String(whole).padStart(2, "0") + (fraction ? `.${fraction}` : "")
}

function formatTime(t: FeelTime): string {
	let s = `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}:${formatSeconds(t.second)}`
	if (t.offsetSeconds !== undefined) {
		if (t.offsetSeconds === 0) {
			s += "Z"
		} else {
			const sign = t.offsetSeconds >= 0 ? "+" : "-"
			const abs = Math.abs(t.offsetSeconds)
			const pad = (n: number) => String(n).padStart(2, "0")
			s += `${sign}${pad(Math.floor(abs / 3600))}:${pad(Math.floor((abs % 3600) / 60))}`
			// Offsets are written to the second only when they have one.
			if (abs % 60 !== 0) s += `:${pad(abs % 60)}`
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

/**
 * A number argument. FEEL does not coerce, so "1.5" is not a number here;
 * number() is the way to convert one.
 */
function toNum(v: FeelValue): number | null {
	return typeof v === "number" && Number.isFinite(v) ? v : null
}

/**
 * A rounding scale: an optional integer. Absent means 0, but an explicitly
 * null or non-numeric scale is an error. Beyond float64's reach the value is
 * already exact at that scale, so it is returned unrounded.
 */
const MIN_SCALE = -6111
const MAX_SCALE = 6176
const SCALE_LIMIT = 300

function toScale(v: FeelValue | undefined): number | null {
	if (v === undefined) return 0
	const n = toNum(v)
	if (n === null) return null
	const scale = Math.trunc(n)
	return scale < MIN_SCALE || scale > MAX_SCALE ? null : scale
}

/** Rounds `n` at `scale` with the given rounding of a value exactly halfway. */
function roundAt(n: number, scale: number, round: (x: number) => number): number {
	if (Math.abs(scale) > SCALE_LIMIT) return n
	const factor = 10 ** scale
	// Re-reading the scaled value through its decimal form keeps a product like
	// 1.005 * 100 from landing just under the halfway point it should sit on.
	const scaled = Number(`${n}e${scale}`)
	return Number(`${round(scaled)}e${-scale}`) || round(scaled) / factor
}

/** Round half to even, the rounding DMN's decimal() uses. */
function roundHalfEven(x: number): number {
	const floor = Math.floor(x)
	const diff = x - floor
	if (diff > 0.5) return floor + 1
	if (diff < 0.5) return floor
	return floor % 2 === 0 ? floor : floor + 1
}

/** Round half away from zero. */
function roundHalfUp(x: number): number {
	return x >= 0 ? Math.floor(x + 0.5) : Math.ceil(x - 0.5)
}

/** Round half toward zero. */
function roundHalfDown(x: number): number {
	return x >= 0 ? Math.ceil(x - 0.5) : Math.floor(x + 0.5)
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

const offsetCache = new Map<string, number>()

/**
 * The UTC offset a zone is on at the given wall-clock day. Resolved through
 * the platform's time zone database, so it follows daylight saving: Melbourne
 * is +11:00 in April and +10:00 in October.
 */
function zoneOffsetSeconds(timezone: string, epochDays: number): number {
	const key = `${timezone}/${epochDays}`
	const cached = offsetCache.get(key)
	if (cached !== undefined) return cached
	let offset = 0
	try {
		const parts = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			timeZoneName: "longOffset",
		}).formatToParts(new Date(epochDays * 86400_000))
		const name = parts.find((part) => part.type === "timeZoneName")?.value ?? ""
		const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name)
		if (m) offset = (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60)
	} catch {
		offset = 0
	}
	if (offsetCache.size > 512) offsetCache.clear()
	offsetCache.set(key, offset)
	return offset
}

/** The offset a time is on, or undefined when it is a local time. */
function offsetOf(t: FeelTime, epochDays: number): number | undefined {
	if (t.offsetSeconds !== undefined) return t.offsetSeconds
	if (t.timezone !== undefined) return zoneOffsetSeconds(t.timezone, epochDays)
	return undefined
}

/**
 * Seconds since midnight, shifted to UTC where the time says which UTC it
 * means. A local time carries no offset, so it is left where it is.
 */
function timeToSeconds(t: FeelTime, epochDays = 0): number {
	return t.hour * 3600 + t.minute * 60 + t.second - (offsetOf(t, epochDays) ?? 0)
}

/** True when both times are local, or both say which UTC they mean. */
function sameTimeKind(a: FeelTime, b: FeelTime, epochA: number, epochB: number): boolean {
	return (offsetOf(a, epochA) === undefined) === (offsetOf(b, epochB) === undefined)
}

function compareValues(a: FeelValue, b: FeelValue): number | null {
	if (typeof a === "number" && typeof b === "number") return a - b
	if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0
	if (isFeelDate(a) && isFeelDate(b)) return dateToEpochDays(a) - dateToEpochDays(b)
	if (isFeelTime(a) && isFeelTime(b)) {
		// A local time and one at a known offset name different things and
		// cannot be ordered against each other.
		if (!sameTimeKind(a, b, 0, 0)) return null
		return timeToSeconds(a) - timeToSeconds(b)
	}
	if (isFeelDateTime(a) && isFeelDateTime(b)) {
		const epochA = dateToEpochDays(a.date)
		const epochB = dateToEpochDays(b.date)
		if (!sameTimeKind(a.time, b.time, epochA, epochB)) return null
		return dateTimeToSeconds(a) - dateTimeToSeconds(b)
	}
	if (isFeelDayTimeDuration(a) && isFeelDayTimeDuration(b)) return a.seconds - b.seconds
	if (isFeelYearsMonthsDuration(a) && isFeelYearsMonthsDuration(b)) return a.months - b.months
	return null
}

function dateTimeToSeconds(dt: FeelDateTime): number {
	const epochDays = dateToEpochDays(dt.date)
	return epochDays * 86400 + timeToSeconds(dt.time, epochDays)
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
	if (v === undefined) return null
	return stringify(v, false)
})

/**
 * Renders a value the way FEEL's string() does. Strings nested inside a list
 * or context are quoted; a string rendered on its own is not.
 */
function stringify(v: FeelValue, nested: boolean): FeelValue {
	if (v === null) return null
	if (typeof v === "string") return nested ? JSON.stringify(v) : v
	if (isFeelList(v)) {
		const parts = v.map((item) => stringify(item, true) ?? "null")
		return `[${parts.join(", ")}]`
	}
	if (isFeelContext(v)) {
		const parts = Object.entries(v).map(([k, value]) => `${k}: ${stringify(value, true) ?? "null"}`)
		return `{${parts.join(", ")}}`
	}
	return scalarToString(v)
}

function scalarToString(v: FeelValue): FeelValue {
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
}

reg("string length", (s) => {
	const str = toStr(s)
	// FEEL counts characters, so an astral character counts once, not twice.
	return str === null ? null : [...str].length
})

reg("substring", (str, start, length) => {
	const s = toStr(str)
	if (s === null) return null
	const st = toNum(start)
	if (st === null) return null
	// FEEL substring is 1-based over characters, and a negative start counts
	// back from the end.
	const chars = [...s]
	const idx = st > 0 ? st - 1 : Math.max(0, chars.length + st)
	if (length !== undefined && length !== null) {
		const len = toNum(length)
		if (len === null) return null
		return chars.slice(idx, idx + len).join("")
	}
	return chars.slice(idx).join("")
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

// Patterns in FEEL come from static expression text, so the same few regexes
// are compiled over and over inside loops and decision tables; keep them.
const REGEX_CACHE_LIMIT = 256
const regexCache = new Map<string, RegExp | null>()

/** Compiled regex for `pattern`/`flags`, or null when the pattern is invalid. */
/**
 * Translates the XPath flags FEEL uses into a JavaScript regex. "i", "s" and
 * "m" map straight across; "x" (ignore whitespace in the pattern) and "q"
 * (treat the pattern as a literal) have no JavaScript equivalent and are
 * applied to the pattern instead. Any other flag makes the call fail.
 */
function toJsRegExp(pattern: string, flags: string): RegExp | null {
	let jsFlags = ""
	for (const flag of flags) {
		if (flag === "i" || flag === "s" || flag === "m" || flag === "g") {
			if (!jsFlags.includes(flag)) jsFlags += flag
			continue
		}
		if (flag !== "x" && flag !== "q") return null
	}
	let source = pattern
	if (flags.includes("q")) {
		source = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	} else if (flags.includes("x")) {
		source = stripPatternWhitespace(pattern)
	}
	try {
		return new RegExp(source, jsFlags)
	} catch {
		return null
	}
}

/** Removes the whitespace an "x"-flagged pattern ignores, keeping character classes intact. */
function stripPatternWhitespace(pattern: string): string {
	let out = ""
	let inClass = false
	for (let i = 0; i < pattern.length; i++) {
		const c = pattern[i] as string
		if (c === "\\" && i + 1 < pattern.length) {
			out += c + pattern[i + 1]
			i++
			continue
		}
		if (c === "[") inClass = true
		else if (c === "]") inClass = false
		if (!inClass && /\s/.test(c)) continue
		out += c
	}
	return out
}

function cachedRegExp(pattern: string, flags: string): RegExp | null {
	const key = `${flags}/${pattern}`
	const hit = regexCache.get(key)
	if (hit !== undefined) return hit
	const re = toJsRegExp(pattern, flags)
	if (regexCache.size >= REGEX_CACHE_LIMIT) regexCache.clear()
	regexCache.set(key, re)
	return re
}

reg("matches", (str, pattern, flags) => {
	const s = toStr(str)
	const p = toStr(pattern)
	if (s === null || p === null) return null
	const f = flags !== undefined && flags !== null ? (toStr(flags) ?? "") : ""
	const re = cachedRegExp(p, f)
	if (re === null) return null
	re.lastIndex = 0
	return re.test(s)
})

reg("replace", (str, pattern, replacement, flags) => {
	const s = toStr(str)
	const p = toStr(pattern)
	const r = toStr(replacement)
	if (s === null || p === null || r === null) return null
	const f = flags !== undefined && flags !== null ? (toStr(flags) ?? "g") : "g"
	const re = cachedRegExp(p, f.includes("g") ? f : `${f}g`)
	if (re === null) return null
	re.lastIndex = 0
	// $0 is XPath's whole match, which JavaScript spells $&.
	return s.replace(re, r.replace(/\$&/g, "$$$$&").replace(/\$0/g, "$$&"))
})

reg("split", (str, delimiter) => {
	const s = toStr(str)
	const d = toStr(delimiter)
	if (s === null || d === null) return null
	const re = cachedRegExp(d, "")
	return re === null ? s.split(d) : s.split(re)
})

reg("string join", (value, delimiter, prefix, suffix) => {
	// A value that is not a list joins as a list of one, so the delimiter
	// never appears. A null, or anything in the list that is not a string,
	// has no joined form.
	if (value === null || value === undefined) return null
	const list = isFeelList(value) ? value : [value]
	const parts: string[] = []
	for (const v of list) {
		// Nulls are skipped; any other non-string is an error.
		if (v === null) continue
		const text = toStr(v)
		if (text === null) return null
		parts.push(text)
	}
	const between = delimiter === undefined || delimiter === null ? "" : toStr(delimiter)
	if (between === null) return null
	const head = prefix === undefined || prefix === null ? "" : toStr(prefix)
	const tail = suffix === undefined || suffix === null ? "" : toStr(suffix)
	if (head === null || tail === null) return null
	return head + parts.join(between) + tail
})

// Camunda extensions (feel-scala) --------------------------------------------

reg("is blank", (str) => {
	const s = toStr(str)
	return s === null ? null : s.trim() === ""
})

reg("trim", (str) => {
	const s = toStr(str)
	return s === null ? null : s.trim()
})

reg("extract", (str, pattern) => {
	const s = toStr(str)
	const p = toStr(pattern)
	if (s === null || p === null) return null
	const re = cachedRegExp(p, "g")
	if (re === null) return null
	return [...s.matchAll(re)].map((m) => m[0])
})

reg("uuid", () => {
	const platform = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
	if (platform?.randomUUID) return platform.randomUUID()
	// A version 4 UUID from Math.random, for a platform without Web Crypto.
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = Math.floor(Math.random() * 16)
		return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
	})
})

reg("to base64", (str) => {
	const s = toStr(str)
	return s === null ? null : encodeBase64(encodeUtf8(s))
})

reg("from base64", (str) => {
	const s = toStr(str)
	if (s === null) return null
	const bytes = decodeBase64(s)
	return bytes === null ? null : decodeUtf8(bytes)
})

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

// Base64 and UTF-8 by hand: the package runs anywhere ES2022 does, without
// relying on Buffer, btoa or TextEncoder being there.

function encodeUtf8(s: string): number[] {
	const bytes: number[] = []
	for (const ch of s) {
		const c = ch.codePointAt(0) ?? 0
		if (c < 0x80) bytes.push(c)
		else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
		else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
		else {
			bytes.push(
				0xf0 | (c >> 18),
				0x80 | ((c >> 12) & 0x3f),
				0x80 | ((c >> 6) & 0x3f),
				0x80 | (c & 0x3f),
			)
		}
	}
	return bytes
}

/** Decodes UTF-8, or null when the bytes are not well-formed UTF-8. */
function decodeUtf8(bytes: number[]): string | null {
	let out = ""
	for (let i = 0; i < bytes.length; ) {
		const b = bytes[i] as number
		const extra = b < 0x80 ? 0 : b >= 0xf0 ? 3 : b >= 0xe0 ? 2 : b >= 0xc0 ? 1 : -1
		if (extra < 0 || b > 0xf4) return null
		let c = extra === 0 ? b : b & (0x3f >> extra)
		for (let k = 1; k <= extra; k++) {
			const next = bytes[i + k]
			if (next === undefined || (next & 0xc0) !== 0x80) return null
			c = (c << 6) | (next & 0x3f)
		}
		const minimum = [0, 0x80, 0x800, 0x10000][extra] as number
		if (c < minimum || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) return null
		out += String.fromCodePoint(c)
		i += extra + 1
	}
	return out
}

function encodeBase64(bytes: number[]): string {
	let out = ""
	for (let i = 0; i < bytes.length; i += 3) {
		const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
		out += BASE64[(n >> 18) & 63]
		out += BASE64[(n >> 12) & 63]
		out += i + 1 < bytes.length ? BASE64[(n >> 6) & 63] : "="
		out += i + 2 < bytes.length ? BASE64[n & 63] : "="
	}
	return out
}

/** Decodes padded Base64, or null when the text is not Base64. */
function decodeBase64(s: string): number[] | null {
	if (s.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return null
	const bytes: number[] = []
	for (let i = 0; i < s.length; i += 4) {
		let n = 0
		for (let k = 0; k < 4; k++) {
			const ch = s[i + k] as string
			n = (n << 6) | (ch === "=" ? 0 : BASE64.indexOf(ch))
		}
		bytes.push((n >> 16) & 255)
		if (s[i + 2] !== "=") bytes.push((n >> 8) & 255)
		if (s[i + 3] !== "=") bytes.push(n & 255)
	}
	return bytes
}

// -------------------------------------------------------------------------
// Number functions
// -------------------------------------------------------------------------

reg("number", (v, groupingSeparator, decimalSeparator) => {
	const hasSeparators = groupingSeparator !== undefined || decimalSeparator !== undefined
	if (typeof v === "number") return hasSeparators ? null : v
	if (typeof v !== "string") return null
	const grouping = separatorArg(groupingSeparator, [" ", ",", "."])
	const decimal = separatorArg(decimalSeparator, [",", "."])
	if (grouping === undefined || decimal === undefined) return null
	if (grouping !== null && grouping === decimal) return null
	let text = v
	if (grouping !== null) text = text.split(grouping).join("")
	if (decimal !== null) text = text.split(decimal).join(".")
	if (text.trim() === "") return null
	const n = Number(text)
	return Number.isNaN(n) ? null : n
})

/** Reads a number() separator argument: null when absent, undefined when invalid. */
function separatorArg(v: FeelValue | undefined, allowed: string[]): string | null | undefined {
	if (v === undefined || v === null) return null
	if (typeof v !== "string" || !allowed.includes(v)) return undefined
	return v
}

reg("decimal", (n, scale) => {
	const num = toNum(n)
	const sc = toScale(scale)
	if (num === null || sc === null || scale === undefined) return null
	return roundAt(num, sc, roundHalfEven)
})

reg("floor", (n, scale) => {
	const num = toNum(n)
	const sc = toScale(scale)
	if (num === null || sc === null) return null
	return roundAt(num, sc, Math.floor)
})

reg("ceiling", (n, scale) => {
	const num = toNum(n)
	const sc = toScale(scale)
	if (num === null || sc === null) return null
	return roundAt(num, sc, Math.ceil)
})

reg("round half up", (n, scale) => {
	const num = toNum(n)
	const sc = toScale(scale)
	if (num === null || sc === null) return null
	return roundAt(num, sc, roundHalfUp)
})

reg("round half down", (n, scale) => {
	const num = toNum(n)
	const sc = toScale(scale)
	if (num === null || sc === null) return null
	return roundAt(num, sc, roundHalfDown)
})

reg("round up", (n, scale) => {
	const num = toNum(n)
	const sc = toScale(scale)
	if (num === null || sc === null) return null
	return roundAt(num, sc, (x) => (x >= 0 ? Math.ceil(x) : Math.floor(x)))
})

reg("round down", (n, scale) => {
	const num = toNum(n)
	const sc = toScale(scale)
	if (num === null || sc === null) return null
	return roundAt(num, sc, Math.trunc)
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
	// count() takes a list; a null argument is a type error, not a one-item list.
	if (args.length === 1 && args[0] === null) return null
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
	if (args.length === 0) return null
	const list = unwrapList(flattenToList(args))
	if (list.length === 0) return null
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
	if (args.length === 0) return null
	const list = unwrapList(flattenToList(args))
	const counts = new Map<number, number>()
	for (const v of list) {
		const n = toNum(v)
		if (n === null) return null
		counts.set(n, (counts.get(n) ?? 0) + 1)
	}
	if (counts.size === 0) return []
	const maxCount = Math.max(...counts.values())
	// The most frequent values, in ascending order.
	return [...counts]
		.filter(([, count]) => count === maxCount)
		.map(([value]) => value)
		.sort((a, b) => a - b)
})

reg("all", (...args) => {
	if (args.length === 0) return null
	const list = unwrapList(flattenToList(args))
	let hasNull = false
	for (const v of list) {
		if (v === false) return false
		if (v === null) hasNull = true
		else if (typeof v !== "boolean") return null
	}
	return hasNull ? null : true
})

reg("any", (...args) => {
	if (args.length === 0) return null
	const list = unwrapList(flattenToList(args))
	let hasNull = false
	for (const v of list) {
		if (v === true) return true
		if (v === null) hasNull = true
		else if (typeof v !== "boolean") return null
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

// Set membership is SameValueZero, exactly what Array#includes used here, so
// de-duplication keeps its semantics while dropping from O(n²) to O(n).
reg("union", (...args) => {
	const seen = new Set<FeelValue>()
	for (const v of args) {
		if (isFeelList(v)) {
			for (const item of v) seen.add(item)
		} else {
			seen.add(v)
		}
	}
	return [...seen]
})

reg("distinct values", (list) => {
	if (!isFeelList(list)) return null
	return [...new Set(list)]
})

// Camunda extensions (feel-scala) --------------------------------------------

reg("duplicate values", (list) => {
	if (!isFeelList(list)) return null
	// Each value that occurs more than once, in the order it first occurs.
	// Numbers, strings and booleans are counted by key; structured values
	// (dates, lists, contexts) are compared against the groups seen so far.
	type Group = { item: FeelValue; count: number }
	const groups: Group[] = []
	const byKey = new Map<FeelValue, Group>()
	for (const item of list) {
		const keyed = item === null || typeof item !== "object"
		let group = keyed ? byKey.get(item) : groups.find((g) => sameItem(g.item, item))
		if (!group) {
			group = { item, count: 0 }
			groups.push(group)
			if (keyed) byKey.set(item, group)
		}
		group.count++
	}
	return groups.filter((g) => g.count > 1).map((g) => g.item)
})

reg("is empty", (list) => (isFeelList(list) ? list.length === 0 : null))

reg("partition", (list, size) => {
	if (!isFeelList(list)) return null
	const n = toNum(size)
	// A size of zero has no partition either: it would never consume the list.
	if (n === null || !Number.isInteger(n) || n <= 0) return null
	const parts: FeelValue[] = []
	for (let i = 0; i < list.length; i += n) parts.push(list.slice(i, i + n))
	return parts
})

reg("flatten", (list) => {
	if (!isFeelList(list)) return null
	const result: FeelValue[] = []
	const flat = (arr: FeelValue[]): void => {
		for (const v of arr) {
			if (isFeelList(v)) flat(v)
			else result.push(v)
		}
	}
	flat(list)
	return result
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

/**
 * Camunda's assert(): the value when the condition holds. Camunda fails the
 * evaluation otherwise, with the cause as its message; this package reports
 * an evaluation error as null, so a failed assertion is null here.
 */
reg("assert", (value, condition, cause) => {
	if (cause !== undefined && cause !== null && typeof cause !== "string") return null
	return condition === true ? (value ?? null) : null
})

// -------------------------------------------------------------------------
// AI agent functions (Camunda extension)
// -------------------------------------------------------------------------

/**
 * Tags a value as provided by an AI agent's tool call. The tag is read by the
 * connector that builds the tool definition, not by the engine, so evaluating
 * it returns the value unchanged.
 */
reg("fromAi", (value) => value ?? null)

// -------------------------------------------------------------------------
// Context functions
// -------------------------------------------------------------------------

reg("get value", (ctx, key) => {
	if (!isFeelContext(ctx)) return null
	// A list of keys walks into nested contexts: get value(c, ["y", "a"]).
	const path = isFeelList(key) ? key : [key]
	let current: FeelValue = ctx
	for (const step of path) {
		const name = toStr(step)
		if (name === null || !isFeelContext(current)) return null
		const next: FeelValue | undefined = current[name]
		if (next === undefined) return null
		current = next
	}
	return current
})

reg("get entries", (ctx) => {
	if (!isFeelContext(ctx)) return null
	return Object.entries(ctx).map(([k, v]) => ({ key: k, value: v }) as FeelValue)
})

reg("context put", (ctx, key, value) => {
	if (!isFeelContext(ctx)) return null
	if (value === undefined) return null
	const path = isFeelList(key) ? key : [key]
	if (path.length === 0) return null
	return putPath(ctx, path, value)
})

/** Copies a context with `path` set to `value`, creating contexts on the way. */
function putPath(ctx: FeelContext, path: FeelValue[], value: FeelValue): FeelValue {
	const name = toStr(path[0] ?? null)
	if (name === null) return null
	const result: FeelContext = { ...ctx }
	if (path.length === 1) {
		result[name] = value
		return result
	}
	const nested: FeelValue | undefined = result[name]
	// A step onto something that is not a context has nowhere to go.
	if (nested !== undefined && !isFeelContext(nested)) return null
	const inner = putPath(nested ?? {}, path.slice(1), value)
	if (inner === null) return null
	result[name] = inner
	return result
}

reg("context merge", (...args) => {
	// The signature is one list of contexts; a bare argument list is accepted
	// too, the way the other list built-ins are.
	const first = args[0] ?? null
	const contexts = args.length === 1 && isFeelList(first) ? first : args
	if (contexts.length === 0) return null
	const result: FeelContext = {}
	for (const v of contexts) {
		if (!isFeelContext(v)) return null
		for (const [k, cv] of Object.entries(v)) result[k] = cv
	}
	return result
})

reg("context", (entries) => {
	const list = isFeelList(entries) ? entries : [entries]
	const result: FeelContext = {}
	for (const item of list) {
		if (!isFeelContext(item)) return null
		const k = item.key
		if (typeof k !== "string") return null
		// An entry naming a key already set is a conflict, not an overwrite.
		if (k in result) return null
		result[k] = item.value !== undefined ? item.value : null
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
		if (isFeelDate(v)) return v
		return null
	}
	if (args.length === 3) {
		const y = toNum(at(args, 0))
		const m = toNum(at(args, 1))
		const d = toNum(at(args, 2))
		if (y === null || m === null || d === null) return null
		return makeDate(y, m, d)
	}
	return null
})

reg("time", (...args) => {
	if (args.length === 1) {
		const v = at(args, 0)
		// ISO 8601's time designator may lead: time("T23:59:00").
		if (typeof v === "string") return parseTime(v.startsWith("T") ? v.slice(1) : v)
		if (isFeelDateTime(v)) return v.time
		if (isFeelTime(v)) return v
		if (isFeelDate(v)) return { type: "time", hour: 0, minute: 0, second: 0 }
		return null
	}
	if (args.length >= 3) {
		const h = toNum(at(args, 0))
		const m = toNum(at(args, 1))
		const s = toNum(at(args, 2))
		if (h === null || m === null || s === null) return null
		if (!isValidTime(h, m, s)) return null
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
		if (isFeelDateTime(d) && typeof t === "string") return inTimezone(d, t)
		return null
	}
	return null
})

/**
 * Camunda's date and time(date, timezone): the same instant, on the clock of
 * another zone — an IANA name, "Z", or an offset such as "+02:00". A local
 * date and time names no instant, so it has none to move and is null.
 */
function inTimezone(dt: FeelDateTime, zone: string): FeelDateTime | null {
	if (offsetOf(dt.time, dateToEpochDays(dt.date)) === undefined) return null
	const instant = dateTimeToSeconds(dt)
	let offsetSeconds: number | undefined
	let timezone: string | undefined
	const fixed = /^([+-])(\d{2}):(\d{2})$/.exec(zone)
	if (zone === "Z") {
		offsetSeconds = 0
	} else if (fixed) {
		offsetSeconds = (fixed[1] === "-" ? -1 : 1) * (Number(fixed[2]) * 3600 + Number(fixed[3]) * 60)
		if (Math.abs(offsetSeconds) > MAX_OFFSET_SECONDS) return null
	} else if (isKnownTimezone(zone)) {
		timezone = zone
	} else {
		return null
	}
	const local = instant + (offsetSeconds ?? zoneOffsetSeconds(zone, instant / 86400))
	const days = Math.floor(local / 86400)
	const rem = local - days * 86400
	return {
		type: "date-time",
		date: epochDaysToDate(days),
		time: {
			type: "time",
			hour: Math.floor(rem / 3600),
			minute: Math.floor((rem % 3600) / 60),
			second: rem % 60,
			offsetSeconds,
			timezone,
		},
	}
}

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
	let months = (d2.year - d1.year) * 12 + (d2.month - d1.month)
	// Only whole months count, so a end that has not yet reached the start's
	// day-and-time within the month gives back the month it was counted.
	const remainder = compareWithinMonth(from, to)
	if (months > 0 && remainder < 0) months -= 1
	else if (months < 0 && remainder > 0) months += 1
	return { type: "years-months-duration", months }
})

/** Orders two temporals by day of month and time of day, ignoring year and month. */
function compareWithinMonth(a: FeelValue, b: FeelValue): number {
	const partsOf = (v: FeelValue): [number, number] => {
		if (isFeelDate(v)) return [v.day, 0]
		if (isFeelDateTime(v)) return [v.date.day, timeToSeconds(v.time)]
		return [0, 0]
	}
	const [dayA, secA] = partsOf(a)
	const [dayB, secB] = partsOf(b)
	return dayB - dayA || secB - secA
}

// Camunda extensions (feel-scala) --------------------------------------------

reg("to json", (v) => {
	const json = toJson(v ?? null)
	return json === undefined ? null : json
})

/** A value's JSON text, or undefined for a value JSON has no form for (a function, a range). */
function toJson(v: FeelValue): string | undefined {
	if (v === null || typeof v === "number" || typeof v === "boolean" || typeof v === "string") {
		return JSON.stringify(v)
	}
	if (isFeelList(v)) {
		const items: string[] = []
		for (const item of v) {
			const json = toJson(item)
			if (json === undefined) return undefined
			items.push(json)
		}
		return `[${items.join(",")}]`
	}
	if (isFeelContext(v)) {
		const entries: string[] = []
		for (const [key, value] of Object.entries(v)) {
			const json = toJson(value)
			if (json === undefined) return undefined
			entries.push(`${JSON.stringify(key)}:${json}`)
		}
		return `{${entries.join(",")}}`
	}
	// A zoned date and time carries its offset as well, the form Java writes:
	// 2025-11-24T10:00:00+01:00[Europe/Berlin].
	if (isFeelDateTime(v) && v.time.timezone !== undefined && v.time.offsetSeconds === undefined) {
		const offset = zoneOffsetSeconds(v.time.timezone, dateToEpochDays(v.date))
		const time = formatTime({ ...v.time, offsetSeconds: offset, timezone: undefined })
		return JSON.stringify(`${formatDate(v.date)}T${time}[${v.time.timezone}]`)
	}
	const text = scalarToString(v)
	return typeof text === "string" ? JSON.stringify(text) : undefined
}

reg("from json", (text) => {
	const s = toStr(text)
	if (s === null) return null
	let parsed: unknown
	try {
		parsed = JSON.parse(s)
	} catch {
		return null
	}
	return fromJson(parsed)
})

function fromJson(v: unknown): FeelValue {
	if (v === null || typeof v === "number" || typeof v === "boolean" || typeof v === "string") {
		return v
	}
	if (Array.isArray(v)) return v.map(fromJson)
	const context: FeelContext = {}
	for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
		// defineProperty, so that a "__proto__" key is an entry rather than a prototype.
		Object.defineProperty(context, key, {
			value: fromJson(value),
			enumerable: true,
			writable: true,
			configurable: true,
		})
	}
	return context
}

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
	// ISO 8601: week 1 is the one holding the first Thursday, so the turn of
	// the year can fall in the neighbouring year's last or first week.
	const weekday = isoWeekday(date)
	const week = Math.floor((dayOfYear(date) - weekday + 10) / 7)
	if (week < 1) return isoWeeksInYear(date.year - 1)
	if (week > isoWeeksInYear(date.year)) return 1
	return week
})

/** Monday is 1, Sunday is 7. Epoch day 0, 1970-01-01, was a Thursday. */
function isoWeekday(d: FeelDate): number {
	return ((((dateToEpochDays(d) + 3) % 7) + 7) % 7) + 1
}

/** 52 or 53, whichever ISO 8601 gives the year. */
function isoWeeksInYear(year: number): number {
	const jan1 = isoWeekday({ type: "date", year, month: 1, day: 1 })
	const long = jan1 === 4 || (isLeapYear(year) && jan1 === 3)
	return long ? 53 : 52
}

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
	// The date of that day, as Camunda defines it, not the day number.
	return {
		type: "date",
		year: date.year,
		month: date.month,
		day: daysInMonth(date.year, date.month),
	}
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

/**
 * DMN's overlaps before, term by term: range1 starts first, ends inside
 * range2 — touching its start only where both ends are closed — and does not
 * outlast it.
 */
function overlapsBefore(a: FeelRange, b: FeelRange): boolean {
	const startsFirst = cmpPts(startOf(a), startOf(b), "start") < 0
	const c = compareValues(a.end, b.start) ?? -1
	const reachesIn = c > 0 || (c === 0 && a.endIncluded && b.startIncluded)
	const e = compareValues(a.end, b.end) ?? 1
	const endsWithin = e < 0 || (e === 0 && (!a.endIncluded || b.endIncluded))
	return startsFirst && reachesIn && endsWithin
}

reg("overlaps before", (a, b) => {
	if (!isFeelRange(a) || !isFeelRange(b)) return null
	return overlapsBefore(a, b)
})

reg("overlaps after", (a, b) => {
	if (!isFeelRange(a) || !isFeelRange(b)) return null
	return overlapsBefore(b, a)
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
	// starts(point, range): the range begins at that point, inclusively.
	if (!isFeelRange(b)) return null
	if (!isFeelRange(a)) {
		return b.startIncluded && compareValues(a, b.start) === 0
	}
	return cmpPts(startOf(a), startOf(b), "start") === 0 && cmpPts(endOf(a), endOf(b), "end") <= 0
})

reg("started by", (a, b) => {
	if (!isFeelRange(a)) return null
	if (!isFeelRange(b)) {
		return a.startIncluded && compareValues(a.start, b) === 0
	}
	return cmpPts(startOf(a), startOf(b), "start") === 0 && cmpPts(endOf(b), endOf(a), "end") <= 0
})

reg("finishes", (a, b) => {
	// finishes(point, range): the range ends at that point, inclusively.
	if (!isFeelRange(b)) return null
	if (!isFeelRange(a)) {
		return b.endIncluded && compareValues(a, b.end) === 0
	}
	return cmpPts(endOf(a), endOf(b), "end") === 0 && cmpPts(startOf(b), startOf(a), "start") <= 0
})

reg("finished by", (a, b) => {
	if (!isFeelRange(a)) return null
	if (!isFeelRange(b)) {
		return a.endIncluded && compareValues(a.end, b) === 0
	}
	return cmpPts(endOf(a), endOf(b), "end") === 0 && cmpPts(startOf(a), startOf(b), "start") <= 0
})

/**
 * DMN's is(): whether two values are the same value, not merely equal ones.
 * Temporal values differ when they are written differently even where they
 * name the same instant, so a local time is not the same value as one at
 * UTC, and a zone is not the same value as the offset it currently has.
 */
reg("is", (a, b, ...rest) => {
	if (rest.length > 0) return null
	if (b === undefined) return false
	if (a === null || b === null) return a === null && b === null
	if (isFeelTime(a) || isFeelDateTime(a) || isFeelTime(b) || isFeelDateTime(b)) {
		return sameTemporal(a, b)
	}
	if (valueType(a) !== valueType(b)) return false
	return compareValues(a, b) === 0 || deepEquals(a, b)
})

/** Compares the written form of a time or date-time, field by field. */
function sameTemporal(a: FeelValue, b: FeelValue): boolean {
	if (isFeelTime(a) && isFeelTime(b)) {
		return (
			a.hour === b.hour &&
			a.minute === b.minute &&
			a.second === b.second &&
			a.offsetSeconds === b.offsetSeconds &&
			a.timezone === b.timezone
		)
	}
	if (isFeelDateTime(a) && isFeelDateTime(b)) {
		return (
			a.date.year === b.date.year &&
			a.date.month === b.date.month &&
			a.date.day === b.date.day &&
			sameTemporal(a.time, b.time)
		)
	}
	return false
}

/** The FEEL type of a value, for deciding whether two values are the same kind. */
function valueType(v: FeelValue): string {
	if (v === null) return "null"
	if (Array.isArray(v)) return "list"
	if (typeof v !== "object") return typeof v
	const tagged = (v as { type?: unknown }).type
	return typeof tagged === "string" ? tagged : "context"
}

/** Whether two list items are equal: the same instant, number or string, or equal structures. */
function sameItem(a: FeelValue, b: FeelValue): boolean {
	if (valueType(a) !== valueType(b)) return false
	return compareValues(a, b) === 0 || deepEquals(a, b)
}

function deepEquals(a: FeelValue, b: FeelValue): boolean {
	if (a === b) return true
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((x, i) => deepEquals(x, b[i] ?? null))
	}
	if (isFeelContext(a) && isFeelContext(b)) {
		const keys = Object.keys(a)
		if (keys.length !== Object.keys(b).length) return false
		return keys.every((k) => deepEquals(a[k] ?? null, b[k] ?? null))
	}
	return false
}

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
// Parameter names
// -------------------------------------------------------------------------

/** One signature per subset of the optional parameters, each in declaration order. */
function withOptionalParams(required: string[], optional: string[]): string[][] {
	const signatures = [required]
	for (const param of optional) {
		const count = signatures.length
		for (let i = 0; i < count; i++) signatures.push([...(signatures[i] as string[]), param])
	}
	return signatures
}

// Parameter names of every built-in, in declaration order, so that a named
// invocation such as `substring(start position: 2, string: "hello")` binds by
// name rather than by the order the arguments happen to appear in. Built-ins
// with several signatures list one entry per signature.
const PARAM_SIGNATURES: Record<string, string[][]> = {
	// Conversion
	string: [["from"]],
	number: [
		["from"],
		["from", "grouping separator"],
		["from", "grouping separator", "decimal separator"],
	],
	context: [["entries"]],
	date: [["from"], ["year", "month", "day"]],
	time: [["from"], ["hour", "minute", "second"], ["hour", "minute", "second", "offset"]],
	"date and time": [["from"], ["date", "time"], ["date", "timezone"]],
	duration: [["from"]],
	"years and months duration": [["from", "to"]],
	// Boolean
	not: [["negand"]],
	is: [["value1"], ["value2"], ["value1", "value2"]],
	"is defined": [["value"]],
	"get or else": [["value", "default"]],
	assert: [
		["value", "condition"],
		["value", "condition", "cause"],
	],
	// Every parameter after the value is optional, and is passed by name in any
	// combination: fromAi(value: toolCall.id, type: "number").
	fromAi: withOptionalParams(["value"], ["description", "type", "schema", "options"]),
	// String
	substring: [
		["string", "start position"],
		["string", "start position", "length"],
	],
	"string length": [["string"]],
	"upper case": [["string"]],
	"lower case": [["string"]],
	"substring before": [["string", "match"]],
	"substring after": [["string", "match"]],
	contains: [["string", "match"]],
	"starts with": [["string", "match"]],
	"ends with": [["string", "match"]],
	matches: [
		["input", "pattern"],
		["input", "pattern", "flags"],
	],
	replace: [
		["input", "pattern", "replacement"],
		["input", "pattern", "replacement", "flags"],
	],
	split: [["string", "delimiter"]],
	"string join": [["list"], ["list", "delimiter"], ["list", "delimiter", "prefix", "suffix"]],
	"is blank": [["string"]],
	trim: [["string"]],
	extract: [["string", "pattern"]],
	uuid: [[]],
	"to base64": [["value"]],
	"from base64": [["value"]],
	"to json": [["value"]],
	"from json": [["value"]],
	// List
	"list contains": [["list", "element"]],
	count: [["list"]],
	min: [["list"]],
	max: [["list"]],
	sum: [["list"]],
	product: [["list"]],
	mean: [["list"]],
	median: [["list"]],
	stddev: [["list"]],
	mode: [["list"]],
	all: [["list"]],
	any: [["list"]],
	sublist: [
		["list", "start position"],
		["list", "start position", "length"],
	],
	append: [["list", "items"]],
	concatenate: [["lists"]],
	"insert before": [["list", "position", "newItem"]],
	remove: [["list", "position"]],
	reverse: [["list"]],
	"index of": [["list", "match"]],
	union: [["list"]],
	"distinct values": [["list"]],
	flatten: [["list"]],
	sort: [["list", "precedes"]],
	"duplicate values": [["list"]],
	"is empty": [["list"]],
	partition: [["list", "size"]],
	// Numeric
	decimal: [["n", "scale"]],
	floor: [["n"], ["n", "scale"]],
	ceiling: [["n"], ["n", "scale"]],
	"round up": [["n", "scale"]],
	"round down": [["n", "scale"]],
	"round half up": [["n", "scale"]],
	"round half down": [["n", "scale"]],
	abs: [["number"], ["n"]],
	modulo: [["dividend", "divisor"]],
	sqrt: [["number"]],
	log: [["number"]],
	exp: [["number"]],
	odd: [["number"]],
	even: [["number"]],
	"random number": [[]],
	// Context
	"get value": [
		["context", "key"],
		["context", "keys"],
		["m", "key"],
		["m", "keys"],
	],
	"get entries": [["context"], ["m"]],
	"context put": [
		["context", "key", "value"],
		["context", "keys", "value"],
	],
	"context merge": [["contexts"]],
	// Temporal
	now: [[]],
	today: [[]],
	"day of week": [["date"]],
	"day of year": [["date"]],
	"week of year": [["date"]],
	"month of year": [["date"]],
	"last day of month": [["date"]],
	// Range
	before: [
		["point1", "point2"],
		["range", "point"],
		["point", "range"],
		["range1", "range2"],
	],
	after: [
		["point1", "point2"],
		["range", "point"],
		["point", "range"],
		["range1", "range2"],
	],
	meets: [["range1", "range2"]],
	"met by": [["range1", "range2"]],
	overlaps: [["range1", "range2"]],
	"overlaps before": [["range1", "range2"]],
	"overlaps after": [["range1", "range2"]],
	finishes: [
		["point", "range"],
		["range1", "range2"],
	],
	"finished by": [
		["range", "point"],
		["range1", "range2"],
	],
	includes: [
		["range", "point"],
		["range1", "range2"],
	],
	during: [
		["point", "range"],
		["range1", "range2"],
	],
	starts: [
		["point", "range"],
		["range1", "range2"],
	],
	"started by": [
		["range", "point"],
		["range1", "range2"],
	],
	coincides: [
		["point1", "point2"],
		["range1", "range2"],
	],
}

// Built-ins DMN also defines over a bare argument list, so that max(1,2,3)
// means max([1,2,3]). Their arity is not checked; everything else's is.
const VARIADIC = new Set([
	"min",
	"max",
	"sum",
	"product",
	"mean",
	"median",
	"stddev",
	"mode",
	"all",
	"any",
	"count",
	"append",
	"concatenate",
	"union",
	"context merge",
])

/** The argument counts a built-in accepts, or undefined when it takes any. */
function aritiesOf(name: string): Set<number> | undefined {
	if (VARIADIC.has(name)) return undefined
	const signatures = PARAM_SIGNATURES[name]
	if (!signatures) return undefined
	return new Set(signatures.map((params) => params.length))
}

/**
 * Orders the arguments of a named invocation to match a built-in's signature.
 * Returns, for each parameter position, the index of the argument supplying
 * it, or null when no signature of the built-in accepts exactly these names —
 * which FEEL treats as an invocation error rather than a positional call.
 */
export function orderNamedArgs(name: string, argNames: string[]): number[] | null {
	const signatures = PARAM_SIGNATURES[name]
	if (!signatures) return null
	for (const params of signatures) {
		if (params.length !== argNames.length) continue
		const order = params.map((param) => argNames.indexOf(param))
		if (order.every((idx) => idx >= 0)) return order
	}
	return null
}

// -------------------------------------------------------------------------
// Exports
// -------------------------------------------------------------------------

// One FeelFunction wrapper per built-in, created on first use and shared: name
// resolution runs for every identifier the evaluator meets, so allocating a
// wrapper and closure per lookup showed up on every loop iteration.
const builtinWrappers = new Map<string, FeelFunction>()

/** Look up a built-in function by name. Returns undefined if not found. */
export function getBuiltin(name: string): FeelFunction | undefined {
	const cached = builtinWrappers.get(name)
	if (cached) return cached
	const fn = builtinMap.get(name)
	if (!fn) return undefined
	const arities = aritiesOf(name)
	const wrapper: FeelFunction = {
		type: "function",
		// Calling a built-in with a number of arguments no signature accepts is
		// an error, and FEEL reports an error as null.
		call: (args) => (arities && !arities.has(args.length) ? null : fn(...args)),
	}
	builtinWrappers.set(name, wrapper)
	return wrapper
}

/** All built-in names. */
export function builtinNames(): string[] {
	return [...builtinMap.keys()]
}

/** Parse a @"..." temporal literal to a FeelValue. */
export { parseTemporal, compareValues }
