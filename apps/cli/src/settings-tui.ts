import { getSettings, saveSettings } from "@bpmn-sdk/profiles"
import type { Settings } from "@bpmn-sdk/profiles"

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const CSI = "\x1b["

const HIDE_CURSOR = `${CSI}?25l`
const SHOW_CURSOR = `${CSI}?25h`
const ALT_ON = `${CSI}?1049h`
const ALT_OFF = `${CSI}?1049l`
const CLEAR = `${CSI}2J${CSI}H`

function inv(s: string): string {
	return `${CSI}7m${s}${CSI}m`
}
function bold(s: string): string {
	return `${CSI}1m${s}${CSI}m`
}
function dim(s: string): string {
	return `${CSI}2m${s}${CSI}m`
}
function green(s: string): string {
	return `${CSI}32m${s}${CSI}m`
}
function red(s: string): string {
	return `${CSI}31m${s}${CSI}m`
}
function cyan(s: string): string {
	return `${CSI}36m${s}${CSI}m`
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: needed for ANSI stripping
const ANSI_RE = /\x1b\[[0-9;]*m/g
function vlen(s: string): number {
	return s.replace(ANSI_RE, "").length
}
function padEnd(s: string, n: number): string {
	const v = vlen(s)
	return v < n ? s + " ".repeat(n - v) : s
}

// ─── Setting rows ─────────────────────────────────────────────────────────────

interface SettingRow {
	key: keyof Settings
	label: string
	description: string
	type: "number"
	min?: number
	max?: number
}

const SETTING_ROWS: SettingRow[] = [
	{
		key: "auditLogSize",
		label: "audit-log-size",
		description: "Number of actions to keep in the audit log per profile (0 = disabled)",
		type: "number",
		min: 0,
		max: 1000,
	},
]

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
	settings: Settings
	cursor: number
	editing: boolean
	editValue: string
	message: string
}

function loadSettings(): Settings {
	return getSettings()
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render(state: State): void {
	const termCols = process.stdout.columns ?? 80
	const labelW = SETTING_ROWS.reduce((m, r) => Math.max(m, r.label.length), 0) + 4

	const out: string[] = []

	out.push("")
	out.push(`  ${bold("casen — Settings")}`)
	out.push("")
	out.push(`  ${dim(padEnd("SETTING", labelW))}  ${dim("VALUE")}`)
	out.push(dim(`  ${"─".repeat(termCols - 4)}`))

	for (let i = 0; i < SETTING_ROWS.length; i++) {
		const row = SETTING_ROWS[i]
		if (!row) continue
		const isCursor = i === state.cursor
		const rawValue = state.settings[row.key]
		const valueStr =
			state.editing && isCursor ? `${cyan(`[${state.editValue}_]`)}` : String(rawValue)

		const labelPart = padEnd(isCursor ? cyan(row.label) : row.label, labelW)
		const content = `  ${labelPart}  ${valueStr}`
		const padded = content + " ".repeat(Math.max(0, termCols - vlen(content) - 1))
		out.push(isCursor ? inv(padded) : padded)
	}
	out.push("")

	const selectedRow = SETTING_ROWS[state.cursor]
	if (selectedRow) {
		out.push(`  ${dim(selectedRow.description)}`)
	}
	out.push("")

	if (state.message) {
		out.push(`  ${state.message}`)
	} else if (state.editing) {
		out.push(
			`  ${dim("type")} new value  ${cyan("enter")} save  ${cyan("esc")} cancel  ${dim("bksp")} delete`,
		)
	} else {
		out.push(`  ${dim("↑↓")} navigate  ${cyan("enter")} edit  ${cyan("q")} quit`)
	}

	process.stdout.write(`${CLEAR}${out.join("\n")}\n`)
}

// ─── Key handling ─────────────────────────────────────────────────────────────

function handleKey(key: string, state: State, done: () => void): void {
	state.message = ""

	if (state.editing) {
		if (key === "\r" || key === "\n") {
			// Commit edit
			const row = SETTING_ROWS[state.cursor]
			if (row) {
				const n = Number(state.editValue)
				const min = row.min ?? 0
				const max = row.max ?? Number.MAX_SAFE_INTEGER
				if (!Number.isNaN(n) && n >= min && n <= max) {
					const updated: Partial<Settings> = {}
					updated[row.key] = n
					saveSettings(updated)
					state.settings = loadSettings()
					state.message = green(`✓ Saved: ${row.label} = ${n}`)
				} else {
					state.message = red(`Invalid value — must be a number between ${min} and ${max}`)
				}
			}
			state.editing = false
			state.editValue = ""
		} else if (key === "\x1b") {
			// Cancel
			state.editing = false
			state.editValue = ""
		} else if (key === "\x7f" || key === "\x08") {
			// Backspace
			state.editValue = state.editValue.slice(0, -1)
		} else if (key >= "0" && key <= "9") {
			state.editValue += key
		}
		render(state)
		return
	}

	switch (key) {
		case "\x1b[A": // up
			if (state.cursor > 0) state.cursor--
			break
		case "\x1b[B": // down
			if (state.cursor < SETTING_ROWS.length - 1) state.cursor++
			break
		case "\r":
		case "\n": {
			// Start editing
			const row = SETTING_ROWS[state.cursor]
			if (row) {
				state.editing = true
				state.editValue = String(state.settings[row.key])
			}
			break
		}
		case "q":
		case "Q":
		case "\x03": // Ctrl+C
		case "\x1b": // ESC
			done()
			return
	}

	render(state)
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function runSettingsManager(): Promise<void> {
	// Non-interactive fallback
	if (!process.stdout.isTTY || !process.stdin.isTTY) {
		const settings = loadSettings()
		for (const row of SETTING_ROWS) {
			process.stdout.write(`${row.label}: ${String(settings[row.key])}\n`)
		}
		return
	}

	process.stdout.write(ALT_ON + HIDE_CURSOR)

	let cleaned = false
	const cleanup = () => {
		if (cleaned) return
		cleaned = true
		process.stdout.write(ALT_OFF + SHOW_CURSOR)
		if (process.stdin.isTTY) process.stdin.setRawMode(false)
		process.stdin.pause()
	}

	process.on("exit", cleanup)

	const state: State = {
		settings: loadSettings(),
		cursor: 0,
		editing: false,
		editValue: "",
		message: "",
	}

	render(state)

	await new Promise<void>((resolve) => {
		process.stdin.setRawMode(true)
		process.stdin.resume()
		process.stdin.setEncoding("utf8")
		process.stdin.on("data", (key: string) => handleKey(key, state, resolve))
	})

	cleanup()
	process.removeListener("exit", cleanup)
}
