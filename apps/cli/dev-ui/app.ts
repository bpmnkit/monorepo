/**
 * The browser half of `casen dev`: a file list, the BPMN Kit editor for the
 * selected file, and the checks the server runs after every save.
 *
 * The editors are the same ones the VS Code extension and the studio mount.
 * Two rules from there hold here too:
 *
 * - **Loading is not editing.** Change handlers are attached after a document
 *   is loaded, so opening a file never writes it back.
 * - **A reload is not editing either.** When the file changes on disk, the new
 *   text is loaded the same way — silently — unless there are unsaved edits,
 *   in which case the user is asked instead of either side being thrown away.
 *
 * The server owns formatting: it writes each save into the file that is
 * already there (`preserve*Formatting`), so this side sends the editor's
 * output as is.
 */

import type { CanvasPlugin } from "@bpmnkit/canvas"
import { Bpmn, Dmn, Form } from "@bpmnkit/core"
import { BpmnEditor } from "@bpmnkit/editor"
import { Engine, runScenario } from "@bpmnkit/engine"
import { DmnEditor } from "@bpmnkit/plugins/dmn-editor"
import { FormEditor } from "@bpmnkit/plugins/form-editor"
import { createLintPlugin } from "@bpmnkit/plugins/lint"
import { createProcessRunnerPlugin } from "@bpmnkit/plugins/process-runner"
import type { ScenarioLike } from "@bpmnkit/plugins/process-runner"
import { createTokenHighlightPlugin } from "@bpmnkit/plugins/token-highlight"
import { createZoomControlsPlugin } from "@bpmnkit/plugins/zoom-controls"
import { injectStyle, injectUiStyles } from "@bpmnkit/ui"
import {
	type CheckResult,
	type DevEvent,
	type ErrorResponse,
	type FileResponse,
	type FilesResponse,
	type ProjectFile,
	type SaveResponse,
	TOKEN_HEADER,
} from "../src/dev/protocol.js"
import { DEV_UI_CSS } from "./styles.js"

injectUiStyles()
injectStyle("casen-dev", DEV_UI_CSS)

const TOKEN = document.querySelector<HTMLMetaElement>('meta[name="casen-dev-token"]')?.content ?? ""
/** How long edits pile up before they are written — one drag is one write, not fifty. */
const SAVE_DEBOUNCE_MS = 400

// ── Theme ─────────────────────────────────────────────────────────────────────

type ViewTheme = "light" | "dark"
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)")
let theme: ViewTheme = darkQuery.matches ? "dark" : "light"
document.documentElement.dataset.theme = theme

// ── DOM ───────────────────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag)
	if (className !== undefined) node.className = className
	if (text !== undefined) node.textContent = text
	return node
}

const app = document.getElementById("app") as HTMLDivElement
const sidebar = el("aside", "dev-sidebar")
const projectTitle = el("div", "dev-project")
const fileList = el("ul", "dev-files")
const checksPane = el("section", "dev-checks")
sidebar.append(projectTitle, fileList, checksPane)

const main = el("main", "dev-main")
const header = el("header", "dev-header")
const fileTitle = el("span", "dev-file-title", "No file open")
const saveState = el("span", "dev-save-state")
const simBar = el("div", "dev-sim-bar")
header.append(fileTitle, saveState, simBar)
const banner = el("div", "dev-banner")
banner.hidden = true
const stage = el("div", "dev-stage")
const play = el("div", "dev-play")
play.hidden = true
main.append(header, banner, stage, play)
app.append(sidebar, main)

// ── Server ────────────────────────────────────────────────────────────────────

class HttpError extends Error {
	constructor(
		readonly status: number,
		readonly body: ErrorResponse,
	) {
		super(body.error)
	}
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
	const res = await fetch(path, {
		...init,
		headers: { ...init.headers, [TOKEN_HEADER]: TOKEN, "content-type": "application/json" },
	})
	const body = (await res.json()) as T | ErrorResponse
	if (!res.ok) throw new HttpError(res.status, body as ErrorResponse)
	return body as T
}

const fileUrl = (path: string) => `/api/file?path=${encodeURIComponent(path)}`

function saveFile(path: string, text: string, baseEtag: string | null): Promise<SaveResponse> {
	return api<SaveResponse>(fileUrl(path), {
		method: "PUT",
		body: JSON.stringify({ text, baseEtag }),
	})
}

// ── State ─────────────────────────────────────────────────────────────────────

let files: ProjectFile[] = []
const checks = new Map<string, CheckResult>()

interface Open {
	path: string
	kind: ProjectFile["kind"]
	/** Fingerprint of the text on disk this view last loaded or saved. */
	etag: string
	/** The latest edit not yet written, as a way to serialise it. */
	unsaved: (() => Promise<string>) | null
	destroy(): void
	setTheme(theme: ViewTheme): void
}

let open: Open | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined
let saving: Promise<void> = Promise.resolve()

function reason(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function setSaveState(text: string, tone: "ok" | "busy" | "bad" = "ok"): void {
	saveState.textContent = text
	saveState.dataset.tone = tone
}

function showBanner(text: string, actions: Array<[string, () => void]>): void {
	banner.replaceChildren(el("span", undefined, text))
	for (const [label, act] of actions) {
		const button = el("button", "dev-button", label)
		button.addEventListener("click", act)
		banner.append(button)
	}
	banner.hidden = false
}

function hideBanner(): void {
	banner.hidden = true
	banner.replaceChildren()
}

// ── Saving ────────────────────────────────────────────────────────────────────

function edited(serialise: () => Promise<string>): void {
	if (open === null) return
	open.unsaved = serialise
	setSaveState("Unsaved", "busy")
	clearTimeout(saveTimer)
	saveTimer = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS)
}

/** Writes the pending edit, one save at a time, each against the etag the last one returned. */
function flush(overwrite = false): Promise<void> {
	saving = saving.then(async () => {
		const current = open
		if (current === null || current.unsaved === null) return
		const serialise = current.unsaved
		current.unsaved = null
		setSaveState("Saving…", "busy")
		try {
			const text = await serialise()
			const base = overwrite ? await diskEtag(current.path) : current.etag
			const saved = await saveFile(current.path, text, base)
			current.etag = saved.etag
			hideBanner()
			if (current.unsaved === null) {
				setSaveState(saved.outcome === "preserved" ? "Saved · formatting kept" : "Saved")
			}
		} catch (error) {
			// Put the edit back: nothing was written, and the next save or an
			// explicit overwrite should still carry it.
			if (current.unsaved === null) current.unsaved = serialise
			if (error instanceof HttpError && error.status === 409) {
				setSaveState("Not saved", "bad")
				showBanner("This file changed on disk while you were editing it.", [
					["Reload from disk (drop my edits)", () => void openFile(current.path)],
					["Overwrite with mine", () => void flush(true)],
				])
			} else {
				setSaveState(`Not saved — ${reason(error)}`, "bad")
			}
		}
	})
	return saving
}

async function diskEtag(path: string): Promise<string | null> {
	try {
		return (await api<FileResponse>(fileUrl(path))).etag
	} catch (error) {
		if (error instanceof HttpError && error.status === 404) return null
		throw error
	}
}

document.addEventListener("keydown", (event) => {
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
		event.preventDefault()
		clearTimeout(saveTimer)
		void flush()
	}
})

window.addEventListener("beforeunload", (event) => {
	if (open?.unsaved) event.preventDefault()
})

// ── Mounting editors ──────────────────────────────────────────────────────────

/** The `.dmn` files beside a process, deployed so business rule tasks can run. */
async function decisionsBeside(path: string): Promise<string[]> {
	const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : ""
	const beside = files.filter(
		(f) => f.kind === "dmn" && f.path.startsWith(dir) && !f.path.slice(dir.length).includes("/"),
	)
	const texts = await Promise.all(
		beside.map((f) => api<FileResponse>(fileUrl(f.path)).then((r) => r.text)),
	)
	return texts
}

async function mountBpmn(
	path: string,
	text: string,
): Promise<Omit<Open, "path" | "kind" | "etag">> {
	Bpmn.parse(text)
	const engine = new Engine()
	for (const dmn of await decisionsBeside(path)) {
		try {
			engine.deploy({ decisions: Dmn.parse(dmn) })
		} catch {
			// The server's check reports a broken DMN on its own row.
		}
	}

	const testsPath = `${path}.tests.json`
	let testsEtag: string | null = null
	const tokenHighlight = createTokenHighlightPlugin()
	let editor: BpmnEditor | null = null
	const runner = createProcessRunnerPlugin({
		engine,
		tokenHighlight,
		playContainer: play,
		onShowPlayTab: () => {
			play.hidden = false
		},
		onHidePlayTab: () => {
			play.hidden = true
		},
		runScenario: (scenario) => {
			const xml = editor?.exportXml()
			if (xml === undefined) return Promise.reject(new Error("No diagram loaded"))
			return runScenario(new Engine(), Bpmn.parse(xml), scenario)
		},
		getDefinitions: () => editor?.getDefinitions() ?? null,
		onLoadScenarios: async () => {
			try {
				const res = await api<FileResponse>(fileUrl(testsPath))
				testsEtag = res.etag
				return JSON.parse(res.text) as ScenarioLike[]
			} catch (error) {
				if (error instanceof HttpError && error.status === 404) {
					testsEtag = null
					return []
				}
				throw error
			}
		},
		onSaveScenarios: async (scenarios) => {
			const saved = await saveFile(testsPath, `${JSON.stringify(scenarios, null, 2)}\n`, testsEtag)
			testsEtag = saved.etag
		},
	})
	simBar.replaceChildren(runner.playButton, runner.toolbar)

	const plugins: CanvasPlugin[] = [
		createZoomControlsPlugin(),
		createLintPlugin(),
		tokenHighlight,
		runner,
	]
	const bpmn = new BpmnEditor({ container: stage, theme, fit: "contain", plugins })
	editor = bpmn
	bpmn.load(text)
	bpmn.on("diagram:change", () => edited(async () => bpmn.exportXml()))
	return {
		unsaved: null,
		destroy: () => bpmn.destroy(),
		setTheme: (next) => bpmn.setTheme(next),
	}
}

async function mountDmn(text: string): Promise<Omit<Open, "path" | "kind" | "etag">> {
	Dmn.parse(text)
	const editor = new DmnEditor({ container: stage, theme })
	await editor.loadXML(text)
	editor.onChange(() => edited(() => editor.getXML()))
	return { unsaved: null, destroy: () => editor.destroy(), setTheme: (t) => editor.setTheme(t) }
}

async function mountForm(text: string): Promise<Omit<Open, "path" | "kind" | "etag">> {
	Form.parse(text)
	const editor = new FormEditor({ container: stage, theme })
	await editor.loadSchema(JSON.parse(text) as Record<string, unknown>)
	editor.onChange(() => edited(async () => `${JSON.stringify(editor.getSchema(), null, 2)}\n`))
	return { unsaved: null, destroy: () => editor.destroy(), setTheme: (t) => editor.setTheme(t) }
}

function unmount(): void {
	clearTimeout(saveTimer)
	open?.destroy()
	open = null
	stage.replaceChildren()
	simBar.replaceChildren()
	play.replaceChildren()
	play.hidden = true
	hideBanner()
}

async function openFile(path: string): Promise<void> {
	// Whatever is pending for the file being left goes to disk first.
	await flush()
	let res: FileResponse
	try {
		res = await api<FileResponse>(fileUrl(path))
	} catch (error) {
		unmount()
		fileTitle.textContent = path
		setSaveState(reason(error), "bad")
		return
	}
	if (res.kind === "tests") return
	unmount()
	fileTitle.textContent = res.path
	try {
		const mounted =
			res.kind === "bpmn"
				? await mountBpmn(res.path, res.text)
				: res.kind === "dmn"
					? await mountDmn(res.text)
					: await mountForm(res.text)
		open = { ...mounted, path: res.path, kind: res.kind, etag: res.etag }
		setSaveState("Saved")
	} catch (error) {
		setSaveState(`Cannot open — ${reason(error)}`, "bad")
	}
	if (location.hash !== `#${res.path}`) history.replaceState(null, "", `#${res.path}`)
	renderFiles()
	renderChecks()
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function failing(result: CheckResult | undefined): boolean {
	if (result === undefined) return false
	return (
		result.parseError !== undefined ||
		result.testsError !== undefined ||
		(result.lint?.errors ?? 0) > 0 ||
		(result.tests?.failed ?? 0) > 0
	)
}

function renderFiles(): void {
	fileList.replaceChildren()
	if (files.length === 0) {
		fileList.append(el("li", "dev-empty", "No .bpmn, .dmn or .form files in this folder yet."))
		return
	}
	for (const file of files) {
		const result = checks.get(file.path)
		const item = el("li")
		const button = el("button", "dev-file")
		button.dataset.path = file.path
		if (open?.path === file.path) button.setAttribute("aria-current", "true")
		const dot = el("span", "dev-dot")
		dot.dataset.state = result === undefined ? "pending" : failing(result) ? "bad" : "ok"
		dot.title = result === undefined ? "Checking…" : failing(result) ? "Failing" : "Passing"
		button.append(dot, el("span", "dev-file-name", file.path), el("span", "dev-kind", file.kind))
		button.addEventListener("click", () => void openFile(file.path))
		item.append(button)
		fileList.append(item)
	}
}

function renderChecks(): void {
	checksPane.replaceChildren(el("h2", "dev-heading", "Checks"))
	const result = open === null ? undefined : checks.get(open.path)
	if (result === undefined) {
		checksPane.append(
			el("p", "dev-muted", open === null ? "Open a file to see its checks." : "Checking…"),
		)
		return
	}
	const list = el("ul", "dev-results")
	const row = (tone: "ok" | "bad" | "warn", text: string) => {
		const li = el("li", "dev-result", text)
		li.dataset.tone = tone
		list.append(li)
	}
	if (result.parseError !== undefined) row("bad", `Does not parse: ${result.parseError}`)
	if (result.lint !== undefined) {
		const { errors, warnings, infos } = result.lint
		row(
			errors > 0 ? "bad" : warnings > 0 ? "warn" : "ok",
			`Lint: ${errors} errors, ${warnings} warnings, ${infos} info`,
		)
		for (const f of result.lint.findings.filter((x) => x.severity !== "info")) {
			const where = f.elementIds.length > 0 ? ` [${f.elementIds.join(", ")}]` : ""
			row(f.severity === "error" ? "bad" : "warn", `${f.category}${where}: ${f.message}`)
		}
	}
	if (result.testsError !== undefined) row("bad", result.testsError)
	if (result.tests !== undefined) {
		const { passed, failed, engine } = result.tests
		row(failed > 0 ? "bad" : "ok", `Scenarios (${engine}): ${passed}/${passed + failed} passed`)
		for (const s of result.tests.scenarios) {
			row(s.passed ? "ok" : "bad", `${s.passed ? "PASS" : "FAIL"} ${s.name}`)
			for (const problem of s.problems) row("bad", `  ${problem}`)
		}
	} else if (result.kind === "bpmn" && result.testsError === undefined) {
		row(
			"warn",
			`No scenarios — add some in the Tests tab of Play mode (${result.path}.tests.json).`,
		)
	}
	if (result.kind !== "bpmn" && result.parseError === undefined) row("ok", "Parses")
	checksPane.append(
		list,
		el("p", "dev-muted", `Last run ${new Date(result.at).toLocaleTimeString()}`),
	)
}

// ── Live updates ──────────────────────────────────────────────────────────────

async function onRemoteChange(path: string, etag: string | null): Promise<void> {
	// The server announces our own save before its response reaches us; wait for
	// the save to record its etag, or the echo reads as someone else's edit.
	await saving
	if (open === null || open.path !== path || open.etag === etag) return
	if (etag === null) {
		showBanner("This file was deleted on disk.", [])
		return
	}
	if (open.unsaved !== null) {
		showBanner("This file changed on disk while you were editing it.", [
			["Reload from disk (drop my edits)", () => void openFile(path)],
			["Overwrite with mine", () => void flush(true)],
		])
		return
	}
	await openFile(path)
	setSaveState("Reloaded from disk")
}

function connect(): void {
	const events = new EventSource(`/api/events?token=${encodeURIComponent(TOKEN)}`)
	events.onmessage = (message: MessageEvent<string>) => {
		const event = JSON.parse(message.data) as DevEvent
		if (event.type === "files") {
			files = event.files
			renderFiles()
		} else if (event.type === "check") {
			checks.set(event.result.path, event.result)
			renderFiles()
			if (open?.path === event.result.path) renderChecks()
		} else {
			void onRemoteChange(event.path, event.etag)
		}
	}
	events.onerror = () => setSaveState("Disconnected from casen dev — is it still running?", "bad")
	events.onopen = () => {
		if (saveState.dataset.tone === "bad" && open?.unsaved === null) setSaveState("Saved")
	}
}

darkQuery.addEventListener("change", () => {
	theme = darkQuery.matches ? "dark" : "light"
	document.documentElement.dataset.theme = theme
	open?.setTheme(theme)
})

async function start(): Promise<void> {
	const initial = await api<FilesResponse>("/api/files")
	files = initial.files
	for (const result of initial.checks) checks.set(result.path, result)
	projectTitle.replaceChildren(
		el("span", "dev-eyebrow", "casen dev"),
		el("strong", undefined, initial.project),
	)
	renderFiles()
	renderChecks()
	connect()
	const fromHash = decodeURIComponent(location.hash.slice(1))
	const first = files.find((f) => f.path === fromHash) ?? files[0]
	if (first !== undefined) await openFile(first.path)
}

window.addEventListener("hashchange", () => {
	const path = decodeURIComponent(location.hash.slice(1))
	if (path !== open?.path && files.some((f) => f.path === path)) void openFile(path)
})

void start().catch((error: unknown) =>
	setSaveState(`Cannot reach casen dev — ${reason(error)}`, "bad"),
)
