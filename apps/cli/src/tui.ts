import { spawn } from "node:child_process"
import type { AdminApiClient, CamundaClient, RawResponseEvent } from "@bpmnkit/api"
import { renderBpmnAscii } from "@bpmnkit/ascii"
import { appendAuditEntry, getAuditLog, getSettings, saveSettings } from "@bpmnkit/profiles"
import { type AskResult, runAskQuery } from "./commands/ask.js"
import { type NpmSearchObject, pluginGroup, searchNpmRegistry } from "./commands/plugin.js"
import { profileGroup } from "./commands/profile.js"
import { readInstalledPlugins } from "./plugin-loader.js"
import type {
	ArgSpec,
	ColumnDef,
	Command,
	CommandGroup,
	FlagSpec,
	JsonFieldSpec,
	OutputWriter,
	Relation,
	RunContext,
	WorkerJobResult,
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
	argSpec?: ArgSpec
}

type CapturedOutput =
	| { type: "list"; items: Record<string, unknown>[]; columns: ColumnDef[]; total: number }
	| { type: "item"; data: unknown }
	| { type: "messages"; lines: string[]; altLines?: string[] }

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
			curlView: boolean
			altView: boolean
			cursor: number
			scroll: number
	  }
	| {
			kind: "detail"
			group: CommandGroup
			cmd?: Command
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
	| {
			kind: "ask"
			query: string
			cursor: number
			status: "idle" | "running"
			statusMsg: string
			error: string
			_timer: ReturnType<typeof setInterval> | null
	  }
	| { kind: "profile"; scroll: number }
	| { kind: "settings"; cursor: number; editing: boolean; editValue: string; message: string }
	| { kind: "audit-log"; scroll: number }
	| {
			kind: "plugins"
			subview: "menu" | "search" | "results" | "prompt" | "done"
			menuCursor: number
			query: string
			queryCursor: number
			resultKind: "search" | "installed"
			results: Array<{
				name: string
				version: string
				description: string
				publisher: string
				score: string
				installedAt: string
			}>
			resultCursor: number
			resultScroll: number
			promptLabel: string
			promptValue: string
			promptCursor: number
			promptAction: "install" | "remove" | "update"
			message: string
			error: string
			running: boolean
	  }
	| {
			kind: "worker"
			group: CommandGroup
			cmd: Command
			jobType: string
			status: "starting" | "running" | "stopping" | "stopped"
			stats: { activated: number; completed: number; failed: number }
			log: Array<{ ts: string; level: "info" | "ok" | "err"; text: string }>
			scroll: number
			autoScroll: boolean
			_stop: (() => void) | null
			_timer: ReturnType<typeof setInterval> | null
	  }
	| {
			kind: "json-editor"
			group: CommandGroup
			cmd: Command
			/** Index into the parent input screen's fields array. */
			fieldIndex: number
			fieldLabel: string
			entries: Array<{ key: string; keyCursor: number; val: string; valCursor: number }>
			/** Known field specs from the OpenAPI schema — drives guided editing. */
			fieldSpecs?: JsonFieldSpec[]
			/** Row cursor (0..entries.length-1 = entry rows; entries.length = "add" row). */
			cursor: number
			/** Active column within the current row. */
			col: "key" | "val"
			editing: boolean
			scroll: number
			error: string
	  }

interface TuiState {
	/** All command groups — shown in the main menu. */
	groups: CommandGroup[]
	stack: Screen[]
	getClient: () => Promise<CamundaClient>
	getAdminClient: () => Promise<AdminApiClient>
	quitting: boolean
	/** Active profile name for display in the header. */
	profile: string
	/** Profile fields with secrets redacted — shown in the profile view. */
	profileInfo: Array<{ key: string; value: string }>
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
		const defaultVal = arg.default ?? ""
		fields.push({
			kind: "arg",
			label: arg.name,
			hint: arg.required ? "required" : "optional",
			value: defaultVal,
			cursor: defaultVal.length,
			required: arg.required ?? false,
			argSpec: arg,
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

// ─── Field type helpers ────────────────────────────────────────────────────────

function getEnum(field: FieldState): string[] | undefined {
	if (field.kind === "flag") return field.flagSpec?.enum
	if (field.kind === "arg") return field.argSpec?.enum
	return undefined
}

function isJsonField(field: FieldState): boolean {
	if (field.kind === "flag") return field.flagSpec?.json === true
	if (field.kind === "arg") return field.argSpec?.json === true
	return false
}

function getPresets(field: FieldState): number[] | undefined {
	if (field.kind === "flag") return field.flagSpec?.presets
	return undefined
}

// ─── JSON editor helpers ───────────────────────────────────────────────────────

type JsonEntry = { key: string; keyCursor: number; val: string; valCursor: number }

function parseJsonToEntries(json: string): JsonEntry[] {
	if (!json.trim()) return []
	try {
		const obj = JSON.parse(json) as Record<string, unknown>
		return Object.entries(obj).map(([key, val]) => ({
			key,
			keyCursor: key.length,
			val: typeof val === "string" ? val : JSON.stringify(val),
			valCursor: 0,
		}))
	} catch {
		return []
	}
}

function entriesToJson(entries: JsonEntry[]): string {
	const obj: Record<string, unknown> = {}
	for (const e of entries) {
		if (!e.key) continue
		try {
			obj[e.key] = JSON.parse(e.val)
		} catch {
			obj[e.key] = e.val
		}
	}
	return Object.keys(obj).length === 0 ? "" : JSON.stringify(obj)
}

/**
 * Build initial entries for the JSON editor.
 * If fieldSpecs are provided, pre-populate with all known fields (in spec order),
 * merging in any existing values. Extra keys from existing JSON are appended at the end.
 */
function buildInitialEntries(existingJson: string, fieldSpecs?: JsonFieldSpec[]): JsonEntry[] {
	const existing: Record<string, string> = {}
	if (existingJson.trim()) {
		try {
			const obj = JSON.parse(existingJson) as Record<string, unknown>
			for (const [k, v] of Object.entries(obj)) {
				existing[k] = typeof v === "string" ? v : JSON.stringify(v)
			}
		} catch {
			// ignore malformed JSON
		}
	}

	if (!fieldSpecs || fieldSpecs.length === 0) return parseJsonToEntries(existingJson)

	const seenKeys = new Set<string>()
	const entries: JsonEntry[] = []

	for (const spec of fieldSpecs) {
		seenKeys.add(spec.name)
		const val = existing[spec.name] ?? ""
		entries.push({ key: spec.name, keyCursor: spec.name.length, val, valCursor: val.length })
	}
	// Append extra keys not in the spec
	for (const [k, v] of Object.entries(existing)) {
		if (!seenKeys.has(k)) {
			entries.push({ key: k, keyCursor: k.length, val: v, valCursor: v.length })
		}
	}

	return entries
}

/** Look up a JsonFieldSpec by key name. */
function getFieldSpec(key: string, fieldSpecs?: JsonFieldSpec[]): JsonFieldSpec | undefined {
	return fieldSpecs?.find((s) => s.name === key)
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

function renderHeader(crumbs: string[], cols: number, profile?: string): string {
	const title = crumbs.map((c, i) => (i === 0 ? bold(c) : cyan(c))).join(dim(" › "))
	const profileStr = profile ? dim(`  profile: ${profile}`) : ""
	const titleLen = crumbs.join(" › ").length + 2
	const profileLen = profile ? `  profile: ${profile}`.length : 0
	const pad = Math.max(0, cols - 4 - titleLen - profileLen)
	const header = profileStr ? `  ${title}${" ".repeat(pad)}${profileStr}` : `  ${title}`
	return `\n${header}\n  ${dim("─".repeat(cols - 4))}`
}

function renderText(value: string, cursorPos: number, width: number, isEditing: boolean): string {
	if (!isEditing) return value ? fit(value, width) : dim("─")
	const v = value
	const c = cursorPos
	const start = c >= width ? c - width + 1 : 0
	const segment = v.slice(start, start + width + 1)
	const rel = c - start
	const before = segment.slice(0, rel)
	const ch = segment[rel]
	const after = segment.slice(rel + (ch ? 1 : 0), rel + width)
	return `${before}${ch ? inv(ch) : inv(" ")}${after}`
}

function renderFieldValue(field: FieldState, width: number, isEditing: boolean): string {
	return renderText(field.value, field.cursor, width, isEditing)
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

	const lines = [renderHeader(["casen"], cols, state.profile), ""]

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
		// Separator after pinned section (after "worker", before plugins or api groups)
		if (!searching && g.name === "worker" && i < groups.length - 1) {
			lines.push(`  ${dim("─".repeat(cols - 4))}`)
		}
		// Separator after the last plugin group (before api groups), only when plugins exist
		if (!searching && g._plugin && !groups[i + 1]?._plugin && i < groups.length - 1) {
			lines.push(`  ${dim("─".repeat(cols - 4))}`)
		}
	}

	if (groups.length > viewH) {
		const hi = Math.min(screen.scroll + viewH, groups.length)
		lines.push(`\n  ${dim(`${screen.scroll + 1}–${hi} of ${groups.length}`)}`)
	}
	const hint = searching
		? `  ${dim("↑↓")} navigate  ${cyan("enter")} open  ${cyan("esc")} clear  ${dim("bksp")} delete  ${cyan("^C")} quit`
		: `  ${dim("↑↓")} navigate  ${cyan("enter")} open  ${dim("type")} search  ${cyan("^C")} quit`
	lines.push(`\n${hint}`)
	return lines
}

const ASK_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
let askSpinnerFrame = 0

function renderAsk(state: TuiState, screen: Extract<Screen, { kind: "ask" }>): string[] {
	const { cols } = termSize()
	const lines = [
		renderHeader(["casen", "ask"], cols, state.profile),
		`\n  ${dim("Natural language search using a local AI (claude/copilot/gemini)")}\n`,
	]

	const inputLine = `  > ${renderText(screen.query, screen.cursor, cols - 6, true)}`
	lines.push(inputLine)
	lines.push("")

	if (screen.status === "running" && screen.statusMsg) {
		const frame = ASK_SPINNER_FRAMES[askSpinnerFrame % ASK_SPINNER_FRAMES.length] ?? "⠋"
		lines.push(`  ${frame} ${dim(screen.statusMsg)}`)
	} else if (screen.error) {
		lines.push(`  ${red("error:")} ${screen.error}`)
	}

	lines.push("")
	if (screen.status === "running") {
		lines.push(
			`  ${dim("type query")}  ${cyan("enter")} run  ${cyan("esc")} back  ${cyan("^C")} abort`,
		)
	} else {
		lines.push(
			`  ${dim("type query")}  ${cyan("enter")} run  ${cyan("esc")} back  ${cyan("^C")} quit`,
		)
	}
	return lines
}

function renderCommands(state: TuiState, screen: Extract<Screen, { kind: "commands" }>): string[] {
	const { cols, rows } = termSize()
	const searching = screen.search.length > 0
	const viewH = Math.max(3, rows - (searching ? 11 : 9))
	const cmds = filterCommands(screen.group.commands, screen.search)
	const nameW = screen.group.commands.reduce((m, c) => Math.max(m, c.name.length), 0)
	const hasMain = state.stack[0]?.kind === "main"

	const lines = [
		renderHeader([screen.group.name], cols, state.profile),
		`\n  ${dim(screen.group.description)}\n`,
	]

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
			`\n  ${dim("↑↓")} navigate  ${cyan("enter")} select  ${cyan("esc")} back${mHint}  ${dim("type")} search  ${cyan("^C")} quit`,
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
		renderHeader([screen.group.name, screen.cmd.name], cols, state.profile),
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
		const enumVals = getEnum(field)
		const isJson = isJsonField(field)
		const presets = getPresets(field)
		// In edit mode for enum fields, ↑↓ cycle rather than typing
		const isEnumEditing = screen.editing && isCursor && enumVals !== undefined
		const value = isEnumEditing
			? enumVals.includes(field.value)
				? cyan(padEnd(field.value, valueW))
				: padEnd(field.value, valueW)
			: renderFieldValue(field, valueW, screen.editing && isCursor && !isJson)
		const req = field.required ? red("*") : " "
		// Show contextual hint for the focused field
		let hintText = field.hint
		if (isCursor) {
			if (enumVals) {
				const idx = enumVals.indexOf(field.value)
				const pos = idx >= 0 ? `${idx + 1}/${enumVals.length}` : `?/${enumVals.length}`
				hintText = `↑↓ pick  ${pos}`
			} else if (isJson) {
				hintText = "→ json editor"
			} else if (presets) {
				hintText = "↑↓ preset"
			}
		}
		const hint = isCursor ? cyan(fit(hintText, hintW)) : dim(fit(hintText, hintW))
		lines.push(`  ${marker} ${label} ${padEnd(value, valueW)}  ${req} ${hint}`)
	}

	lines.push("")
	if (screen.error) {
		lines.push(`  ${red("error:")} ${screen.error}`)
	} else if (screen.running) {
		lines.push(`  ${dim("running…")}`)
	} else if (screen.editing) {
		const curField = screen.fields[screen.cursor]
		const curEnum = curField ? getEnum(curField) : undefined
		const curPresets = curField ? getPresets(curField) : undefined
		if (curEnum) {
			lines.push(
				`  ${dim("↑↓")} cycle  ${cyan("enter")} confirm  ${cyan("esc")} cancel  ${dim(curEnum.join(" | "))}`,
			)
		} else if (curPresets) {
			lines.push(
				`  ${dim("←→")} cursor  ${cyan("↑↓")} presets  ${cyan("enter")} confirm  ${cyan("esc")} cancel`,
			)
		} else {
			lines.push(
				`  ${dim("←→")} cursor  ${cyan("ctrl+a/e")} home/end  ${cyan("ctrl+k/u")} clear  ${cyan("enter")} confirm  ${cyan("esc")} cancel`,
			)
		}
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

// ─── Curl view ────────────────────────────────────────────────────────────────

const CURL_TOKEN_VAR = "CAMUNDA_TOKEN"

function buildCurlCmd(raw: RawResponseEvent): { cmd: string; token: string | null } {
	const parts: string[] = [`curl -X ${raw.method}`]
	let token: string | null = null
	for (const [k, v] of Object.entries(raw.requestHeaders)) {
		let val = v
		if (k.toLowerCase() === "authorization") {
			const m = /^Bearer (.+)$/.exec(v)
			if (m) {
				token = m[1] ?? null
				val = `Bearer $${CURL_TOKEN_VAR}`
			}
		}
		parts.push(`  -H '${k}: ${val}'`)
	}
	if (raw.requestBody) {
		parts.push(`  -d '${raw.requestBody.replace(/'/g, "'\\''")}'`)
	}
	parts.push(`  '${raw.url}'`)
	return { cmd: parts.join(" \\\n"), token }
}

function copyToClipboard(text: string): void {
	const cmds: string[][] =
		process.platform === "darwin"
			? [["pbcopy"]]
			: process.platform === "win32"
				? [["clip"]]
				: [["wl-copy"], ["xclip", "-selection", "clipboard"], ["xsel", "--clipboard", "--input"]]
	const tryNext = (i: number): void => {
		const entry = cmds[i]
		if (!entry) return
		const [bin, ...args] = entry
		if (!bin) {
			tryNext(i + 1)
			return
		}
		try {
			const proc = spawn(bin, args, { stdio: ["pipe", "ignore", "ignore"] })
			proc.on("error", () => tryNext(i + 1))
			proc.stdin.write(text)
			proc.stdin.end()
			proc.unref()
		} catch {
			tryNext(i + 1)
		}
	}
	tryNext(0)
}

function renderCurlView(screen: Extract<Screen, { kind: "results" }>, cols: number): string[] {
	const raw = screen.raw
	if (!raw) return [`  ${dim("(no raw response captured)")}`]
	const { cmd, token } = buildCurlCmd(raw)
	const lines: string[] = []
	lines.push(`  ${bold("curl command:")}`)
	lines.push("")
	for (const l of cmd.split("\n")) {
		lines.push(`  ${fit(l, cols - 4)}`)
	}
	if (token) {
		lines.push("")
		lines.push(
			`  ${dim(`Token obfuscated as $${CURL_TOKEN_VAR}. Press ${bold("e")} to copy export statement.`)}`,
		)
	}
	lines.push("")
	lines.push(`  ${dim(`Press ${bold("y")} to copy curl command to clipboard.`)}`)
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
	const curlToggle = screen.raw ? `  ${screen.curlView ? cyan("u") : dim("u")} ${dim("curl")}` : ""

	if (screen.curlView) {
		lines.push(renderHeader([screen.group.name, screen.cmd.name], cols, state.profile))
		lines.push("")
		const curlLines = renderCurlView(screen, cols)
		const visible = curlLines.slice(screen.scroll, screen.scroll + rows - 8)
		for (const l of visible) lines.push(l)
		lines.push("")
		if (curlLines.length > rows - 8) {
			const hi = Math.min(screen.scroll + rows - 8, curlLines.length)
			lines.push(`  ${dim(`${screen.scroll + 1}–${hi} of ${curlLines.length}`)}`)
		}
		lines.push(
			`  ${dim("↑↓")} scroll${rawToggle}${curlToggle}  ${cyan("y")} copy curl  ${cyan("e")} copy export  ${cyan("m")} main menu  ${cyan("esc")} back  ${cyan("q")} quit`,
		)
		return lines
	}

	if (screen.rawView) {
		lines.push(renderHeader([screen.group.name, screen.cmd.name], cols, state.profile))
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
			`  ${dim("↑↓")} scroll${rawToggle}${curlToggle}  ${cyan("m")} main menu  ${cyan("esc")} back  ${cyan("q")} quit`,
		)
		return lines
	}

	if (out.type === "list") {
		lines.push(renderHeader([screen.group.name, screen.cmd.name], cols, state.profile))
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
			`  ${dim("↑↓")} navigate  ${cyan("enter")} detail${followupHint}  ${dim("pgup/pgdn")} page${rawToggle}${curlToggle}  ${cyan("m")} main menu  ${cyan("esc")} back  ${cyan("q")} quit`,
		)
	} else if (out.type === "item") {
		lines.push(renderHeader([screen.group.name, screen.cmd.name], cols, state.profile))
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
			? `  ${cyan("space")} expand`
			: ""
		const fHint = screen.cmd.relations ? `  ${cyan("f")} follow-up` : ""
		lines.push(
			`\n  ${dim("↑↓")} navigate  ${cyan("enter")} navigate field${spaceHint}${fHint}${rawToggle}${curlToggle}  ${cyan("m")} main  ${cyan("esc")} back  ${cyan("q")} quit`,
		)
	} else {
		lines.push(renderHeader([screen.group.name, screen.cmd.name], cols, state.profile))
		lines.push(statusBadge ? `\n${statusBadge}` : "")
		const displayLines = screen.altView && out.altLines ? out.altLines : out.lines
		const altToggle = out.altLines
			? `  ${screen.altView ? cyan("x") : dim("x")} ${dim("ascii")}`
			: ""
		if (displayLines.length === 0) {
			lines.push(`  ${dim("(no output)")}`)
		} else {
			const hOff = screen.altView ? 0 : screen.cursor
			const visible = displayLines.slice(screen.scroll, screen.scroll + viewH)
			for (const line of visible) {
				lines.push(`  ${fit(line.slice(hOff), cols - 4)}`)
			}
			if (displayLines.length > viewH || hOff > 0) {
				const hi = Math.min(screen.scroll + viewH, displayLines.length)
				const panHint = hOff > 0 ? `  col +${hOff}` : ""
				lines.push(`  ${dim(`${screen.scroll + 1}–${hi} of ${displayLines.length}${panHint}`)}`)
			}
		}
		lines.push(
			`\n  ${dim("↑↓←→")} scroll/pan${rawToggle}${curlToggle}${altToggle}  ${cyan("m")} main menu  ${cyan("esc")} back  ${cyan("q")} quit`,
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

	const lines = [renderHeader([screen.group.name, screen.label], cols, state.profile), ""]
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
	const fHint = screen.cmd?.relations ? `  ${cyan("f")} follow-up` : ""
	lines.push(
		`  ${dim("↑↓")} navigate  ${cyan("enter")} navigate field${spaceHint}${fHint}  ${cyan("m")} main  ${cyan("esc")} back  ${cyan("q")} quit`,
	)
	return lines
}

function renderFollowup(state: TuiState, screen: Extract<Screen, { kind: "followup" }>): string[] {
	const { cols, rows } = termSize()
	const viewH = Math.max(3, rows - 8)
	const lines = [
		renderHeader([screen.sourceGroup.name, "follow-up actions"], cols, state.profile),
		"",
	]

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

function renderProfile(state: TuiState, screen: Extract<Screen, { kind: "profile" }>): string[] {
	const { cols, rows } = termSize()
	const viewH = Math.max(3, rows - 7)
	const kw = state.profileInfo.reduce((m, { key }) => Math.max(m, key.length), 0)

	const lines = [renderHeader(["profile"], cols, state.profile), ""]
	const visible = state.profileInfo.slice(screen.scroll, screen.scroll + viewH)
	for (const { key, value } of visible) {
		lines.push(`  ${padEnd(cyan(key), kw + 2)}  ${value}`)
	}
	lines.push("")
	if (state.profileInfo.length > viewH) {
		const hi = Math.min(screen.scroll + viewH, state.profileInfo.length)
		lines.push(`  ${dim(`${screen.scroll + 1}–${hi} of ${state.profileInfo.length}`)}`)
	}
	lines.push(`  ${dim("↑↓")} scroll  ${cyan("esc")} close  ${cyan("q")} quit`)
	return lines
}

// ─── Settings screen ──────────────────────────────────────────────────────────

type SettingsRow =
	| {
			kind: "number"
			key: "auditLogSize"
			label: string
			description: string
			min: number
			max: number
	  }
	| { kind: "action"; id: "show-audit-log"; label: string; description: string }
	| {
			kind: "nav"
			id: "active-profile" | "profiles" | "plugins"
			label: string
			description: string
	  }

const SETTINGS_ROWS: SettingsRow[] = [
	{
		kind: "number",
		key: "auditLogSize",
		label: "Audit Log Size",
		description: "Number of actions to keep per profile  (0 = disabled)",
		min: 0,
		max: 1000,
	},
	{
		kind: "action",
		id: "show-audit-log",
		label: "Show Audit Log",
		description: "View recent commands executed for the active profile",
	},
	{
		kind: "nav",
		id: "active-profile",
		label: "Active Profile",
		description: "View details for the current connection profile",
	},
	{
		kind: "nav",
		id: "profiles",
		label: "Profiles",
		description: "Manage and switch connection profiles",
	},
	{
		kind: "nav",
		id: "plugins",
		label: "Plugins",
		description: "Browse and manage CLI plugins",
	},
]

function renderSettings(state: TuiState, screen: Extract<Screen, { kind: "settings" }>): string[] {
	const { cols } = termSize()
	const settings = getSettings()
	const labelW = SETTINGS_ROWS.reduce((m, r) => Math.max(m, r.label.length), 0) + 2

	const lines = [renderHeader(["settings"], cols, state.profile), ""]

	for (let i = 0; i < SETTINGS_ROWS.length; i++) {
		const row = SETTINGS_ROWS[i]
		if (!row) continue
		const isCursor = i === screen.cursor

		let valueStr: string
		if (row.kind === "number") {
			valueStr =
				screen.editing && isCursor
					? cyan(`[${screen.editValue}_]`)
					: bold(String(settings[row.key]))
		} else {
			valueStr = dim("→")
		}

		const labelPart = padEnd(isCursor ? cyan(row.label) : row.label, labelW)
		const content = `  ${labelPart}  ${valueStr}`
		lines.push(isCursor ? inv(content.padEnd(cols - 1)) : content)
	}

	const row = SETTINGS_ROWS[screen.cursor]
	if (row) {
		lines.push("")
		lines.push(`  ${dim(row.description)}`)
	}

	lines.push("")
	if (screen.message) {
		lines.push(`  ${screen.message}`)
	} else if (screen.editing) {
		lines.push(
			`  ${dim("type")} new value  ${cyan("enter")} save  ${cyan("esc")} cancel  ${dim("bksp")} delete`,
		)
	} else {
		lines.push(
			`  ${dim("↑↓")} navigate  ${cyan("enter")} select  ${cyan("esc")} back  ${cyan("q")} quit`,
		)
	}
	return lines
}

// ─── Audit log screen ─────────────────────────────────────────────────────────

function renderAuditLog(state: TuiState, screen: Extract<Screen, { kind: "audit-log" }>): string[] {
	const { cols, rows } = termSize()
	const viewH = Math.max(3, rows - 8)
	const entries = getAuditLog(state.profile || undefined)

	const lines = [renderHeader(["settings", "audit log"], cols, state.profile), ""]

	if (entries.length === 0) {
		lines.push(`  ${dim(`No audit log entries for profile "${state.profile || "default"}".`)}`)
	} else {
		const tsW = 19
		const stW = 5
		const cmdW = Math.max(20, cols - tsW - stW - 8)
		lines.push(
			`  ${dim(padEnd("TIME", tsW + 2))}  ${dim(padEnd("COMMAND", cmdW))}  ${dim("STATUS")}`,
		)
		lines.push(`  ${dim("─".repeat(cols - 4))}`)

		const visible = entries.slice(screen.scroll, screen.scroll + viewH)
		for (const e of visible) {
			const ts = dim(e.timestamp.replace("T", " ").slice(0, tsW))
			const cmd = fit(
				`${e.group} ${e.command}${e.positional.length ? ` ${e.positional.join(" ")}` : ""}`,
				cmdW,
			)
			const status = e.status === "ok" ? green("ok") : red("err")
			lines.push(`  ${ts}  ${padEnd(cmd, cmdW)}  ${status}`)
		}

		if (entries.length > viewH) {
			const hi = Math.min(screen.scroll + viewH, entries.length)
			lines.push(`\n  ${dim(`${screen.scroll + 1}–${hi} of ${entries.length}`)}`)
		}
	}

	lines.push(`\n  ${dim("↑↓")} scroll  ${cyan("esc")} back  ${cyan("q")} quit`)
	return lines
}

function renderWorker(state: TuiState, screen: Extract<Screen, { kind: "worker" }>): string[] {
	const { cols, rows } = termSize()
	const viewH = Math.max(3, rows - 13)

	const statusStr =
		screen.status === "running"
			? green("● RUNNING")
			: screen.status === "starting"
				? dim("◌ STARTING")
				: screen.status === "stopping"
					? cyan("◌ STOPPING")
					: dim("■ STOPPED")

	const lines = [renderHeader(["worker"], cols, state.profile), ""]

	lines.push(
		`  ${padEnd(dim("type"), 8)}  ${cyan(screen.jobType)}    ${dim("status")}  ${statusStr}`,
	)
	lines.push(`  ${dim("─".repeat(cols - 4))}`)
	const { activated, completed, failed } = screen.stats
	lines.push(
		`  ${dim("activated")}  ${bold(String(activated))}    ${dim("completed")}  ${completed > 0 ? green(String(completed)) : dim("0")}    ${dim("failed")}  ${failed > 0 ? red(String(failed)) : dim("0")}`,
	)
	lines.push(`  ${dim("─".repeat(cols - 4))}`)
	lines.push("")

	if (screen.log.length === 0) {
		lines.push(`  ${dim("Waiting for jobs…")}`)
	} else {
		const logLines = screen.log.map((e) => {
			const ts = dim(e.ts)
			const msg =
				e.level === "ok"
					? `${green("✓")} ${e.text}`
					: e.level === "err"
						? `${red("✗")} ${e.text}`
						: `  ${dim(e.text)}`
			return `  ${ts}  ${msg}`
		})
		const visible = logLines.slice(screen.scroll, screen.scroll + viewH)
		for (const l of visible) lines.push(fit(l, cols - 2))
		if (screen.log.length > viewH) {
			const hi = Math.min(screen.scroll + viewH, screen.log.length)
			lines.push(`  ${dim(`${screen.scroll + 1}–${hi} of ${screen.log.length}`)}`)
		}
	}

	const isRunning = screen.status === "running" || screen.status === "starting"
	const autoHint = `  ${screen.autoScroll ? cyan("a") : dim("a")} ${dim("auto")}`
	const navHint = isRunning
		? `  ${cyan("s")} ${dim("stop")}`
		: `  ${cyan("esc")} back  ${cyan("m")} main menu`
	lines.push(`\n  ${dim("↑↓")} scroll${autoHint}${navHint}  ${cyan("q")} quit`)
	return lines
}

function renderJsonEditor(
	state: TuiState,
	screen: Extract<Screen, { kind: "json-editor" }>,
): string[] {
	const { cols, rows } = termSize()
	// Reserve extra row for field hint line
	const viewH = Math.max(3, rows - 10)
	const keyW = Math.max(14, Math.min(28, Math.floor((cols - 12) * 0.38)))
	const valW = Math.max(16, cols - keyW - 12)

	const lines = [
		renderHeader(
			[screen.group.name, screen.cmd.name, `--${screen.fieldLabel}`],
			cols,
			state.profile,
		),
		"",
	]
	lines.push(`  ${padEnd(dim("KEY"), keyW + 4)}${dim("VALUE")}`)
	lines.push(`  ${dim("─".repeat(cols - 4))}`)

	// entries + add-row
	const rowCount = screen.entries.length + 1
	const visible = Math.min(viewH, rowCount)
	for (let vi = 0; vi < visible; vi++) {
		const absIdx = screen.scroll + vi
		const isCursor = absIdx === screen.cursor
		const marker = isCursor ? cyan("▶") : " "

		if (absIdx === screen.entries.length) {
			// "add" row
			const label = `${isCursor ? cyan("+ add field") : dim("+ add field")}`
			lines.push(isCursor ? inv(`  ${marker} ${label}`.padEnd(cols - 1)) : `  ${marker} ${label}`)
			continue
		}

		const entry = screen.entries[absIdx]
		if (!entry) continue

		const spec = getFieldSpec(entry.key, screen.fieldSpecs)
		const isKnown = spec !== undefined
		const hasEnum = spec?.enum && spec.enum.length > 0

		const editKey = isCursor && screen.col === "key" && screen.editing
		const editVal = isCursor && screen.col === "val" && screen.editing
		const keyStr = renderText(entry.key, entry.keyCursor, keyW - (isKnown ? 0 : 0), editKey)

		// For known enum fields in nav mode, show cycling hint instead of raw value
		const valDisplay =
			!editVal && hasEnum && entry.val
				? `${entry.val} ${dim("↑↓")}`
				: !editVal && hasEnum && !entry.val
					? dim("<pick ↑↓>")
					: renderText(entry.val, entry.valCursor, valW - 4, editVal)
		const valStr = valDisplay

		const keyPart =
			isCursor && screen.col === "key" && !editKey
				? cyan(padEnd(keyStr, keyW))
				: isKnown
					? padEnd(keyStr, keyW)
					: dim(padEnd(keyStr, keyW))
		const valPart =
			isCursor && screen.col === "val" && !editVal
				? cyan(padEnd(valStr, valW))
				: padEnd(valStr, valW)

		const line = `  ${marker} ${keyPart}  ${valPart}`
		lines.push(isCursor && !screen.editing ? inv(line.padEnd(cols - 1)) : line)
	}

	lines.push("")

	// Field hint line: show description/type for the row under the cursor
	const cursorEntry = screen.entries[screen.cursor]
	const cursorSpec = cursorEntry ? getFieldSpec(cursorEntry.key, screen.fieldSpecs) : undefined
	if (cursorSpec) {
		const req = cursorSpec.required ? red("required") : dim("optional")
		const typeStr = cursorSpec.enum
			? `enum(${cursorSpec.enum.slice(0, 3).join("|")}${cursorSpec.enum.length > 3 ? "…" : ""})`
			: cursorSpec.type
		const desc = cursorSpec.description ? ` — ${fit(cursorSpec.description, 40)}` : ""
		lines.push(`  ${dim(typeStr)} ${req}${desc}`)
	} else {
		lines.push("")
	}

	if (rowCount > viewH) {
		const hi = Math.min(screen.scroll + viewH, rowCount)
		lines.push(`  ${dim(`${screen.scroll + 1}–${hi} of ${rowCount}`)}`)
	}
	if (screen.error) {
		lines.push(`  ${red("error:")} ${screen.error}`)
	} else if (screen.editing) {
		const cursorEntryEditing = screen.entries[screen.cursor]
		const editSpec =
			screen.col === "val" && cursorEntryEditing
				? getFieldSpec(cursorEntryEditing.key, screen.fieldSpecs)
				: undefined
		const editHint = editSpec?.enum
			? `${dim("↑↓")} pick value  ${cyan("enter")} confirm  ${cyan("esc")} cancel`
			: `${dim("←→")} cursor  ${cyan("tab")} switch col  ${cyan("enter")} confirm  ${cyan("esc")} cancel`
		lines.push(`  ${editHint}`)
	} else {
		lines.push(
			`  ${dim("↑↓")} navigate  ${cyan("tab")} switch col  ${cyan("enter")} edit  ${cyan("a")} add  ${cyan("d")} del  ${cyan("esc")} save  ${cyan("q")} quit`,
		)
	}
	return lines
}

// ─── Worker view helpers ──────────────────────────────────────────────────────

function workerLogH(): number {
	return Math.max(3, (process.stdout.rows ?? 24) - 13)
}

function addWorkerLog(
	ws: Extract<Screen, { kind: "worker" }>,
	level: "info" | "ok" | "err",
	text: string,
): void {
	const now = new Date()
	const ts = [now.getHours(), now.getMinutes(), now.getSeconds()]
		.map((n) => String(n).padStart(2, "0"))
		.join(":")
	ws.log.push({ ts, level, text })
	if (ws.log.length > 500) ws.log.shift()
	if (ws.autoScroll) ws.scroll = Math.max(0, ws.log.length - workerLogH())
}

function stopWorkerScreen(ws: Extract<Screen, { kind: "worker" }>): void {
	if (ws._timer !== null) {
		clearInterval(ws._timer)
		ws._timer = null
	}
	if (ws._stop) {
		ws._stop()
		ws._stop = null
	}
}

async function runWorkerLoop(
	ws: Extract<Screen, { kind: "worker" }>,
	state: TuiState,
	variables: Record<string, unknown>,
	jobTimeout: number,
	maxJobs: number,
): Promise<void> {
	let client: CamundaClient
	try {
		client = await state.getClient()
	} catch (err) {
		addWorkerLog(ws, "err", `Client error: ${err instanceof Error ? err.message : String(err)}`)
		ws.status = "stopped"
		stopWorkerScreen(ws)
		return
	}

	let running = true
	ws._stop = () => {
		running = false
		ws.status = "stopping"
		ws._stop = null
	}
	ws.status = "running"
	addWorkerLog(ws, "info", `Worker started for type "${ws.jobType}"`)
	addWorkerLog(ws, "info", `Returning: ${JSON.stringify(variables)}`)

	while (running) {
		let result: {
			jobs: Array<{
				jobKey: string
				processDefinitionId: string
				elementId: string
				processInstanceKey: string
				variables: Record<string, unknown>
			}>
		}
		try {
			result = (await client.job.activateJobs({
				type: ws.jobType,
				worker: "casen-worker",
				timeout: jobTimeout,
				maxJobsToActivate: maxJobs,
				requestTimeout: 20000,
			})) as typeof result
		} catch (err) {
			if (!running) break
			addWorkerLog(
				ws,
				"err",
				`Poll error: ${err instanceof Error ? err.message : String(err)} — retry in 5s`,
			)
			await new Promise((r) => setTimeout(r, 5000))
			continue
		}

		const jobs = result?.jobs ?? []
		for (const job of jobs) {
			if (!running) break
			ws.stats.activated++
			addWorkerLog(
				ws,
				"info",
				`Activated ${job.jobKey}  process=${job.processDefinitionId}  element=${job.elementId}`,
			)
			let jobResult: WorkerJobResult = { outcome: "complete", variables }
			const processJob = ws.cmd._worker?.processJob
			if (processJob) {
				try {
					jobResult = await processJob(job)
				} catch (err) {
					addWorkerLog(
						ws,
						"err",
						`Handler error: ${err instanceof Error ? err.message : String(err)} — using defaults`,
					)
				}
			}
			try {
				if (jobResult.outcome === "complete") {
					await client.job.completeJob(job.jobKey, { variables: jobResult.variables })
					ws.stats.completed++
					addWorkerLog(ws, "ok", `Completed ${job.jobKey}`)
				} else if (jobResult.outcome === "fail") {
					await client.job.failJob(job.jobKey, {
						errorMessage: jobResult.errorMessage,
						retries: jobResult.retries,
						retryBackOff: jobResult.retryBackOff,
					})
					ws.stats.failed++
					addWorkerLog(ws, "err", `Failed ${job.jobKey}: ${jobResult.errorMessage}`)
				} else {
					await client.job.throwJobError(job.jobKey, {
						errorCode: jobResult.errorCode,
						errorMessage: jobResult.errorMessage,
						variables: jobResult.variables,
					})
					ws.stats.failed++
					addWorkerLog(
						ws,
						"err",
						`Error ${job.jobKey} [${jobResult.errorCode}]: ${jobResult.errorMessage ?? ""}`,
					)
				}
			} catch (err) {
				ws.stats.failed++
				addWorkerLog(
					ws,
					"err",
					`Failed to settle ${job.jobKey}: ${err instanceof Error ? err.message : String(err)}`,
				)
			}
		}
		if (jobs.length > 0) await new Promise((r) => setTimeout(r, 100))
	}

	ws.status = "stopped"
	addWorkerLog(
		ws,
		"info",
		`Stopped. Activated: ${ws.stats.activated}  Completed: ${ws.stats.completed}  Failed: ${ws.stats.failed}`,
	)
	stopWorkerScreen(ws)
}

function launchWorkerView(inputScreen: Extract<Screen, { kind: "input" }>, state: TuiState): void {
	const typeArg = inputScreen.fields.find((f) => f.kind === "arg")
	const jobType = typeArg?.value?.trim() ?? ""
	if (!jobType) {
		inputScreen.error = '"type" is required'
		return
	}

	let variables: Record<string, unknown> = { result: "sample-value" }
	const varField = inputScreen.fields.find((f) => f.label === "--variables")
	if (varField?.value) {
		try {
			const parsed: unknown = JSON.parse(varField.value)
			if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
				variables = parsed as Record<string, unknown>
			}
		} catch {
			// use default
		}
	}
	const timeoutField = inputScreen.fields.find((f) => f.label === "--timeout")
	const workerTimeout = timeoutField?.value ? Number(timeoutField.value) : 30000
	const maxJobsField = inputScreen.fields.find((f) => f.label === "--max-jobs")
	const maxJobs = maxJobsField?.value ? Number(maxJobsField.value) : 32

	const ws: Extract<Screen, { kind: "worker" }> = {
		kind: "worker",
		group: inputScreen.group,
		cmd: inputScreen.cmd,
		jobType,
		status: "starting",
		stats: { activated: 0, completed: 0, failed: 0 },
		log: [],
		scroll: 0,
		autoScroll: true,
		_stop: null,
		_timer: null,
	}

	state.stack.push(ws)
	render(state)

	// Re-render at 200 ms so live updates appear without waiting for key presses
	ws._timer = setInterval(() => {
		if (!state.quitting && state.stack.includes(ws)) {
			render(state)
		} else {
			if (ws._timer !== null) {
				clearInterval(ws._timer)
				ws._timer = null
			}
		}
	}, 200)

	// Fire-and-forget: the loop writes to ws state; the timer re-renders
	runWorkerLoop(ws, state, variables, workerTimeout, maxJobs).catch((err) => {
		addWorkerLog(ws, "err", `Unexpected: ${err instanceof Error ? err.message : String(err)}`)
		ws.status = "stopped"
		stopWorkerScreen(ws)
	})
}

// ─── Ask screen helpers ───────────────────────────────────────────────────────

async function runAskInTui(
	screen: Extract<Screen, { kind: "ask" }>,
	state: TuiState,
): Promise<void> {
	let frame = 0
	screen._timer = setInterval(() => {
		frame++
		askSpinnerFrame = frame
		if (!state.quitting && state.stack.includes(screen)) {
			render(state)
		} else {
			if (screen._timer !== null) {
				clearInterval(screen._timer)
				screen._timer = null
			}
		}
	}, 80)

	let result: AskResult
	try {
		result = await runAskQuery(screen.query, state.getClient, (msg) => {
			screen.statusMsg = msg
		})
	} catch (err) {
		if (screen._timer !== null) {
			clearInterval(screen._timer)
			screen._timer = null
		}
		screen.error = err instanceof Error ? err.message : String(err)
		screen.status = "idle"
		screen.statusMsg = ""
		render(state)
		return
	}

	if (screen._timer !== null) {
		clearInterval(screen._timer)
		screen._timer = null
	}

	const askGrp = state.groups.find((g) => g.name === "ask") ?? {
		name: "ask",
		description: "",
		commands: [],
	}
	const syntheticCmd: Command = {
		name: result.resource,
		description: "AI search results",
		run: async () => {},
		relations: result.relations,
	}

	state.stack.push({
		kind: "results",
		group: askGrp,
		cmd: syntheticCmd,
		output: {
			type: "list",
			items: result.items as Record<string, unknown>[],
			columns: result.columns,
			total: result.total,
		},
		raw: null,
		rawView: false,
		curlView: false,
		altView: false,
		cursor: 0,
		scroll: 0,
	})
	render(state)
}

async function handleAskKey(
	key: string,
	screen: Extract<Screen, { kind: "ask" }>,
	state: TuiState,
	done: () => void,
): Promise<void> {
	// Ctrl+C always quits
	if (key === "\x03") {
		done()
		return
	}

	// ESC: if running do nothing; otherwise pop
	if (key === "\x1b") {
		if (screen.status === "running") {
			render(state)
			return
		}
		if (screen._timer !== null) {
			clearInterval(screen._timer)
			screen._timer = null
		}
		state.stack.pop()
		render(state)
		return
	}

	// Enter: run if not running and has query
	if (key === "\r" || key === "\n") {
		if (screen.status !== "running" && screen.query.trim()) {
			screen.status = "running"
			screen.statusMsg = ""
			screen.error = ""
			render(state)
			runAskInTui(screen, state).catch((err) => {
				if (screen._timer !== null) {
					clearInterval(screen._timer)
					screen._timer = null
				}
				screen.error = err instanceof Error ? err.message : String(err)
				screen.status = "idle"
				render(state)
			})
		}
		return
	}

	// Text editing (only when idle)
	if (screen.status === "running") {
		render(state)
		return
	}

	switch (key) {
		case "\x7f": // backspace
		case "\x08":
			if (screen.cursor > 0) {
				screen.query = screen.query.slice(0, screen.cursor - 1) + screen.query.slice(screen.cursor)
				screen.cursor--
			}
			break
		case "\x01": // Ctrl+A
		case "\x1b[H":
			screen.cursor = 0
			break
		case "\x05": // Ctrl+E
		case "\x1b[F":
			screen.cursor = screen.query.length
			break
		case "\x0b": // Ctrl+K — clear to end
			screen.query = screen.query.slice(0, screen.cursor)
			break
		case "\x15": // Ctrl+U — clear line
			screen.query = ""
			screen.cursor = 0
			break
		case "\x1b[D": // left arrow
			if (screen.cursor > 0) screen.cursor--
			break
		case "\x1b[C": // right arrow
			if (screen.cursor < screen.query.length) screen.cursor++
			break
		default: {
			const printable = [...key].filter((ch) => ch >= " ").join("")
			if (printable) {
				screen.query =
					screen.query.slice(0, screen.cursor) + printable + screen.query.slice(screen.cursor)
				screen.cursor += printable.length
			}
			break
		}
	}
	render(state)
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
		case "ask":
			lines = renderAsk(state, screen)
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
		case "profile":
			lines = renderProfile(state, screen)
			break
		case "settings":
			lines = renderSettings(state, screen)
			break
		case "audit-log":
			lines = renderAuditLog(state, screen)
			break
		case "worker":
			lines = renderWorker(state, screen)
			break
		case "json-editor":
			lines = renderJsonEditor(state, screen)
			break
		case "plugins":
			lines = renderPlugins(state, screen)
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

	// Ctrl+C quits unconditionally
	if (key === "\x03") {
		done()
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
			if (group?.name === "settings") {
				state.stack.push({
					kind: "settings",
					cursor: 0,
					editing: false,
					editValue: "",
					message: "",
				})
			} else if (group?.name === "ask") {
				state.stack.push({
					kind: "ask",
					query: "",
					cursor: 0,
					status: "idle",
					statusMsg: "",
					error: "",
					_timer: null,
				})
			} else if (
				group &&
				group.commands.length === 1 &&
				group.commands[0] &&
				"_worker" in group.commands[0]
			) {
				// Single-command worker group: skip commands list, go straight to input
				const cmd = group.commands[0]
				state.stack.push({
					kind: "input",
					group,
					cmd,
					fields: buildFields(cmd),
					cursor: 0,
					scroll: 0,
					editing: false,
					error: "",
					running: false,
				})
			} else if (group) {
				state.stack.push({ kind: "commands", group, cursor: 0, search: "" })
			}
			break
		}
		default:
			// Any printable char starts/extends search
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

	// Ctrl+C quits unconditionally
	if (key === "\x03") {
		done()
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
			if (key === "m" || key === "M") {
				if (!searching) {
					popToMain(state)
					break
				}
			}
			// Any printable char starts/extends search
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
	const SECRET_FLAG_RE = /secret|password|token/i
	const auditFlags: Record<string, string | boolean | number> = {}
	for (const [k, v] of Object.entries(ctx.flags)) {
		auditFlags[k] = SECRET_FLAG_RE.test(k) ? "***" : v
	}
	try {
		await screen.cmd.run(ctx)
		appendAuditEntry(state.profile || "default", {
			group: screen.group.name,
			command: screen.cmd.name,
			positional: ctx.positional,
			flags: auditFlags,
			status: "ok",
		})
		const output = get()
		// Try to generate ASCII art for BPMN XML output
		if (output.type === "messages" && output.lines.length > 0) {
			const xml = output.lines.join("\n")
			if (xml.includes("<?xml") && (xml.includes("bpmn:") || xml.includes("definitions"))) {
				try {
					const ascii = renderBpmnAscii(xml)
					output.altLines = ascii.split("\n")
				} catch {
					// ASCII rendering failed — no alt view
				}
			}
		}
		state.stack.push({
			kind: "results",
			group: screen.group,
			cmd: screen.cmd,
			output,
			raw: rawCapture,
			rawView: false,
			curlView: false,
			altView: false,
			cursor: 0,
			scroll: 0,
		})
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		appendAuditEntry(state.profile || "default", {
			group: screen.group.name,
			command: screen.cmd.name,
			positional: ctx.positional,
			flags: auditFlags,
			status: "error",
			error: msg,
		})
		screen.error = msg
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
		const enumVals = getEnum(field)
		const presets = getPresets(field)

		// ── Enum field: only cycle, no free text ──────────────────────────────
		if (enumVals) {
			const idx = enumVals.indexOf(field.value)
			switch (key) {
				case "\x1b[A": // up — cycle backward
					field.value = enumVals[idx <= 0 ? enumVals.length - 1 : idx - 1] ?? field.value
					break
				case "\x1b[B": // down — cycle forward
					field.value = enumVals[idx < 0 || idx >= enumVals.length - 1 ? 0 : idx + 1] ?? field.value
					break
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
			}
			render(state)
			return
		}

		// ── Preset number field: ↑↓ cycle presets, free text still works ─────
		if (presets) {
			if (key === "\x1b[A") {
				// up — previous preset (smaller)
				const cur = Number(field.value)
				const prev = [...presets].reverse().find((p) => p < cur) ?? presets[presets.length - 1]
				if (prev !== undefined) {
					field.value = String(prev)
					field.cursor = field.value.length
				}
				render(state)
				return
			}
			if (key === "\x1b[B") {
				// down — next preset (larger)
				const cur = Number(field.value)
				const next = presets.find((p) => p > cur) ?? presets[0]
				if (next !== undefined) {
					field.value = String(next)
					field.cursor = field.value.length
				}
				render(state)
				return
			}
			// Fall through to normal text editing for all other keys
		}

		// ── Normal text editing ───────────────────────────────────────────────
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
				if ("_worker" in screen.cmd) {
					launchWorkerView(screen, state)
				} else {
					await executeCommand(screen, state)
				}
			} else if (isJsonField(field)) {
				// Open the key-value JSON editor
				const jsonFieldSpecs = field.kind === "flag" ? field.flagSpec?.fields : undefined
				state.stack.push({
					kind: "json-editor",
					group: screen.group,
					cmd: screen.cmd,
					fieldIndex: screen.cursor,
					fieldLabel: field.label,
					entries: buildInitialEntries(field.value, jsonFieldSpecs),
					fieldSpecs: jsonFieldSpecs,
					cursor: 0,
					col: "val",
					editing: false,
					scroll: 0,
					error: "",
				})
			} else {
				screen.editing = true
				// For enum fields, set to first value if currently empty
				const enumVals = getEnum(field)
				if (enumVals && !field.value) field.value = enumVals[0] ?? ""
				field.cursor = field.value.length
			}
			break
		case "\x1b[C": // right arrow also opens JSON editor
			if (field && isJsonField(field)) {
				const jsonFieldSpecs2 = field.kind === "flag" ? field.flagSpec?.fields : undefined
				state.stack.push({
					kind: "json-editor",
					group: screen.group,
					cmd: screen.cmd,
					fieldIndex: screen.cursor,
					fieldLabel: field.label,
					entries: buildInitialEntries(field.value, jsonFieldSpecs2),
					fieldSpecs: jsonFieldSpecs2,
					cursor: 0,
					col: "val",
					editing: false,
					scroll: 0,
					error: "",
				})
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

	// r/R toggles raw view; u/U toggles curl view — mutually exclusive
	if (key === "r" || key === "R") {
		screen.rawView = !screen.rawView
		if (screen.rawView) screen.curlView = false
		screen.scroll = 0
		render(state)
		return
	}
	if (key === "u" || key === "U") {
		screen.curlView = !screen.curlView
		if (screen.curlView) screen.rawView = false
		screen.scroll = 0
		render(state)
		return
	}

	if (screen.curlView) {
		if (key === "y" || key === "Y") {
			if (screen.raw) {
				const { cmd } = buildCurlCmd(screen.raw)
				copyToClipboard(cmd)
			}
		} else if (key === "e" || key === "E") {
			if (screen.raw) {
				const { token } = buildCurlCmd(screen.raw)
				if (token) copyToClipboard(`export ${CURL_TOKEN_VAR}="${token}"`)
			}
		} else if (key === "\x1b[A") {
			if (screen.scroll > 0) screen.scroll--
		} else if (key === "\x1b[B") {
			screen.scroll++
		} else if (key === "m" || key === "M") {
			popToMain(state)
		} else if (key === "\x1b") {
			state.stack.pop()
		} else if (key === "q" || key === "Q") {
			done()
			return
		}
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
			else if (key === "\r" || key === "\n") {
				const entry = entries[screen.cursor]
				if (entry) {
					const [fieldKey, v] = entry
					if (v instanceof ArrayValue) {
						expandArray()
					} else {
						const resolved = resolveRelationsForField(fieldKey, screen.cmd.relations, state.groups)
						if (resolved.length > 0) {
							state.stack.push({
								kind: "followup",
								sourceGroup: screen.group,
								item: screen.output.data as Record<string, unknown>,
								relations: resolved,
								cursor: 0,
								scroll: 0,
							})
						}
					}
				}
			} else if (key === "f" || key === "F") {
				const resolved = resolveAllRelations(screen.cmd.relations, state.groups)
				if (resolved.length > 0) {
					state.stack.push({
						kind: "followup",
						sourceGroup: screen.group,
						item: screen.output.data as Record<string, unknown>,
						relations: resolved,
						cursor: 0,
						scroll: 0,
					})
				}
			} else if (key === "\x1b[D") state.stack.pop()
			else if (key === "\x1b") state.stack.pop()
			else if (key === "m" || key === "M") popToMain(state)
			else if (key === "q" || key === "Q") {
				done()
				return
			}
		} else {
			// messages type — scrollable + horizontal pan (screen.cursor = hOff)
			const msgLines =
				screen.altView && screen.output.altLines ? screen.output.altLines : screen.output.lines
			switch (key) {
				case "x":
				case "X":
					if (screen.output.altLines) {
						screen.altView = !screen.altView
						screen.scroll = 0
						screen.cursor = 0
					}
					break
				case "\x1b[A":
					if (screen.scroll > 0) screen.scroll = Math.max(0, screen.scroll - 3)
					break
				case "\x1b[B":
					screen.scroll = Math.min(Math.max(0, msgLines.length - viewH), screen.scroll + 3)
					break
				case "\x1b[C":
					if (!screen.altView) screen.cursor += 3
					break
				case "\x1b[D":
					if (!screen.altView) screen.cursor = Math.max(0, screen.cursor - 3)
					break
				case "\x1b[5~":
					screen.scroll = Math.max(0, screen.scroll - viewH)
					break
				case "\x1b[6~":
					screen.scroll = Math.min(Math.max(0, msgLines.length - viewH), screen.scroll + viewH)
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
					cmd: screen.cmd,
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
			if (item) {
				const resolved = resolveAllRelations(screen.cmd.relations, state.groups)
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

// ─── Relation helpers ─────────────────────────────────────────────────────────

type ResolvedRelation = {
	group: CommandGroup
	cmd: Command
	params: Array<{ field: string; param: string }>
}

function resolveAllRelations(
	relations: Relation[] | undefined,
	groups: CommandGroup[],
): ResolvedRelation[] {
	if (!relations) return []
	const out: ResolvedRelation[] = []
	for (const rel of relations) {
		const tGroup = groups.find((g) => g.name === rel.groupName)
		if (!tGroup) continue
		const tCmd = tGroup.commands.find((c) => c.name === rel.commandName)
		if (!tCmd) continue
		out.push({ group: tGroup, cmd: tCmd, params: rel.params })
	}
	return out
}

function resolveRelationsForField(
	fieldName: string,
	relations: Relation[] | undefined,
	groups: CommandGroup[],
): ResolvedRelation[] {
	const matching = (relations ?? []).filter((rel) => rel.params.some((p) => p.field === fieldName))
	return resolveAllRelations(matching, groups)
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
		case "\r":
		case "\n": {
			const entry = entries[screen.cursor]
			if (entry && typeof screen.item === "object" && screen.item !== null) {
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
				} else {
					const item = screen.item as Record<string, unknown>
					const resolved = resolveRelationsForField(fieldKey, screen.cmd?.relations, state.groups)
					if (resolved.length > 0) {
						state.stack.push({
							kind: "followup",
							sourceGroup: screen.group,
							item,
							relations: resolved,
							cursor: 0,
							scroll: 0,
						})
					}
				}
			}
			break
		}
		case "\x1b[D":
			state.stack.pop()
			break
		case "f":
		case "F": {
			if (typeof screen.item === "object" && screen.item !== null) {
				const item = screen.item as Record<string, unknown>
				const resolved = resolveAllRelations(screen.cmd?.relations, state.groups)
				if (resolved.length > 0) {
					state.stack.push({
						kind: "followup",
						sourceGroup: screen.group,
						item,
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

function saveJsonEditorToField(
	screen: Extract<Screen, { kind: "json-editor" }>,
	state: TuiState,
): void {
	const inputScreen = [...state.stack].reverse().find((s) => s.kind === "input")
	if (inputScreen?.kind === "input") {
		const field = inputScreen.fields[screen.fieldIndex]
		if (field) {
			field.value = entriesToJson(screen.entries)
			field.cursor = field.value.length
		}
	}
}

function handleJsonEditorKey(
	key: string,
	screen: Extract<Screen, { kind: "json-editor" }>,
	state: TuiState,
	done: () => void,
): void {
	const { rows } = termSize()
	const viewH = Math.max(3, rows - 9)
	const rowCount = screen.entries.length + 1
	const isAddRow = screen.cursor === screen.entries.length
	const entry = screen.entries[screen.cursor]

	// ── Edit mode ────────────────────────────────────────────────────────────
	if (screen.editing && entry) {
		const activeIsKey = screen.col === "key"
		const activeText = activeIsKey ? entry.key : entry.val
		const activeCursor = activeIsKey ? entry.keyCursor : entry.valCursor
		const setTextAndCursor = (text: string, cur: number) => {
			if (activeIsKey) {
				entry.key = text
				entry.keyCursor = cur
			} else {
				entry.val = text
				entry.valCursor = cur
			}
		}

		// Enum cycling for value column of a known enum field
		const valSpec = !activeIsKey ? getFieldSpec(entry.key, screen.fieldSpecs) : undefined
		const enumVals = valSpec?.enum
		if (enumVals && enumVals.length > 0 && !activeIsKey) {
			const curIdx = enumVals.indexOf(entry.val)
			switch (key) {
				case "\x1b[A": // up
					entry.val = enumVals[(curIdx - 1 + enumVals.length) % enumVals.length] ?? ""
					entry.valCursor = entry.val.length
					render(state)
					return
				case "\x1b[B": // down
					entry.val = enumVals[(curIdx + 1) % enumVals.length] ?? ""
					entry.valCursor = entry.val.length
					render(state)
					return
				case "\r":
				case "\n":
					// If no value selected yet, pick first
					if (!entry.val && enumVals[0]) {
						entry.val = enumVals[0]
						entry.valCursor = entry.val.length
					}
					screen.editing = false
					screen.col = "key"
					if (screen.cursor < rowCount - 1) {
						screen.cursor++
						if (screen.cursor >= screen.scroll + viewH) screen.scroll++
					}
					render(state)
					return
				case "\x1b":
					screen.editing = false
					render(state)
					return
				case "\t":
					screen.col = "key"
					render(state)
					return
			}
		}

		switch (key) {
			case "\r":
			case "\n":
				screen.editing = false
				// Advance: key → val, then val → next row key
				if (activeIsKey) {
					screen.col = "val"
				} else {
					screen.col = "key"
					if (screen.cursor < rowCount - 1) {
						screen.cursor++
						if (screen.cursor >= screen.scroll + viewH) screen.scroll++
					}
				}
				break
			case "\t": // Tab: switch key↔val
				screen.col = activeIsKey ? "val" : "key"
				break
			case "\x1b":
				screen.editing = false
				break
			case "\x1b[D":
				if (activeCursor > 0) setTextAndCursor(activeText, activeCursor - 1)
				break
			case "\x1b[C":
				if (activeCursor < activeText.length) setTextAndCursor(activeText, activeCursor + 1)
				break
			case "\x7f":
				if (activeCursor > 0) {
					setTextAndCursor(
						activeText.slice(0, activeCursor - 1) + activeText.slice(activeCursor),
						activeCursor - 1,
					)
				}
				break
			case "\x01":
			case "\x1b[H":
				setTextAndCursor(activeText, 0)
				break
			case "\x05":
			case "\x1b[F":
				setTextAndCursor(activeText, activeText.length)
				break
			case "\x15":
				setTextAndCursor("", 0)
				break
			default: {
				const printable = [...key].filter((ch) => ch >= " ").join("")
				if (printable) {
					setTextAndCursor(
						activeText.slice(0, activeCursor) + printable + activeText.slice(activeCursor),
						activeCursor + printable.length,
					)
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
			if (screen.cursor < rowCount - 1) {
				screen.cursor++
				if (screen.cursor >= screen.scroll + viewH) screen.scroll++
			}
			break
		case "\t": // Tab: switch key↔val (not on add-row)
			if (!isAddRow) screen.col = screen.col === "key" ? "val" : "key"
			break
		case "\r":
		case "\n":
			if (isAddRow) {
				// Add a new entry and start editing its key
				screen.entries.push({ key: "", keyCursor: 0, val: "", valCursor: 0 })
				screen.cursor = screen.entries.length - 1
				screen.col = "key"
				screen.editing = true
			} else {
				// For known enum fields in val column, seed with first enum value
				if (screen.col === "val" && entry) {
					const spec = getFieldSpec(entry.key, screen.fieldSpecs)
					if (spec?.enum && spec.enum.length > 0 && !entry.val) {
						entry.val = spec.enum[0] ?? ""
						entry.valCursor = entry.val.length
					}
				}
				screen.editing = true
			}
			break
		case "a":
		case "A":
			// Insert new entry after cursor and start editing
			screen.entries.splice(screen.cursor + 1, 0, {
				key: "",
				keyCursor: 0,
				val: "",
				valCursor: 0,
			})
			screen.cursor = Math.min(screen.cursor + 1, screen.entries.length - 1)
			screen.col = "key"
			screen.editing = true
			break
		case "d":
		case "D":
			if (!isAddRow && screen.entries.length > 0) {
				screen.entries.splice(screen.cursor, 1)
				screen.cursor = Math.min(screen.cursor, screen.entries.length)
			}
			break
		case "\x1b":
			saveJsonEditorToField(screen, state)
			state.stack.pop()
			break
		case "q":
		case "Q":
			saveJsonEditorToField(screen, state)
			done()
			return
	}
	render(state)
}

function handleProfileKey(
	key: string,
	screen: Extract<Screen, { kind: "profile" }>,
	state: TuiState,
	done: () => void,
): void {
	const { rows } = termSize()
	const viewH = Math.max(3, rows - 7)
	switch (key) {
		case "\x1b[A":
			if (screen.scroll > 0) screen.scroll--
			break
		case "\x1b[B":
			if (screen.scroll < Math.max(0, state.profileInfo.length - viewH)) screen.scroll++
			break
		case "p":
		case "P":
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

function handleSettingsKey(
	key: string,
	screen: Extract<Screen, { kind: "settings" }>,
	state: TuiState,
	done: () => void,
): void {
	screen.message = ""

	if (screen.editing) {
		if (key === "\r" || key === "\n") {
			const row = SETTINGS_ROWS[screen.cursor]
			if (row?.kind === "number") {
				const n = Number(screen.editValue)
				if (!Number.isNaN(n) && n >= row.min && n <= row.max) {
					saveSettings({ [row.key]: Math.floor(n) })
					screen.message = green(`✓ Saved: ${row.label} = ${Math.floor(n)}`)
				} else {
					screen.message = red(`Invalid — must be a number between ${row.min} and ${row.max}`)
				}
			}
			screen.editing = false
			screen.editValue = ""
		} else if (key === "\x1b") {
			screen.editing = false
			screen.editValue = ""
		} else if (key === "\x7f" || key === "\x08") {
			screen.editValue = screen.editValue.slice(0, -1)
		} else if (key >= "0" && key <= "9") {
			screen.editValue += key
		}
		render(state)
		return
	}

	switch (key) {
		case "\x1b[A":
			if (screen.cursor > 0) screen.cursor--
			break
		case "\x1b[B":
			if (screen.cursor < SETTINGS_ROWS.length - 1) screen.cursor++
			break
		case "\r":
		case "\n": {
			const row = SETTINGS_ROWS[screen.cursor]
			if (row?.kind === "number") {
				screen.editing = true
				screen.editValue = String(getSettings()[row.key])
			} else if (row?.kind === "action" && row.id === "show-audit-log") {
				state.stack.push({ kind: "audit-log", scroll: 0 })
			} else if (row?.kind === "nav" && row.id === "active-profile") {
				state.stack.push({ kind: "profile", scroll: 0 })
			} else if (row?.kind === "nav" && row.id === "profiles") {
				state.stack.push({ kind: "commands", group: profileGroup, cursor: 0, search: "" })
			} else if (row?.kind === "nav" && row.id === "plugins") {
				state.stack.push(newPluginsScreen())
			}
			break
		}
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

function handleAuditLogKey(
	key: string,
	screen: Extract<Screen, { kind: "audit-log" }>,
	state: TuiState,
	done: () => void,
): void {
	const { rows } = termSize()
	const viewH = Math.max(3, rows - 8)
	const total = getAuditLog(state.profile || undefined).length

	switch (key) {
		case "\x1b[A":
			if (screen.scroll > 0) screen.scroll--
			break
		case "\x1b[B":
			if (screen.scroll < Math.max(0, total - viewH)) screen.scroll++
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

function handleWorkerKey(
	key: string,
	screen: Extract<Screen, { kind: "worker" }>,
	state: TuiState,
	done: () => void,
): void {
	const { rows } = termSize()
	const viewH = Math.max(3, rows - 13)
	const isRunning = screen.status === "running" || screen.status === "starting"

	switch (key) {
		case "\x1b[A": // up
			screen.autoScroll = false
			if (screen.scroll > 0) screen.scroll--
			break
		case "\x1b[B": // down
			if (screen.scroll < Math.max(0, screen.log.length - viewH)) {
				screen.scroll++
				if (screen.scroll >= screen.log.length - viewH) screen.autoScroll = true
			}
			break
		case "\x1b[5~": // page up
			screen.autoScroll = false
			screen.scroll = Math.max(0, screen.scroll - viewH)
			break
		case "\x1b[6~": // page down
			screen.scroll = Math.min(Math.max(0, screen.log.length - viewH), screen.scroll + viewH)
			break
		case "a":
		case "A":
			screen.autoScroll = !screen.autoScroll
			if (screen.autoScroll) screen.scroll = Math.max(0, screen.log.length - viewH)
			break
		case "s":
		case "S":
			if (isRunning && screen._stop) screen._stop()
			break
		case "\x1b": // esc — only go back when stopped
			if (!isRunning) {
				stopWorkerScreen(screen)
				state.stack.pop()
			}
			break
		case "m":
		case "M":
			if (!isRunning) {
				stopWorkerScreen(screen)
				popToMain(state)
			}
			break
		case "q":
		case "Q":
			if (isRunning && screen._stop) screen._stop()
			stopWorkerScreen(screen)
			done()
			return
	}
	render(state)
}

// ─── Plugins screen ───────────────────────────────────────────────────────────

const PLUGIN_MENU = [
	{ id: "search", label: "search", description: "Search the npm registry for plugins" },
	{ id: "list", label: "list", description: "Show installed plugins" },
	{ id: "install", label: "install", description: "Install a plugin from npm or local path" },
	{
		id: "update",
		label: "update",
		description: "Update installed plugins to their latest versions",
	},
	{ id: "remove", label: "remove", description: "Remove a plugin" },
] as const

function newPluginsScreen(): Extract<Screen, { kind: "plugins" }> {
	return {
		kind: "plugins",
		subview: "menu",
		menuCursor: 0,
		query: "",
		queryCursor: 0,
		resultKind: "search",
		results: [],
		resultCursor: 0,
		resultScroll: 0,
		promptLabel: "",
		promptValue: "",
		promptCursor: 0,
		promptAction: "install",
		message: "",
		error: "",
		running: false,
	}
}

function renderPlugins(state: TuiState, screen: Extract<Screen, { kind: "plugins" }>): string[] {
	const { cols, rows } = termSize()

	if (screen.subview === "menu") {
		const nameW = PLUGIN_MENU.reduce((m, item) => Math.max(m, item.label.length), 0) + 2
		const lines = [renderHeader(["settings", "plugins"], cols, state.profile), ""]
		for (let i = 0; i < PLUGIN_MENU.length; i++) {
			const item = PLUGIN_MENU[i]
			if (!item) continue
			const isCursor = i === screen.menuCursor
			const name = padEnd(isCursor ? cyan(item.label) : item.label, nameW)
			const desc = dim(fit(item.description, cols - nameW - 6))
			const line = `  ${name}  ${desc}`
			lines.push(isCursor ? inv(line.padEnd(cols - 1)) : line)
		}
		lines.push("")
		lines.push(
			`  ${dim("↑↓")} navigate  ${cyan("enter")} open  ${cyan("esc")} back  ${cyan("q")} quit`,
		)
		return lines
	}

	if (screen.subview === "search") {
		const lines = [renderHeader(["settings", "plugins", "search"], cols, state.profile), ""]
		lines.push(`  ${dim("Search the npm registry — leave empty to browse all plugins")}`)
		lines.push("")
		lines.push(`  > ${renderText(screen.query, screen.queryCursor, cols - 6, true)}`)
		if (screen.running) {
			lines.push("")
			lines.push(`  ${dim("Searching…")}`)
		} else if (screen.error) {
			lines.push("")
			lines.push(`  ${red("error:")} ${screen.error}`)
		}
		lines.push("")
		lines.push(
			`  ${dim("type query")}  ${cyan("enter")} search  ${cyan("esc")} back  ${cyan("^C")} quit`,
		)
		return lines
	}

	if (screen.subview === "results") {
		const viewH = Math.max(3, rows - 10)
		const isSearch = screen.resultKind === "search"
		const title = isSearch ? "search results" : "installed"
		const lines = [renderHeader(["settings", "plugins", title], cols, state.profile), ""]
		if (screen.results.length === 0) {
			lines.push(`  ${dim(isSearch ? "No plugins found." : "No plugins installed.")}`)
		} else {
			const nameW =
				Math.min(
					32,
					screen.results.reduce((m, r) => Math.max(m, r.name.length), 0),
				) + 2
			// Official badge shown for @bpmnkit/* packages (2 visible chars: "◆ ")
			const BADGE = `${cyan("◆")} `
			const BADGE_W = 2
			const visible = screen.results.slice(screen.resultScroll, screen.resultScroll + viewH)
			for (let vi = 0; vi < visible.length; vi++) {
				const r = visible[vi]
				if (!r) continue
				const ri = screen.resultScroll + vi
				const isCursor = ri === screen.resultCursor
				const isOfficial = r.name.startsWith("@bpmnkit/")
				const badge = isOfficial ? BADGE : " ".repeat(BADGE_W)
				const name = padEnd(isCursor ? cyan(r.name) : r.name, nameW)
				const verStr = r.version.padEnd(10)
				const extra = isSearch
					? dim(fit(r.description, cols - nameW - BADGE_W - 14))
					: dim(r.installedAt.slice(0, 10))
				const line = `  ${badge}${name}  ${verStr}  ${extra}`
				lines.push(isCursor ? inv(line.padEnd(cols - 1)) : line)
			}
		}
		if (screen.message) {
			lines.push("")
			lines.push(`  ${screen.message}`)
		}
		lines.push("")
		const actions = isSearch
			? `${cyan("enter/i")} install  ${cyan("esc")} back  ${cyan("q")} quit`
			: `${cyan("enter/r")} remove  ${cyan("esc")} back  ${cyan("q")} quit`
		lines.push(`  ${dim("↑↓")} navigate  ${actions}`)
		lines.push(`  ${cyan("◆")} ${dim("= official @bpmnkit plugin")}`)
		return lines
	}

	if (screen.subview === "prompt") {
		const lines = [
			renderHeader(["settings", "plugins", screen.promptAction], cols, state.profile),
			"",
		]
		lines.push(`  ${screen.promptLabel}`)
		lines.push("")
		lines.push(`  > ${renderText(screen.promptValue, screen.promptCursor, cols - 6, true)}`)
		if (screen.running) {
			lines.push("")
			lines.push(`  ${dim("Running…")}`)
		} else if (screen.error) {
			lines.push("")
			lines.push(`  ${red("error:")} ${screen.error}`)
		}
		lines.push("")
		lines.push(
			`  ${dim("type name")}  ${cyan("enter")} confirm  ${cyan("esc")} back  ${cyan("^C")} quit`,
		)
		return lines
	}

	// "done"
	const lines = [renderHeader(["settings", "plugins"], cols, state.profile), "", ""]
	if (screen.error) {
		lines.push(`  ${red("error:")} ${screen.error}`)
	} else {
		for (const line of screen.message.split("\n")) {
			lines.push(`  ${line}`)
		}
	}
	lines.push("")
	lines.push(`  ${cyan("esc")} back  ${cyan("q")} quit`)
	return lines
}

/** Temporarily restore the normal terminal, run fn (which may spawn processes), then re-enter. */
async function runWithTerminal(fn: () => Promise<void>): Promise<void> {
	process.stdout.write(`${ALT_OFF}${SHOW}`)
	if (process.stdin.isTTY) process.stdin.setRawMode(false)
	try {
		await fn()
	} finally {
		if (process.stdin.isTTY) process.stdin.setRawMode(true)
		process.stdout.write(`${ALT_ON}${HIDE}${CLEAR}`)
	}
}

async function handlePluginsKey(
	key: string,
	screen: Extract<Screen, { kind: "plugins" }>,
	state: TuiState,
	done: () => void,
): Promise<void> {
	if (key === "\x03") {
		done()
		return
	}

	// ── Menu subview ──────────────────────────────────────────────────────────
	if (screen.subview === "menu") {
		switch (key) {
			case "\x1b[A":
				if (screen.menuCursor > 0) screen.menuCursor--
				break
			case "\x1b[B":
				if (screen.menuCursor < PLUGIN_MENU.length - 1) screen.menuCursor++
				break
			case "\r":
			case "\n": {
				const item = PLUGIN_MENU[screen.menuCursor]
				if (item?.id === "search") {
					screen.subview = "search"
					screen.query = ""
					screen.queryCursor = 0
					screen.error = ""
				} else if (item?.id === "list") {
					screen.running = true
					screen.error = ""
					render(state)
					try {
						const plugins = await readInstalledPlugins()
						screen.resultKind = "installed"
						screen.results = plugins.map((p) => ({
							name: p.package,
							version: p.version,
							description: "",
							publisher: "",
							score: "",
							installedAt: p.installedAt,
						}))
						screen.resultCursor = 0
						screen.resultScroll = 0
						screen.message = ""
						screen.subview = "results"
					} catch (err) {
						screen.error = err instanceof Error ? err.message : String(err)
					} finally {
						screen.running = false
					}
				} else if (item?.id === "install") {
					screen.subview = "prompt"
					screen.promptLabel = "Package name (e.g. casen-deploy or ./local-path):"
					screen.promptValue = ""
					screen.promptCursor = 0
					screen.promptAction = "install"
					screen.error = ""
				} else if (item?.id === "update") {
					await runWithTerminal(async () => {
						const cmd = pluginGroup.commands.find((c) => c.name === "update")
						if (!cmd) return
						const { writer } = makeCapturingWriter()
						await cmd.run({
							positional: [],
							flags: {},
							output: writer,
							getClient: state.getClient,
							getAdminClient: state.getAdminClient,
						})
					})
					screen.subview = "done"
					screen.message = green("✓ Update complete. Restart casen to activate changes.")
					screen.error = ""
				} else if (item?.id === "remove") {
					screen.subview = "prompt"
					screen.promptLabel = "Plugin package name to remove:"
					screen.promptValue = ""
					screen.promptCursor = 0
					screen.promptAction = "remove"
					screen.error = ""
				}
				break
			}
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

	// ── Search subview ────────────────────────────────────────────────────────
	if (screen.subview === "search") {
		if (key === "\x1b") {
			screen.subview = "menu"
			render(state)
			return
		}
		if (key === "\r" || key === "\n") {
			screen.running = true
			screen.error = ""
			render(state)
			try {
				const raw = await searchNpmRegistry(screen.query)
				screen.results = raw.map((r: NpmSearchObject) => ({
					name: r.package.name,
					version: r.package.version,
					description: r.package.description ?? "",
					publisher: r.package.publisher?.username ?? "",
					score: r.score.final.toFixed(2),
					installedAt: "",
				}))
				screen.resultKind = "search"
				screen.resultCursor = 0
				screen.resultScroll = 0
				screen.message = ""
				screen.subview = "results"
			} catch (err) {
				screen.error = err instanceof Error ? err.message : String(err)
			} finally {
				screen.running = false
			}
			render(state)
			return
		}
		if (key === "\x7f" || key === "\x08") {
			if (screen.queryCursor > 0) {
				screen.query =
					screen.query.slice(0, screen.queryCursor - 1) + screen.query.slice(screen.queryCursor)
				screen.queryCursor--
			}
		} else if (key === "\x1b[D") {
			if (screen.queryCursor > 0) screen.queryCursor--
		} else if (key === "\x1b[C") {
			if (screen.queryCursor < screen.query.length) screen.queryCursor++
		} else if (key === "\x01" || key === "\x1b[H") {
			screen.queryCursor = 0
		} else if (key === "\x05" || key === "\x1b[F") {
			screen.queryCursor = screen.query.length
		} else if (key.length === 1 && key >= " ") {
			screen.query =
				screen.query.slice(0, screen.queryCursor) + key + screen.query.slice(screen.queryCursor)
			screen.queryCursor++
		}
		render(state)
		return
	}

	// ── Results subview ───────────────────────────────────────────────────────
	if (screen.subview === "results") {
		const { rows } = termSize()
		const viewH = Math.max(3, rows - 10)
		switch (key) {
			case "\x1b[A":
				if (screen.resultCursor > 0) {
					screen.resultCursor--
					if (screen.resultCursor < screen.resultScroll) screen.resultScroll--
				}
				break
			case "\x1b[B":
				if (screen.resultCursor < screen.results.length - 1) {
					screen.resultCursor++
					if (screen.resultCursor >= screen.resultScroll + viewH) screen.resultScroll++
				}
				break
			case "\r":
			case "\n":
			case "i":
			case "I":
			case "r":
			case "R": {
				const result = screen.results[screen.resultCursor]
				if (!result) break
				if (screen.resultKind === "installed" && (key === "i" || key === "I")) break
				const action = screen.resultKind === "installed" ? "remove" : "install"
				const pkgName = result.name
				screen.message = dim(`${action === "install" ? "Installing" : "Removing"} ${pkgName}…`)
				render(state)
				const cmd = pluginGroup.commands.find((c) => c.name === action)
				if (!cmd) break
				let opError = ""
				let opMessage = ""
				await runWithTerminal(async () => {
					const { writer, get } = makeCapturingWriter()
					try {
						await cmd.run({
							positional: [pkgName],
							flags: {},
							output: writer,
							getClient: state.getClient,
							getAdminClient: state.getAdminClient,
						})
						const out = get()
						if (out.type === "messages") opMessage = out.lines.join("\n")
						else opMessage = green(`✓ ${action === "install" ? "Installed" : "Removed"} ${pkgName}`)
					} catch (err) {
						opError = err instanceof Error ? err.message : String(err)
					}
				})
				screen.subview = "done"
				screen.message = opMessage
				screen.error = opError
				break
			}
			case "\x1b":
				// Go back to search input if came from search, else back to menu
				if (screen.resultKind === "search") {
					screen.subview = "search"
				} else {
					screen.subview = "menu"
				}
				break
			case "q":
			case "Q":
				done()
				return
		}
		render(state)
		return
	}

	// ── Prompt subview ────────────────────────────────────────────────────────
	if (screen.subview === "prompt") {
		if (key === "\x1b") {
			screen.subview = "menu"
			render(state)
			return
		}
		if (key === "\r" || key === "\n") {
			const pkgName = screen.promptValue.trim()
			if (!pkgName) {
				screen.error = "Package name is required"
				render(state)
				return
			}
			const cmd = pluginGroup.commands.find((c) => c.name === screen.promptAction)
			if (!cmd) return
			let opError = ""
			let opMessage = ""
			await runWithTerminal(async () => {
				const { writer, get } = makeCapturingWriter()
				try {
					await cmd.run({
						positional: [pkgName],
						flags: {},
						output: writer,
						getClient: state.getClient,
						getAdminClient: state.getAdminClient,
					})
					const out = get()
					if (out.type === "messages") opMessage = out.lines.join("\n")
					else opMessage = green("✓ Done")
				} catch (err) {
					opError = err instanceof Error ? err.message : String(err)
				}
			})
			screen.subview = "done"
			screen.message = opMessage
			screen.error = opError
			render(state)
			return
		}
		if (key === "\x7f" || key === "\x08") {
			if (screen.promptCursor > 0) {
				screen.promptValue =
					screen.promptValue.slice(0, screen.promptCursor - 1) +
					screen.promptValue.slice(screen.promptCursor)
				screen.promptCursor--
			}
		} else if (key === "\x1b[D") {
			if (screen.promptCursor > 0) screen.promptCursor--
		} else if (key === "\x1b[C") {
			if (screen.promptCursor < screen.promptValue.length) screen.promptCursor++
		} else if (key === "\x01" || key === "\x1b[H") {
			screen.promptCursor = 0
		} else if (key === "\x05" || key === "\x1b[F") {
			screen.promptCursor = screen.promptValue.length
		} else if (key.length === 1 && key >= " ") {
			screen.promptValue =
				screen.promptValue.slice(0, screen.promptCursor) +
				key +
				screen.promptValue.slice(screen.promptCursor)
			screen.promptCursor++
		}
		render(state)
		return
	}

	// ── Done subview ──────────────────────────────────────────────────────────
	switch (key) {
		case "\x1b":
			screen.subview = "menu"
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
		case "ask":
			await handleAskKey(key, screen, state, done)
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
		case "profile":
			handleProfileKey(key, screen, state, done)
			break
		case "settings":
			handleSettingsKey(key, screen, state, done)
			break
		case "audit-log":
			handleAuditLogKey(key, screen, state, done)
			break
		case "worker":
			handleWorkerKey(key, screen, state, done)
			break
		case "json-editor":
			handleJsonEditorKey(key, screen, state, done)
			break
		case "plugins":
			await handlePluginsKey(key, screen, state, done)
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

export interface TuiOptions {
	getAdminClient?: () => Promise<AdminApiClient>
	/** Active profile name shown in the header. */
	profile?: string
	/** Profile fields with secrets redacted — shown in the profile view (p key). */
	profileInfo?: Array<{ key: string; value: string }>
}

/** Open the TUI at the top-level main menu listing all command groups. */
export async function runMainTui(
	groups: CommandGroup[],
	getClient: () => Promise<CamundaClient>,
	getAdminClient?: () => Promise<AdminApiClient>,
	opts?: TuiOptions,
): Promise<void> {
	return startTui({
		groups,
		stack: [{ kind: "main", cursor: 0, scroll: 0, search: "" }],
		getClient,
		getAdminClient:
			getAdminClient ??
			opts?.getAdminClient ??
			(() => Promise.reject(new Error("No admin client"))),
		quitting: false,
		profile: opts?.profile ?? "",
		profileInfo: opts?.profileInfo ?? [],
	})
}

/** Open the TUI directly at the ask screen (natural language search). */
export async function runAskTui(
	groups: CommandGroup[],
	getClient: () => Promise<CamundaClient>,
	getAdminClient?: () => Promise<AdminApiClient>,
	opts?: TuiOptions,
): Promise<void> {
	return startTui({
		groups,
		stack: [
			{ kind: "main", cursor: 0, scroll: 0, search: "" },
			{ kind: "ask", query: "", cursor: 0, status: "idle", statusMsg: "", error: "", _timer: null },
		],
		getClient,
		getAdminClient:
			getAdminClient ??
			opts?.getAdminClient ??
			(() => Promise.reject(new Error("No admin client"))),
		quitting: false,
		profile: opts?.profile ?? "",
		profileInfo: opts?.profileInfo ?? [],
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
	opts?: TuiOptions,
): Promise<void> {
	const cursor = groups.findIndex((g) => g.name === group.name)
	return startTui({
		groups,
		stack: [
			{ kind: "main", cursor: Math.max(0, cursor), scroll: 0, search: "" },
			{ kind: "commands", group, cursor: 0, search: "" },
		],
		getClient,
		getAdminClient:
			getAdminClient ??
			opts?.getAdminClient ??
			(() => Promise.reject(new Error("No admin client"))),
		quitting: false,
		profile: opts?.profile ?? "",
		profileInfo: opts?.profileInfo ?? [],
	})
}
