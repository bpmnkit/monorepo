import type { AdminApiClient, CamundaClient, RawResponseEvent } from "@bpmn-sdk/api"
import type {
	ColumnDef,
	Command,
	CommandGroup,
	FlagSpec,
	OutputWriter,
	RunContext,
} from "./types.js"

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const CSI = "\x1b["
const HIDE = `${CSI}?25l`
const SHOW = `${CSI}?25h`
const ALT_ON = `${CSI}?1049h`
const ALT_OFF = `${CSI}?1049l`
const CLEAR = `${CSI}2J${CSI}H`

const inv = (s: string) => `${CSI}7m${s}${CSI}m`
const bold = (s: string) => `${CSI}1m${s}${CSI}m`
const dim = (s: string) => `${CSI}2m${s}${CSI}m`
const green = (s: string) => `${CSI}32m${s}${CSI}m`
const red = (s: string) => `${CSI}31m${s}${CSI}m`
const cyan = (s: string) => `${CSI}36m${s}${CSI}m`

// biome-ignore lint/suspicious/noControlCharactersInRegex: needed for ANSI stripping
const ANSI_RE = /\x1b\[[0-9;]*m/g
function vlen(s: string): number {
	return s.replace(ANSI_RE, "").length
}
function padEnd(s: string, n: number): string {
	const v = vlen(s)
	return v < n ? s + " ".repeat(n - v) : s
}
function fit(s: string, n: number): string {
	return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldState {
	kind: "arg" | "flag" | "run"
	label: string
	hint: string
	value: string
	cursor: number
	required: boolean
	flagSpec?: FlagSpec
}

type CapturedOutput =
	| { type: "list"; items: Record<string, unknown>[]; columns: ColumnDef[]; total: number }
	| { type: "item"; data: unknown }
	| { type: "messages"; lines: string[] }

// Each screen that belongs to a group carries the group reference so the TUI
// can show the correct title and navigate back regardless of entry point.
type Screen =
	| { kind: "main"; cursor: number; scroll: number; search: string }
	| { kind: "commands"; group: CommandGroup; cursor: number; search: string }
	| {
			kind: "input"
			group: CommandGroup
			cmd: Command
			fields: FieldState[]
			cursor: number
			scroll: number
			editing: boolean
			error: string
			running: boolean
	  }
	| {
			kind: "results"
			group: CommandGroup
			cmd: Command
			output: CapturedOutput
			raw: RawResponseEvent | null
			rawView: boolean
			cursor: number
			scroll: number
	  }
	| {
			kind: "detail"
			group: CommandGroup
			item: unknown
			label: string
			cursor: number
			scroll: number
	  }
	| {
			kind: "followup"
			sourceGroup: CommandGroup
			item: Record<string, unknown>
			relations: Array<{
				group: CommandGroup
				cmd: Command
				params: Array<{ field: string; param: string }>
			}>
			cursor: number
			scroll: number
	  }

interface TuiState {
	/** All command groups — shown in the main menu. */
	groups: CommandGroup[]
	stack: Screen[]
	getClient: () => Promise<CamundaClient>
	getAdminClient: () => Promise<AdminApiClient>
	quitting: boolean
}

// ─── Capturing output writer ──────────────────────────────────────────────────

function makeCapturingWriter(): { writer: OutputWriter; get: () => CapturedOutput } {
	let captured: CapturedOutput = { type: "messages", lines: [] }

	function extractItems(data: unknown): Record<string, unknown>[] {
		if (typeof data === "object" && data !== null && "items" in data) {
			return (data as { items: unknown[] }).items as Record<string, unknown>[]
		}
		if (Array.isArray(data)) return data as Record<string, unknown>[]
		return [data as Record<string, unknown>]
	}

	function extractTotal(data: unknown, items: unknown[]): number {
		if (typeof data === "object" && data !== null) {
			const page = (data as Record<string, unknown>).page
			if (typeof page === "object" && page !== null) {
				const t = (page as Record<string, unknown>).totalItems
				if (typeof t === "number") return t
			}
		}
		return items.length
	}

	const writer: OutputWriter = {
		format: "table",
		isInteractive: true,
		printList(data, columns) {
			const items = extractItems(data)
			captured = { type: "list", items, columns, total: extractTotal(data, items) }
		},
		printItem(data) {
			captured = { type: "item", data }
		},
		print(data) {
			if (captured.type === "messages") {
				const str = typeof data === "string" ? data : JSON.stringify(data, null, 2)
				for (const line of str.split("\n")) {
					captured.lines.push(line)
				}
			}
		},
		ok(msg) {
			if (captured.type === "messages") captured.lines.push(`${green("✓")} ${msg}`)
		},
		info(msg) {
			if (captured.type === "messages") captured.lines.push(msg)
		},
	}

	return { writer, get: () => captured }
}

// ─── Field helpers ────────────────────────────────────────────────────────────

const SKIP_FLAGS = new Set(["output", "profile", "help", "no-color", "debug"])

function buildFields(cmd: Command): FieldState[] {
	const fields: FieldState[] = []
	for (const arg of cmd.args ?? []) {
		fields.push({
			kind: "arg",
			label: arg.name,
			hint: arg.required ? "required" : "optional",
			value: "",
			cursor: 0,
			required: arg.required ?? false,
		})
	}
	for (const flag of cmd.flags ?? []) {
		if (SKIP_FLAGS.has(flag.name)) continue
		const hintParts = [
			flag.type,
			flag.placeholder ? `<${flag.placeholder}>` : "",
			flag.required ? "required" : "optional",
		]
		fields.push({
			kind: "flag",
			label: `--${flag.name}`,
			hint: hintParts.filter(Boolean).join(" "),
			value: flag.default !== undefined ? String(flag.default) : "",
			cursor: 0,
			required: flag.required ?? false,
			flagSpec: flag,
		})
	}
	fields.push({ kind: "run", label: "[ Run ]", hint: "", value: "", cursor: 0, required: false })
	return fields
}

function buildContext(
	cmd: Command,
	fields: FieldState[],
	writer: OutputWriter,
	getClient: () => Promise<CamundaClient>,
	getAdminClient: () => Promise<AdminApiClient>,
): RunContext {
	const positional: string[] = []
	const flags: Record<string, string | boolean | number> = {}
	for (const f of fields) {
		if (f.kind === "arg" && f.value) positional.push(f.value)
		if (f.kind === "flag" && f.value && f.flagSpec) {
			const { name, type } = f.flagSpec
			if (type === "boolean") {
				flags[name] = f.value === "true" || f.value === "yes" || f.value === "1"
			} else if (type === "number") {
				const n = Number(f.value)
				if (!Number.isNaN(n)) flags[name] = n
			} else {
				flags[name] = f.value
			}
		}
	}
	return { positional, flags, output: writer, getClient, getAdminClient }
}

// ─── Table helpers ────────────────────────────────────────────────────────────

function getCellStr(item: Record<string, unknown>, col: ColumnDef): string {
	let val: unknown = item
	for (const part of col.key.split(".")) {
		val = (val as Record<string, unknown>)?.[part]
	}
	if (col.transform) return col.transform(val)
	if (val === null || val === undefined) return "—"
	if (typeof val === "object") return JSON.stringify(val)
	return String(val)
}

function calcColWidths(
	items: Record<string, unknown>[],
	columns: ColumnDef[],
	available: number,
): number[] {
	const natural = columns.map((col) => {
		let max = col.header.length
		for (const item of items) {
			const len = Math.min(getCellStr(item, col).length, col.maxWidth ?? 999)
			if (len > max) max = len
		}
		return max
	})
	const gap = (columns.length - 1) * 2
	const total = natural.reduce((s, w) => s + w, 0) + gap
	if (total <= available) return natural
	const scale = (available - gap) / natural.reduce((s, w) => s + w, 0)
	return natural.map((w) => Math.max(5, Math.round(w * scale)))
}

/** Sentinel for arrays of objects — displayed as "[N items]", Space to drill down. */
class ArrayValue {
	constructor(public readonly items: unknown[]) {}
	toString() {
		return `[${this.items.length} item${this.items.length !== 1 ? "s" : ""}]`
	}
}

function flattenObj(obj: unknown, prefix = ""): Record<string, unknown> {
	// Top-level array (from drill-down): expand each element with [i] prefix
	if (Array.isArray(obj)) {
		const result: Record<string, unknown> = {}
		for (let i = 0; i < obj.length; i++) {
			const elem = obj[i]
			if (typeof elem === "object" && elem !== null) {
				Object.assign(result, flattenObj(elem, `[${i}]`))
			} else {
				result[`[${i}]`] = elem
			}
		}
		return result
	}
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
				// Arrays of objects: show as collapsed summary; Space to expand
				result[key] = new ArrayValue(v)
			}
		} else if (typeof v === "object" && v !== null) {
			Object.assign(result, flattenObj(v, key))
		} else {
			result[key] = v
		}
	}
	return result
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function termSize(): { cols: number; rows: number } {
	return { cols: process.stdout.columns ?? 80, rows: process.stdout.rows ?? 24 }
}

function renderHeader(crumbs: string[], cols: number): string {
	const title = crumbs.map((c, i) => (i === 0 ? bold(c) : cyan(c))).join(dim(" › "))
	return `\n  ${title}\n  ${dim("─".repeat(cols - 4))}`
}

function renderFieldValue(field: FieldState, width: number, isEditing: boolean): string {
	const v = field.value
	const c = field.cursor
	if (!isEditing) {
		return v ? fit(v, width) : dim("─")
	}
	const start = c >= width ? c - width + 1 : 0
	const segment = v.slice(start, start + width + 1)
	const rel = c - start
	const before = segment.slice(0, rel)
	const ch = segment[rel]
	const after = segment.slice(rel + (ch ? 1 : 0), rel + width)
	return `${before}${ch ? inv(ch) : inv(" ")}${after}`
}

/** Pop the stack all the way back to the main menu (first screen). */
function popToMain(state: TuiState): void {
	if (state.stack.length > 1) state.stack.splice(1)
}

// ─── Screen renderers ─────────────────────────────────────────────────────────

function filterGroups(groups: CommandGroup[], search: string): CommandGroup[] {
	if (!search) return groups
	const q = search.toLowerCase()
	return groups.filter(
		(g) => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q),
	)
}

function filterCommands(cmds: Command[], search: string): Command[] {
	if (!search) return cmds
	const q = search.toLowerCase()
	return cmds.filter(
		(c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
	)
}

function renderMain(state: TuiState, screen: Extract<Screen, { kind: "main" }>): string[] {
	const { cols, rows } = termSize()
	const searching = screen.search.length > 0
	const viewH = Math.max(3, rows - (searching ? 9 : 7))
	const groups = filterGroups(state.groups, screen.search)
	const nameW = state.groups.reduce((m, g) => Math.max(m, g.name.length), 0)

	const lines = [renderHeader(["casen"], cols), ""]

	if (searching) {
		lines.push(`  ${dim("/")} ${screen.search}█\n`)
	}

	const visible = groups.slice(screen.scroll, screen.scroll + viewH)
	for (let vi = 0; vi < visible.length; vi++) {
		const g = visible[vi]
		if (!g) continue
		const i = screen.scroll + vi
		const isCursor = i === screen.cursor
		const name = padEnd(isCursor ? cyan(g.name) : g.name, nameW + 2)
		const desc = dim(fit(g.description, cols - nameW - 8))
		const line = `  ${name}  ${desc}`
		lines.push(isCursor ? inv(line.padEnd(cols - 1)) : line)
	}

	if (groups.length > viewH) {
		const hi = Math.min(screen.scroll + viewH, groups.length)
		lines.push(`\n  ${dim(`${screen.scroll + 1}–${hi} of ${groups.length}`)}`)
	}
	const hint = searching
		? `  ${dim("↑↓")} navigate  ${cyan("enter")} open  ${cyan("esc")} clear  ${dim("bksp")} delete`
		: `  ${dim("↑↓")} navigate  ${cyan("enter")} open  ${dim("type")} search  ${cyan("q")} quit`
	lines.push(`\n${hint}`)
	return lines
}

function renderCommands(state: TuiState, screen: Extract<Screen, { kind: "commands" }>): string[] {
	const { cols, rows } = termSize()
	const searching = screen.search.length > 0
	const viewH = Math.max(3, rows - (searching ? 11 : 9))
	const cmds = filterCommands(screen.group.commands, screen.search)
	const nameW = screen.group.commands.reduce((m, c) => Math.max(m, c.name.length), 0)
	const hasMain = state.stack[0]?.kind === "main"

	const lines = [renderHeader([screen.group.name], cols), `\n  ${dim(screen.group.description)}\n`]

	if (searching) {
		lines.push(`  ${dim("/")} ${screen.search}█\n`)
	}

	for (let i = 0; i < cmds.length; i++) {
		const cmd = cmds[i]
		if (!cmd) continue
		const isCursor = i === screen.cursor
		const name = padEnd(isCursor ? cyan(cmd.name) : cmd.name, nameW + 2)
		const desc = dim(fit(cmd.description, cols - nameW - 8))
		const line = `  ${name}  ${desc}`
		lines.push(isCursor ? inv(line.padEnd(cols - 1)) : line)
	}

	if (searching) {
		lines.push(
			`\n  ${dim("↑↓")} navigate  ${cyan("enter")} select  ${cyan("esc")} clear  ${dim("bksp")} delete`,
		)
	} else {
		const mHint = hasMain ? `  ${cyan("m")} main menu` : ""
		lines.push(
			`\n  ${dim("↑↓")} navigate  ${cyan("enter")} select  ${cyan("esc")} back${mHint}  ${dim("type")} search  ${cyan("q")} quit`,
		)
	}
	return lines
}

function renderInput(state: TuiState, screen: Extract<Screen, { kind: "input" }>): string[] {
	const { cols, rows } = termSize()
	const viewH = Math.max(3, rows - 9)
	const labelW = screen.fields.reduce(
		(m, f) => (f.kind !== "run" ? Math.max(m, f.label.length) : m),
		0,
	)
	const hintW = 26
	const valueW = Math.max(20, cols - labelW - hintW - 10)

	const lines = [
		renderHeader([screen.group.name, screen.cmd.name], cols),
		`\n  ${dim(screen.cmd.description)}\n`,
	]

	const visible = screen.fields.slice(screen.scroll, screen.scroll + viewH)
	for (let vi = 0; vi < visible.length; vi++) {
		const field = visible[vi]
		if (!field) continue
		const fi = screen.scroll + vi
		const isCursor = fi === screen.cursor

		if (field.kind === "run") {
			const btn = isCursor ? inv("  Run  ") : dim("[ Run ]")
			lines.push(`  ${isCursor ? cyan("▶") : " "} ${btn}`)
			continue
		}

		const marker = isCursor ? cyan("▶") : " "
		const label = padEnd(isCursor ? cyan(field.label) : dim(field.label), labelW + 2)
		const value = renderFieldValue(field, valueW, screen.editing && isCursor)
		const req = field.required ? red("*") : " "
		const hint = dim(fit(field.hint, hintW))
		lines.push(`  ${marker} ${label} ${padEnd(value, valueW)}  ${req} ${hint}`)
	}

	lines.push("")
	if (screen.error) {
		lines.push(`  ${red("error:")} ${screen.error}`)
	} else if (screen.running) {
		lines.push(`  ${dim("running…")}`)
	} else if (screen.editing) {
		lines.push(
			`  ${dim("←→")} cursor  ${cyan("ctrl+a/e")} home/end  ${cyan("ctrl+k/u")} clear  ${cyan("enter")} confirm  ${cyan("esc")} cancel`,
		)
	} else {
		lines.push(
			`  ${dim("↑↓")} navigate  ${cyan("enter")} edit/run  ${cyan("m")} main menu  ${cyan("esc")} back  ${cyan("q")} quit`,
		)
	}
	return lines
}

function renderRawView(screen: Extract<Screen, { kind: "results" }>, cols: number): string[] {
	const raw = screen.raw
	if (!raw) return [`  ${dim("(no raw response captured)")}`]
	const lines: string[] = []
	const statusCol = raw.status >= 200 && raw.status < 300 ? green : red
	lines.push(`  ${bold("Status:")}  ${statusCol(`HTTP ${raw.status}`)}`)
	lines.push("")
	lines.push(`  ${bold("Headers:")}`)
	for (const [k, v] of Object.entries(raw.headers)) {
		const kStr = padEnd(cyan(k), 36)
		lines.push(`  ${kStr}  ${fit(v, cols - 42)}`)
	}
	lines.push("")
	lines.push(`  ${bold("Body:")}`)
	let bodyLines: string[]
	try {
		const parsed = JSON.parse(raw.body)
		bodyLines = JSON.stringify(parsed, null, 2).split("\n")
	} catch {
		bodyLines = raw.body.split("\n")
	}
	for (const l of bodyLines) {
		lines.push(`  ${fit(l, cols - 4)}`)
	}
	return lines
}

function renderResults(state: TuiState, screen: Extract<Screen, { kind: "results" }>): string[] {
	const { cols, rows } = termSize()
	const viewH = Math.max(3, rows - 10)
	const out = screen.output
	const lines: string[] = []

	const statusBadge = screen.raw
		? (() => {
				const fn = screen.raw.status >= 200 && screen.raw.status < 300 ? green : red
				return `  ${dim(fn(`HTTP ${screen.raw.status}`))}`
			})()
		: ""
	const rawToggle = `  ${screen.rawView ? cyan("r") : dim("r")} ${dim("raw")}`

	if (screen.rawView) {
		lines.push(renderHeader([screen.group.name, screen.cmd.name], cols))
		lines.push("")
		const rawLines = renderRawView(screen, cols)
		const visible = rawLines.slice(screen.scroll, screen.scroll + rows - 8)
		for (const l of visible) lines.push(l)
		lines.push("")
		if (rawLines.length > rows - 8) {
			const hi = Math.min(screen.scroll + rows - 8, rawLines.length)
			lines.push(`  ${dim(`${screen.scroll + 1}–${hi} of ${rawLines.length}`)}`)
		}
		lines.push(
			`  ${dim("↑↓")} scroll${rawToggle}  ${cyan("m")} main menu  ${cyan("esc")} back  ${cyan("q")} quit`,
		)
		return lines
	}

	if (out.type === "list") {
		lines.push(renderHeader([screen.group.name, screen.cmd.name], cols))
		lines.push(`\n  ${dim(`${out.total} item${out.total !== 1 ? "s" : ""}`)}${statusBadge}\n`)

		const available = cols - 4
		const widths = calcColWidths(out.items, out.columns, available)
		const header = out.columns
			.map((col, i) => padEnd(dim(col.header), widths[i] ?? col.header.length))
			.join("  ")
		lines.push(`  ${header}`)
		lines.push(`  ${dim("─".repeat(available))}`)

		const visible = out.items.slice(screen.scroll, screen.scroll + viewH)
		for (let vi = 0; vi < visible.length; vi++) {
			const item = visible[vi]
			if (!item) continue
			const isCursor = screen.scroll + vi === screen.cursor
			const cells = out.columns.map((col, ci) => {
				const w = widths[ci] ?? 10
				return padEnd(fit(getCellStr(item, col), w), w)
			})
			const line = `  ${cells.join("  ")}`
			lines.push(isCursor ? inv(line.padEnd(cols - 1)) : line)
		}

		lines.push("")
		if (out.total > viewH) {
			const hi = Math.min(screen.scroll + viewH, out.total)
			lines.push(`  ${dim(`${screen.scroll + 1}–${hi} of ${out.total}`)}`)
		}
		const followupHint = screen.cmd.relations ? `  ${cyan("f")} follow-up` : ""
		lines.push(
			`  ${dim("↑↓")} navigate  ${cyan("enter")} detail${followupHint}  ${dim("pgup/pgdn")} page${rawToggle}  ${cyan("m")} main menu  ${cyan("esc")} back  ${cyan("q")} quit`,
		)
	} else if (out.type === "item") {
		lines.push(renderHeader([screen.group.name, screen.cmd.name], cols))
		lines.push(statusBadge ? `\n${statusBadge}` : "")
		const flat = flattenObj(out.data)
		const entries = Object.entries(flat)
		const kw = entries.reduce((m, [k]) => Math.max(m, k.length), 0)
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i]
			if (!entry) continue
			const [k, v] = entry
			const isCursor = i === screen.cursor
			const isArr = v instanceof ArrayValue
			const valueStr = v === null || v === undefined ? dim("—") : String(v)
			const hint = isArr && isCursor ? `  ${dim("[space] expand")}` : ""
			const line = `  ${padEnd(cyan(k), kw + 2)}  ${valueStr}${hint}`
			lines.push(isCursor ? inv(line.padEnd(cols - 1)) : line)
		}
		const spaceHint = entries.some(([, v]) => v instanceof ArrayValue)
			? `  ${cyan("space")} expand array`
			: ""
		lines.push(
			`\n${rawToggle}${spaceHint}  ${cyan("m")} main menu  ${cyan("esc")} back  ${cyan("q")} quit`,
		)
	} else {
		lines.push(renderHeader([screen.group.name, screen.cmd.name], cols))
		lines.push(statusBadge ? `\n${statusBadge}` : "")
		if (out.lines.length === 0) {
			lines.push(`  ${dim("(no output)")}`)
		} else {
			const hOff = screen.cursor
			const visible = out.lines.slice(screen.scroll, screen.scroll + viewH)
			for (const line of visible) {
				lines.push(`  ${fit(line.slice(hOff), cols - 4)}`)
			}
			if (out.lines.length > viewH || hOff > 0) {
				const hi = Math.min(screen.scroll + viewH, out.lines.length)
				const panHint = hOff > 0 ? `  col +${hOff}` : ""
				lines.push(`  ${dim(`${screen.scroll + 1}–${hi} of ${out.lines.length}${panHint}`)}`)
			}
		}
		lines.push(
			`\n  ${dim("↑↓←→")} scroll/pan${rawToggle}  ${cyan("m")} main menu  ${cyan("esc")} back  ${cyan("q")} quit`,
		)
	}
	return lines
}

function renderDetail(state: TuiState, screen: Extract<Screen, { kind: "detail" }>): string[] {
	const { cols, rows } = termSize()
	const viewH = Math.max(3, rows - 7)
	const flat = flattenObj(screen.item)
	const entries = Object.entries(flat)
	const kw = entries.reduce((m, [k]) => Math.max(m, k.length), 0)

	const lines = [renderHeader([screen.group.name, screen.label], cols), ""]
	const visible = entries.slice(screen.scroll, screen.scroll + viewH)
	for (let vi = 0; vi < visible.length; vi++) {
		const entry = visible[vi]
		if (!entry) continue
		const [k, v] = entry
		const isCursor = screen.scroll + vi === screen.cursor
		const isArr = v instanceof ArrayValue
		const valueStr = v === null || v === undefined ? dim("—") : String(v)
		const hint = isArr && isCursor ? `  ${dim("[space] expand")}` : ""
		const line = `  ${padEnd(cyan(k), kw + 2)}  ${valueStr}${hint}`
		lines.push(isCursor ? inv(line.padEnd(cols - 1)) : line)
	}
	lines.push("")
	if (entries.length > viewH) {
		const hi = Math.min(screen.scroll + viewH, entries.length)
		lines.push(`  ${dim(`${screen.scroll + 1}–${hi} of ${entries.length} fields`)}`)
	}
	const spaceHint = entries.some(([, v]) => v instanceof ArrayValue)
		? `  ${cyan("space/→")} expand  ${cyan("←")} back`
		: `  ${cyan("←")} back`
	lines.push(
		`  ${dim("↑↓")} navigate${spaceHint}  ${cyan("m")} main menu  ${cyan("esc")} back  ${cyan("q")} quit`,
	)
	return lines
}

function renderFollowup(state: TuiState, screen: Extract<Screen, { kind: "followup" }>): string[] {
	const { cols, rows } = termSize()
	const viewH = Math.max(3, rows - 8)
	const lines = [renderHeader([screen.sourceGroup.name, "follow-up actions"], cols), ""]

	// Show the fields that will be pre-filled
	const usedFields = new Set<string>()
	for (const rel of screen.relations) {
		for (const p of rel.params) usedFields.add(p.field)
	}
	const summary = [...usedFields]
		.map((f) => `${dim(f)}: ${String(screen.item[f] ?? "")}`)
		.join("   ")
	if (summary) {
		lines.push(`  ${summary}`)
		lines.push("")
	}

	const visible = screen.relations.slice(screen.scroll, screen.scroll + viewH)
	for (let vi = 0; vi < visible.length; vi++) {
		const rel = visible[vi]
		if (!rel) continue
		const isCursor = screen.scroll + vi === screen.cursor
		const gName = padEnd(cyan(rel.group.name), 22)
		const cName = rel.cmd.name.padEnd(26)
		const line = `  ${gName}  ${cName}  ${dim(fit(rel.cmd.description, cols - 56))}`
		lines.push(isCursor ? inv(line.padEnd(cols - 1)) : line)
	}

	lines.push("")
	if (screen.relations.length > viewH) {
		const hi = Math.min(screen.scroll + viewH, screen.relations.length)
		lines.push(`  ${dim(`${screen.scroll + 1}–${hi} of ${screen.relations.length}`)}`)
	}
	lines.push(
		`  ${dim("↑↓")} navigate  ${cyan("enter")} run pre-filled  ${cyan("esc")} back  ${cyan("q")} quit`,
	)
	return lines
}

function render(state: TuiState): void {
	if (state.quitting) return
	const screen = state.stack[state.stack.length - 1]
	if (!screen) return
	let lines: string[]
	switch (screen.kind) {
		case "main":
			lines = renderMain(state, screen)
			break
		case "commands":
			lines = renderCommands(state, screen)
			break
		case "input":
			lines = renderInput(state, screen)
			break
		case "results":
			lines = renderResults(state, screen)
			break
		case "detail":
			lines = renderDetail(state, screen)
			break
		case "followup":
			lines = renderFollowup(state, screen)
			break
	}
	process.stdout.write(`${CLEAR}${lines.join("\n")}\n`)
}

// ─── Key handlers ─────────────────────────────────────────────────────────────

function handleMainKey(
	key: string,
	screen: Extract<Screen, { kind: "main" }>,
	state: TuiState,
	done: () => void,
): void {
	const { rows } = termSize()
	const searching = screen.search.length > 0
	const viewH = Math.max(3, rows - (searching ? 9 : 7))
	const groups = filterGroups(state.groups, screen.search)

	// Backspace removes last search char
	if (key === "\x7f" || key === "\x08") {
		screen.search = screen.search.slice(0, -1)
		screen.cursor = 0
		screen.scroll = 0
		render(state)
		return
	}

	// ESC clears search; quits only when search is already empty
	if (key === "\x1b") {
		if (searching) {
			screen.search = ""
			screen.cursor = 0
			screen.scroll = 0
		} else {
			done()
			return
		}
		render(state)
		return
	}

	switch (key) {
		case "\x1b[A": // up
			if (screen.cursor > 0) {
				screen.cursor--
				if (screen.cursor < screen.scroll) screen.scroll--
			}
			break
		case "\x1b[B": // down
			if (screen.cursor < groups.length - 1) {
				screen.cursor++
				if (screen.cursor >= screen.scroll + viewH) screen.scroll++
			}
			break
		case "\x1b[5~": // page up
			screen.cursor = Math.max(0, screen.cursor - viewH)
			screen.scroll = Math.max(0, screen.scroll - viewH)
			break
		case "\x1b[6~": // page down
			screen.cursor = Math.min(groups.length - 1, screen.cursor + viewH)
			screen.scroll = Math.min(Math.max(0, groups.length - viewH), screen.scroll + viewH)
			break
		case "\r":
		case "\n": {
			const group = groups[screen.cursor]
			if (group) state.stack.push({ kind: "commands", group, cursor: 0, search: "" })
			break
		}
		default:
			// Any printable char starts/extends search; q/Q only quit when not searching
			if (key === "q" || key === "Q") {
				if (!searching) {
					done()
					return
				}
			}
			if (key.length === 1 && key >= " ") {
				screen.search += key
				screen.cursor = 0
				screen.scroll = 0
			}
	}
	render(state)
}

function handleCommandsKey(
	key: string,
	screen: Extract<Screen, { kind: "commands" }>,
	state: TuiState,
	done: () => void,
): void {
	const searching = screen.search.length > 0
	const cmds = filterCommands(screen.group.commands, screen.search)

	// Backspace removes last search char
	if (key === "\x7f" || key === "\x08") {
		screen.search = screen.search.slice(0, -1)
		screen.cursor = 0
		render(state)
		return
	}

	// ESC clears search; goes back when search already empty
	if (key === "\x1b") {
		if (searching) {
			screen.search = ""
			screen.cursor = 0
		} else {
			state.stack.pop()
		}
		render(state)
		return
	}

	switch (key) {
		case "\x1b[A":
			if (screen.cursor > 0) screen.cursor--
			break
		case "\x1b[B":
			if (screen.cursor < cmds.length - 1) screen.cursor++
			break
		case "\r":
		case "\n": {
			const cmd = cmds[screen.cursor]
			if (cmd) {
				state.stack.push({
					kind: "input",
					group: screen.group,
					cmd,
					fields: buildFields(cmd),
					cursor: 0,
					scroll: 0,
					editing: false,
					error: "",
					running: false,
				})
			}
			break
		}
		default:
			if (key === "q" || key === "Q") {
				if (!searching) {
					done()
					return
				}
			}
			if (key === "m" || key === "M") {
				if (!searching) {
					popToMain(state)
					break
				}
			}
			if (key.length === 1 && key >= " ") {
				screen.search += key
				screen.cursor = 0
			}
	}
	render(state)
}

async function executeCommand(
	screen: Extract<Screen, { kind: "input" }>,
	state: TuiState,
): Promise<void> {
	for (const f of screen.fields) {
		if (f.required && !f.value) {
			screen.error = `"${f.label}" is required`
			return
		}
	}
	screen.running = true
	screen.error = ""
	render(state)

	const { writer, get } = makeCapturingWriter()
	// Wrap client factories to capture the last raw HTTP response
	let rawCapture: RawResponseEvent | null = null
	const getClient = async () => {
		const client = await state.getClient()
		client.on("rawResponse", (evt) => {
			rawCapture = evt
		})
		return client
	}
	const getAdminClient = async () => {
		const client = await state.getAdminClient()
		client.on("rawResponse", (evt) => {
			rawCapture = evt
		})
		return client
	}
	const ctx = buildContext(screen.cmd, screen.fields, writer, getClient, getAdminClient)
	try {
		await screen.cmd.run(ctx)
		state.stack.push({
			kind: "results",
			group: screen.group,
			cmd: screen.cmd,
			output: get(),
			raw: rawCapture,
			rawView: false,
			cursor: 0,
			scroll: 0,
		})
	} catch (err) {
		screen.error = err instanceof Error ? err.message : String(err)
	} finally {
		screen.running = false
	}
}

async function handleInputKey(
	key: string,
	screen: Extract<Screen, { kind: "input" }>,
	state: TuiState,
	done: () => void,
): Promise<void> {
	const { rows } = termSize()
	const viewH = Math.max(3, rows - 9)
	const field = screen.fields[screen.cursor]

	// ── Edit mode ────────────────────────────────────────────────────────────
	if (screen.editing && field && field.kind !== "run") {
		switch (key) {
			case "\r":
			case "\n":
				screen.editing = false
				if (screen.cursor < screen.fields.length - 1) {
					screen.cursor++
					if (screen.cursor >= screen.scroll + viewH) screen.scroll++
				}
				break
			case "\x1b":
				screen.editing = false
				break
			case "\x1b[D": // left
				if (field.cursor > 0) field.cursor--
				break
			case "\x1b[C": // right
				if (field.cursor < field.value.length) field.cursor++
				break
			case "\x7f": // backspace
				if (field.cursor > 0) {
					field.value = field.value.slice(0, field.cursor - 1) + field.value.slice(field.cursor)
					field.cursor--
				}
				break
			case "\x1b[3~": // delete
				field.value = field.value.slice(0, field.cursor) + field.value.slice(field.cursor + 1)
				break
			case "\x01": // Ctrl+A / Home
			case "\x1b[H":
				field.cursor = 0
				break
			case "\x05": // Ctrl+E / End
			case "\x1b[F":
				field.cursor = field.value.length
				break
			case "\x0b": // Ctrl+K — clear to end
				field.value = field.value.slice(0, field.cursor)
				break
			case "\x15": // Ctrl+U — clear line
				field.value = ""
				field.cursor = 0
				break
			default: {
				// Filter printable chars to support both single keypresses and pasted text
				const printable = [...key].filter((ch) => ch >= " ").join("")
				if (printable) {
					field.value =
						field.value.slice(0, field.cursor) + printable + field.value.slice(field.cursor)
					field.cursor += printable.length
				}
			}
		}
		render(state)
		return
	}

	// ── Navigation mode ───────────────────────────────────────────────────────
	switch (key) {
		case "\x1b[A": // up
			if (screen.cursor > 0) {
				screen.cursor--
				if (screen.cursor < screen.scroll) screen.scroll--
			}
			break
		case "\x1b[B": // down
			if (screen.cursor < screen.fields.length - 1) {
				screen.cursor++
				if (screen.cursor >= screen.scroll + viewH) screen.scroll++
			}
			break
		case "\r":
		case "\n":
			if (!field) break
			if (field.kind === "run") {
				await executeCommand(screen, state)
			} else {
				screen.editing = true
				field.cursor = field.value.length
			}
			break
		case "m":
		case "M":
			popToMain(state)
			break
		case "\x1b":
			state.stack.pop()
			break
		case "q":
		case "Q":
			done()
			return
	}
	render(state)
}

function handleResultsKey(
	key: string,
	screen: Extract<Screen, { kind: "results" }>,
	state: TuiState,
	done: () => void,
): void {
	const { rows } = termSize()
	const viewH = Math.max(3, rows - 10)

	// r/R toggles raw view regardless of output type
	if (key === "r" || key === "R") {
		screen.rawView = !screen.rawView
		screen.scroll = 0
		render(state)
		return
	}

	if (screen.rawView) {
		switch (key) {
			case "\x1b[A":
				if (screen.scroll > 0) screen.scroll--
				break
			case "\x1b[B":
				screen.scroll++
				break
			case "m":
			case "M":
				popToMain(state)
				break
			case "\x1b":
				state.stack.pop()
				break
			case "q":
			case "Q":
				done()
				return
		}
		render(state)
		return
	}

	if (screen.output.type !== "list") {
		if (screen.output.type === "item") {
			const entries = Object.entries(flattenObj(screen.output.data))
			const expandArray = () => {
				const entry = entries[screen.cursor]
				if (entry) {
					const [fieldKey, v] = entry
					if (v instanceof ArrayValue) {
						state.stack.push({
							kind: "detail",
							group: screen.group,
							item: v.items,
							label: `${fieldKey} (${v.items.length})`,
							cursor: 0,
							scroll: 0,
						})
					}
				}
			}
			if (key === "\x1b[A" && screen.cursor > 0) screen.cursor--
			else if (key === "\x1b[B" && screen.cursor < entries.length - 1) screen.cursor++
			else if (key === " " || key === "\x1b[C") expandArray()
			else if (key === "\x1b[D") state.stack.pop()
			else if (key === "\x1b") state.stack.pop()
			else if (key === "m" || key === "M") popToMain(state)
			else if (key === "q" || key === "Q") {
				done()
				return
			}
		} else {
			// messages type — scrollable + horizontal pan (screen.cursor = hOff)
			switch (key) {
				case "\x1b[A":
					if (screen.scroll > 0) screen.scroll--
					break
				case "\x1b[B":
					screen.scroll = Math.min(
						Math.max(0, screen.output.lines.length - viewH),
						screen.scroll + 1,
					)
					break
				case "\x1b[C":
					screen.cursor++
					break
				case "\x1b[D":
					screen.cursor = Math.max(0, screen.cursor - 1)
					break
				case "\x1b[5~":
					screen.scroll = Math.max(0, screen.scroll - viewH)
					break
				case "\x1b[6~":
					screen.scroll = Math.min(
						Math.max(0, screen.output.lines.length - viewH),
						screen.scroll + viewH,
					)
					break
				default:
					if (key === "\x1b") state.stack.pop()
					else if (key === "m" || key === "M") popToMain(state)
					else if (key === "q" || key === "Q") {
						done()
						return
					}
			}
		}
		render(state)
		return
	}

	const len = screen.output.items.length
	switch (key) {
		case "\x1b[A": // up
			if (screen.cursor > 0) {
				screen.cursor--
				if (screen.cursor < screen.scroll) screen.scroll--
			}
			break
		case "\x1b[B": // down
			if (screen.cursor < len - 1) {
				screen.cursor++
				if (screen.cursor >= screen.scroll + viewH) screen.scroll++
			}
			break
		case "\x1b[5~": // page up
			screen.cursor = Math.max(0, screen.cursor - viewH)
			screen.scroll = Math.max(0, screen.scroll - viewH)
			break
		case "\x1b[6~": // page down
			screen.cursor = Math.min(len - 1, screen.cursor + viewH)
			screen.scroll = Math.min(Math.max(0, len - viewH), screen.scroll + viewH)
			break
		case "\r":
		case "\n": {
			const item = screen.output.items[screen.cursor]
			if (item) {
				state.stack.push({
					kind: "detail",
					group: screen.group,
					item,
					label: "detail",
					cursor: 0,
					scroll: 0,
				})
			}
			break
		}
		case "f":
		case "F": {
			const item = screen.output.items[screen.cursor]
			if (item && screen.cmd.relations) {
				const resolved: Array<{
					group: CommandGroup
					cmd: Command
					params: Array<{ field: string; param: string }>
				}> = []
				for (const rel of screen.cmd.relations) {
					const tGroup = state.groups.find((g) => g.name === rel.groupName)
					if (!tGroup) continue
					const tCmd = tGroup.commands.find((c) => c.name === rel.commandName)
					if (!tCmd) continue
					resolved.push({ group: tGroup, cmd: tCmd, params: rel.params })
				}
				if (resolved.length > 0) {
					state.stack.push({
						kind: "followup",
						sourceGroup: screen.group,
						item: item as Record<string, unknown>,
						relations: resolved,
						cursor: 0,
						scroll: 0,
					})
				}
			}
			break
		}
		case "m":
		case "M":
			popToMain(state)
			break
		case "\x1b":
			state.stack.pop()
			break
		case "q":
		case "Q":
			done()
			return
	}
	render(state)
}

function handleDetailKey(
	key: string,
	screen: Extract<Screen, { kind: "detail" }>,
	state: TuiState,
	done: () => void,
): void {
	const { rows } = termSize()
	const viewH = Math.max(3, rows - 7)
	const entries = Object.entries(flattenObj(screen.item))
	const entryCount = entries.length

	switch (key) {
		case "\x1b[A":
			if (screen.cursor > 0) {
				screen.cursor--
				if (screen.cursor < screen.scroll) screen.scroll--
			}
			break
		case "\x1b[B":
			if (screen.cursor < entryCount - 1) {
				screen.cursor++
				if (screen.cursor >= screen.scroll + viewH) screen.scroll++
			}
			break
		case "\x1b[5~":
			screen.cursor = Math.max(0, screen.cursor - viewH)
			screen.scroll = Math.max(0, screen.scroll - viewH)
			break
		case "\x1b[6~":
			screen.cursor = Math.min(entryCount - 1, screen.cursor + viewH)
			screen.scroll = Math.min(Math.max(0, entryCount - viewH), screen.scroll + viewH)
			break
		case " ":
		case "\x1b[C": {
			const entry = entries[screen.cursor]
			if (entry) {
				const [fieldKey, v] = entry
				if (v instanceof ArrayValue) {
					state.stack.push({
						kind: "detail",
						group: screen.group,
						item: v.items,
						label: `${fieldKey} (${v.items.length})`,
						cursor: 0,
						scroll: 0,
					})
				}
			}
			break
		}
		case "\x1b[D":
			state.stack.pop()
			break
		case "m":
		case "M":
			popToMain(state)
			break
		case "\x1b":
			state.stack.pop()
			break
		case "q":
		case "Q":
			done()
			return
	}
	render(state)
}

function handleFollowupKey(
	key: string,
	screen: Extract<Screen, { kind: "followup" }>,
	state: TuiState,
	done: () => void,
): void {
	const { rows } = termSize()
	const viewH = Math.max(3, rows - 8)

	switch (key) {
		case "\x1b[A":
			if (screen.cursor > 0) {
				screen.cursor--
				if (screen.cursor < screen.scroll) screen.scroll--
			}
			break
		case "\x1b[B":
			if (screen.cursor < screen.relations.length - 1) {
				screen.cursor++
				if (screen.cursor >= screen.scroll + viewH) screen.scroll++
			}
			break
		case "\r":
		case "\n": {
			const rel = screen.relations[screen.cursor]
			if (rel) {
				const fields = buildFields(rel.cmd)
				// Pre-fill args from the source item
				for (const p of rel.params) {
					const val = String(screen.item[p.field] ?? "")
					const field = fields.find((f) => f.kind === "arg" && f.label === p.param)
					if (field) {
						field.value = val
						field.cursor = val.length
					}
				}
				const allFilled = fields.filter((f) => f.required).every((f) => f.value)
				const runIdx = fields.findIndex((f) => f.kind === "run")
				state.stack.push({
					kind: "input",
					group: rel.group,
					cmd: rel.cmd,
					fields,
					cursor: allFilled && runIdx >= 0 ? runIdx : 0,
					scroll: 0,
					editing: false,
					error: "",
					running: false,
				})
			}
			break
		}
		case "m":
		case "M":
			popToMain(state)
			break
		case "\x1b":
			state.stack.pop()
			break
		case "q":
		case "Q":
			done()
			return
	}
	render(state)
}

async function handleKey(key: string, state: TuiState, done: () => void): Promise<void> {
	if (state.quitting) return
	if (key === "\x03") {
		done()
		return
	}
	const screen = state.stack[state.stack.length - 1]
	if (!screen) return
	switch (screen.kind) {
		case "main":
			handleMainKey(key, screen, state, done)
			break
		case "commands":
			handleCommandsKey(key, screen, state, done)
			break
		case "input":
			await handleInputKey(key, screen, state, done)
			break
		case "results":
			handleResultsKey(key, screen, state, done)
			break
		case "detail":
			handleDetailKey(key, screen, state, done)
			break
		case "followup":
			handleFollowupKey(key, screen, state, done)
			break
	}
}

// ─── Shared TUI runner ────────────────────────────────────────────────────────

async function startTui(state: TuiState): Promise<void> {
	if (!process.stdout.isTTY || !process.stdin.isTTY) {
		// Non-interactive fallback: print group list or group commands
		const first = state.stack[0]
		if (first?.kind === "commands") {
			process.stdout.write(`${first.group.name}: ${first.group.description}\n`)
			process.stdout.write(`Commands: ${first.group.commands.map((c) => c.name).join(", ")}\n`)
		} else {
			for (const g of state.groups) {
				process.stdout.write(`${g.name.padEnd(24)} ${g.description}\n`)
			}
		}
		return
	}

	process.stdout.write(`${ALT_ON}${HIDE}`)
	let cleaned = false
	const cleanup = () => {
		if (cleaned) return
		cleaned = true
		process.stdout.write(`${ALT_OFF}${SHOW}`)
		if (process.stdin.isTTY) process.stdin.setRawMode(false)
		process.stdin.pause()
	}
	process.on("exit", cleanup)
	render(state)

	await new Promise<void>((resolve) => {
		const done = () => {
			state.quitting = true
			resolve()
		}
		process.stdin.setRawMode(true)
		process.stdin.resume()
		process.stdin.setEncoding("utf8")
		let handling = false
		process.stdin.on("data", async (key: string) => {
			if (handling || state.quitting) return
			handling = true
			try {
				await handleKey(key, state, done)
			} finally {
				handling = false
			}
		})
	})

	cleanup()
	process.removeListener("exit", cleanup)
}

// ─── Public entry points ──────────────────────────────────────────────────────

/** Open the TUI at the top-level main menu listing all command groups. */
export async function runMainTui(
	groups: CommandGroup[],
	getClient: () => Promise<CamundaClient>,
	getAdminClient?: () => Promise<AdminApiClient>,
): Promise<void> {
	return startTui({
		groups,
		stack: [{ kind: "main", cursor: 0, scroll: 0, search: "" }],
		getClient,
		getAdminClient: getAdminClient ?? (() => Promise.reject(new Error("No admin client"))),
		quitting: false,
	})
}

/**
 * Open the TUI directly at a specific group's command list.
 * The main menu is placed at the bottom of the stack so `m` always works.
 */
export async function runGroupTui(
	group: CommandGroup,
	groups: CommandGroup[],
	getClient: () => Promise<CamundaClient>,
	getAdminClient?: () => Promise<AdminApiClient>,
): Promise<void> {
	const cursor = groups.findIndex((g) => g.name === group.name)
	return startTui({
		groups,
		stack: [
			{ kind: "main", cursor: Math.max(0, cursor), scroll: 0, search: "" },
			{ kind: "commands", group, cursor: 0, search: "" },
		],
		getClient,
		getAdminClient: getAdminClient ?? (() => Promise.reject(new Error("No admin client"))),
		quitting: false,
	})
}
