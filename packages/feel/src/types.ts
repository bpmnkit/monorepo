export type FeelValue =
	| null
	| number
	| string
	| boolean
	| FeelDate
	| FeelTime
	| FeelDateTime
	| FeelDayTimeDuration
	| FeelYearsMonthsDuration
	| FeelRange
	| FeelValue[]
	| FeelContext
	| FeelFunction

export interface FeelDate {
	type: "date"
	year: number
	month: number
	day: number
}

export interface FeelTime {
	type: "time"
	hour: number
	minute: number
	second: number
	offsetSeconds?: number
	timezone?: string
}

export interface FeelDateTime {
	type: "date-time"
	date: FeelDate
	time: FeelTime
}

export interface FeelDayTimeDuration {
	type: "days-time-duration"
	seconds: number
}

export interface FeelYearsMonthsDuration {
	type: "years-months-duration"
	months: number
}

export interface FeelRange {
	type: "range"
	start: FeelValue
	startIncluded: boolean
	end: FeelValue
	endIncluded: boolean
}

// Use interface to avoid circular type alias issue with Record<string, FeelValue>
export interface FeelContext {
	[key: string]: FeelValue
}

export interface FeelFunction {
	type: "function"
	paramNames?: string[]
	call: (args: FeelValue[]) => FeelValue
}

// Type guards

function objType(v: object): string | undefined {
	const t = (v as { type?: unknown }).type
	return typeof t === "string" ? t : undefined
}

export function isFeelDate(v: FeelValue): v is FeelDate {
	if (typeof v !== "object" || v === null || Array.isArray(v)) return false
	return objType(v) === "date"
}

export function isFeelTime(v: FeelValue): v is FeelTime {
	if (typeof v !== "object" || v === null || Array.isArray(v)) return false
	return objType(v) === "time"
}

export function isFeelDateTime(v: FeelValue): v is FeelDateTime {
	if (typeof v !== "object" || v === null || Array.isArray(v)) return false
	return objType(v) === "date-time"
}

export function isFeelDayTimeDuration(v: FeelValue): v is FeelDayTimeDuration {
	if (typeof v !== "object" || v === null || Array.isArray(v)) return false
	return objType(v) === "days-time-duration"
}

export function isFeelYearsMonthsDuration(v: FeelValue): v is FeelYearsMonthsDuration {
	if (typeof v !== "object" || v === null || Array.isArray(v)) return false
	return objType(v) === "years-months-duration"
}

export function isFeelRange(v: FeelValue): v is FeelRange {
	if (typeof v !== "object" || v === null || Array.isArray(v)) return false
	return objType(v) === "range"
}

export function isFeelFunction(v: FeelValue): v is FeelFunction {
	if (typeof v !== "object" || v === null || Array.isArray(v)) return false
	return objType(v) === "function"
}

export function isFeelDuration(v: FeelValue): v is FeelDayTimeDuration | FeelYearsMonthsDuration {
	return isFeelDayTimeDuration(v) || isFeelYearsMonthsDuration(v)
}

export function isFeelList(v: FeelValue): v is FeelValue[] {
	return Array.isArray(v)
}

export function isFeelContext(v: FeelValue): v is FeelContext {
	if (typeof v !== "object" || v === null || Array.isArray(v)) return false
	const t = objType(v)
	return (
		t !== "date" &&
		t !== "time" &&
		t !== "date-time" &&
		t !== "days-time-duration" &&
		t !== "years-months-duration" &&
		t !== "range" &&
		t !== "function"
	)
}

/** Gets a named property from a FeelValue for path expressions. Returns null if not found. */
export function getProperty(v: FeelValue, key: string): FeelValue {
	if (typeof v !== "object" || v === null || Array.isArray(v)) return null
	if (isFeelDate(v)) {
		if (key === "year") return v.year
		if (key === "month") return v.month
		if (key === "day") return v.day
		return null
	}
	if (isFeelTime(v)) {
		if (key === "hour") return v.hour
		if (key === "minute") return v.minute
		if (key === "second") return v.second
		if (key === "time offset") return v.offsetSeconds !== undefined ? v.offsetSeconds / 3600 : null
		if (key === "timezone") return v.timezone ?? null
		return null
	}
	if (isFeelDateTime(v)) {
		if (key === "year") return v.date.year
		if (key === "month") return v.date.month
		if (key === "day") return v.date.day
		if (key === "hour") return v.time.hour
		if (key === "minute") return v.time.minute
		if (key === "second") return v.time.second
		if (key === "time offset")
			return v.time.offsetSeconds !== undefined ? v.time.offsetSeconds / 3600 : null
		if (key === "timezone") return v.time.timezone ?? null
		if (key === "time") return v.time
		return null
	}
	if (isFeelDayTimeDuration(v)) {
		const total = v.seconds
		if (key === "days") return Math.trunc(total / 86400)
		if (key === "hours") return Math.trunc((total % 86400) / 3600)
		if (key === "minutes") return Math.trunc((total % 3600) / 60)
		if (key === "seconds") return total % 60
		return null
	}
	if (isFeelYearsMonthsDuration(v)) {
		if (key === "years") return Math.trunc(v.months / 12)
		if (key === "months") return v.months % 12
		return null
	}
	// FeelContext
	const val = (v as FeelContext)[key]
	return val !== undefined ? val : null
}
