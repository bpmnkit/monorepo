import { bold, cyan, dim, green, red, shouldUseColor, stateColor } from "./color.js"
import type { ColumnDef, OutputFormat, OutputWriter, RawResponseEvent } from "./types.js"

// ─── Formatting helpers ────────────────────────────────────────────────────────

/** Format an ISO date string to a readable local time. */
function fmtDate(v: unknown): string {
	if (!v) return "—"
	const d = new Date(String(v))
	if (Number.isNaN(d.getTime())) return String(v)
	return d.toLocaleString("en-US", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	})
}

/** Format a value for table display. */
function formatCell(value: unknown, transform?: (v: unknown) => string): string {
	if (transform) return transform(value)
	if (value === null || value === undefined) return "—"
	if (typeof value === "object") return JSON.stringify(value)
	return String(value)
}

/** Truncate a string to maxLen, appending "…" if truncated. */
function truncate(s: string, maxLen: number): string {
	if (maxLen > 0 && s.length > maxLen) return `${s.slice(0, maxLen - 1)}…`
	return s
}

/** Strip ANSI escape codes to get the visual width of a string. */
function visibleLength(s: string): number {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: needed for ANSI stripping
	return s.replace(/\x1b\[[0-9;]*m/g, "").length
}

/** Pad a string to visually fill `width` characters (accounting for ANSI codes). */
function padEnd(s: string, width: number): string {
	const vis = visibleLength(s)
	return vis < width ? s + " ".repeat(width - vis) : s
}

// ─── YAML serializer ──────────────────────────────────────────────────────────

function toYaml(value: unknown, indent = 0): string {
	const pad = "  ".repeat(indent)
	if (value === null || value === undefined) return "null\n"
	if (typeof value === "boolean") return `${value}\n`
	if (typeof value === "number") return `${value}\n`
	if (typeof value === "string") {
		if (/[\n:#{}"',]/.test(value)) return `"${value.replace(/"/g, '\\"')}"\n`
		return `${value}\n`
	}
	if (Array.isArray(value)) {
		if (value.length === 0) return "[]\n"
		return value.map((item) => `${pad}- ${toYaml(item, indent + 1).trimStart()}`).join("")
	}
	if (typeof value === "object") {
		const obj = value as Record<string, unknown>
		const keys = Object.keys(obj)
		if (keys.length === 0) return "{}\n"
		return keys.map((k) => `${pad}${k}: ${toYaml(obj[k], indent + 1).trimStart()}`).join("")
	}
	return `${String(value)}\n`
}

// ─── Table renderer ───────────────────────────────────────────────────────────

function printTable(rows: Record<string, unknown>[], columns: ColumnDef[], colors: boolean): void {
	if (rows.length === 0) {
		process.stdout.write(dim("No results.\n", colors))
		return
	}

	// Calculate column widths
	const widths = columns.map((col) => {
		const dataMax = rows.reduce((max, row) => {
			const raw = formatCell(row[col.key], col.transform)
			const cell = col.maxWidth ? truncate(raw, col.maxWidth) : raw
			return Math.max(max, visibleLength(cell))
		}, 0)
		return Math.max(col.header.length, dataMax)
	})

	// Header
	const header = columns
		.map((col, i) => padEnd(bold(col.header, colors), widths[i] ?? col.header.length))
		.join("  ")
	process.stdout.write(`${header}\n`)
	process.stdout.write(`${dim("─".repeat(visibleLength(header)), colors)}\n`)

	// Rows
	for (const row of rows) {
		const line = columns
			.map((col, i) => {
				const width = widths[i] ?? col.maxWidth ?? 20
				const raw = formatCell(row[col.key], col.transform)
				const cell = col.maxWidth ? truncate(raw, col.maxWidth) : raw
				// Apply state colors automatically
				const colored =
					col.key === "state" || col.key === "errorState" ? stateColor(cell, colors) : cell
				return padEnd(colored, width)
			})
			.join("  ")
		process.stdout.write(`${line}\n`)
	}
}

/** Print a single object as aligned key-value pairs. */
function printKV(obj: Record<string, unknown>, colors: boolean): void {
	const entries = Object.entries(obj).filter(([, v]) => v !== undefined)
	const keyWidth = entries.reduce((max, [k]) => Math.max(max, k.length), 0)

	for (const [k, v] of entries) {
		const label = padEnd(cyan(k, colors), keyWidth)
		const value = v === null || v === undefined ? dim("—", colors) : String(v)
		process.stdout.write(`${label}  ${value}\n`)
	}
}

/** Recursively flatten an object for KV display. Arrays of objects are expanded with [i] keys. */
function flattenForDisplay(obj: unknown, prefix = ""): Record<string, unknown> {
	if (typeof obj !== "object" || obj === null) return { value: obj }
	const result: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
		const key = prefix ? `${prefix}.${k}` : k
		if (Array.isArray(v)) {
			if (v.length === 0) {
				result[key] = "[]"
			} else if (v.every((item) => typeof item !== "object" || item === null)) {
				result[key] = v.join(", ")
			} else {
				for (let i = 0; i < v.length; i++) {
					const elem = v[i]
					if (typeof elem === "object" && elem !== null) {
						Object.assign(result, flattenForDisplay(elem, `${key}[${i}]`))
					} else {
						result[`${key}[${i}]`] = elem
					}
				}
			}
		} else if (typeof v === "object" && v !== null) {
			Object.assign(result, flattenForDisplay(v, key))
		} else {
			result[key] = v
		}
	}
	return result
}

// ─── OutputWriter factory ────────────────────────────────────────────────────

export function createOutputWriter(format: OutputFormat, noColor: boolean): OutputWriter {
	const colors = shouldUseColor(noColor)

	return {
		format,
		isInteractive: process.stdout.isTTY === true,

		printList(data: unknown, columns: ColumnDef[]): void {
			// Unwrap { items: [...], page: {...} } envelope
			let items: unknown[]
			let total: number | undefined

			if (
				typeof data === "object" &&
				data !== null &&
				"items" in data &&
				Array.isArray((data as Record<string, unknown>).items)
			) {
				items = (data as { items: unknown[] }).items
				const page = (data as Record<string, unknown>).page
				if (typeof page === "object" && page !== null && "totalItems" in page) {
					total = (page as Record<string, unknown>).totalItems as number
				}
			} else if (Array.isArray(data)) {
				items = data
			} else {
				items = [data]
			}

			if (format === "json") {
				process.stdout.write(`${JSON.stringify(items, null, 2)}\n`)
				return
			}
			if (format === "yaml") {
				process.stdout.write(toYaml(items))
				return
			}

			printTable(items as Record<string, unknown>[], columns, colors)
			const count = total !== undefined ? total : items.length
			process.stdout.write(`\n${dim(`${count} ${count === 1 ? "item" : "items"}`, colors)}\n`)
		},

		printItem(data: unknown): void {
			if (format === "json") {
				process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
				return
			}
			if (format === "yaml") {
				process.stdout.write(toYaml(data))
				return
			}
			const obj =
				typeof data === "object" && data !== null
					? flattenForDisplay(data)
					: { value: String(data) }
			printKV(obj, colors)
		},

		print(data: unknown): void {
			if (format === "json") {
				process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
				return
			}
			if (format === "yaml") {
				process.stdout.write(toYaml(data))
				return
			}
			if (typeof data === "string") {
				process.stdout.write(`${data}\n`)
				return
			}
			process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
		},

		ok(msg: string): void {
			process.stdout.write(`${green("✓", colors)} ${msg}\n`)
		},

		info(msg: string): void {
			process.stdout.write(`${dim("→", colors)} ${msg}\n`)
		},
	}
}

/** Date transformer for use in ColumnDef. */
export const dateTransform = fmtDate

/** An OutputWriter that discards all output (used when --raw suppresses formatted output). */
export function createNullWriter(): OutputWriter {
	return {
		format: "table",
		isInteractive: false,
		printList() {},
		printItem() {},
		print() {},
		ok() {},
		info() {},
	}
}

/** Print a raw HTTP response (status, headers, body) to stdout. */
export function printRawResponse(raw: RawResponseEvent, noColor: boolean): void {
	const colors = shouldUseColor(noColor)
	const statusFn = raw.status >= 200 && raw.status < 300 ? green : red
	process.stdout.write(`${statusFn(`HTTP ${raw.status}`, colors)}\n`)
	for (const [k, v] of Object.entries(raw.headers)) {
		process.stdout.write(`${cyan(k, colors)}: ${v}\n`)
	}
	process.stdout.write("\n")
	// Pretty-print JSON body if possible, otherwise raw text
	try {
		const parsed = JSON.parse(raw.body)
		process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`)
	} catch {
		process.stdout.write(`${raw.body}\n`)
	}
}
