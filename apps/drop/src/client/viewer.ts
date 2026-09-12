import { BpmnCanvas } from "@bpmnkit/canvas"
import { Bpmn, compactify } from "@bpmnkit/core"
import { DmnViewer } from "@bpmnkit/plugins/dmn-viewer"
import { FormViewer } from "@bpmnkit/plugins/form-viewer"
import { injectUiStyles } from "@bpmnkit/ui"
import type { ReviewResult, Suggestion } from "../lib/review.js"
import { AI_CODE_STORAGE_KEY, DEMO_SHARE_ID, type FileKind } from "../shared/constants.js"
import {
	type ClientMessage,
	PING,
	PING_INTERVAL_MS,
	PONG,
	type ServerMessage,
} from "../shared/room-protocol.js"
import { type Change, DocWatcher, type WatcherDoc } from "./watcher.js"

interface DropFile {
	filename: string
	kind: FileKind
	name: string | null
	decisionIds: string[]
}
interface DropData {
	shareId: string
	files: DropFile[]
	primaryIndex: number
}

injectUiStyles()

const data = JSON.parse(
	(document.getElementById("drop-data") as HTMLScriptElement).textContent ?? "{}",
) as DropData

const viewer = document.getElementById("viewer") as HTMLDivElement
const dlOriginal = document.getElementById("dlOriginal") as HTMLAnchorElement
const dlJson = document.getElementById("dlJson") as HTMLAnchorElement
// Follow the page theme (bpmnkit tokens default to light; dark only via [data-theme]),
// NOT the OS — otherwise the canvas would go dark on a light page.
const theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"

const zoombar = document.getElementById("zoombar") as HTMLElement
const zoomLevel = document.getElementById("zoomLevel") as HTMLElement
const aiBtn = document.getElementById("aiReviewBtn") as HTMLButtonElement | null
const aiPanel = document.getElementById("aiPanel") as HTMLElement | null
const aiBody = document.getElementById("aiBody") as HTMLElement | null
const aiModelEl = document.getElementById("aiModel") as HTMLElement | null
let current: BpmnCanvas | null = null
let activeIndex = -1
let scale = 1
let reviewFile: DropFile | null = null

// The button only exists (server-rendered) when AI is enabled; show it on BPMN tabs.
function setActiveReviewFile(file: DropFile | null): void {
	reviewFile = file
	if (aiBtn) aiBtn.hidden = file === null
	if (!file && aiPanel) aiPanel.hidden = true
	aiBody?.replaceChildren()
}

function contentUrl(file: DropFile, format?: "json", version?: number): string {
	const base = `/drop/${data.shareId}/f/${encodeURIComponent(file.filename)}`
	const params = new URLSearchParams()
	if (format) params.set("format", format)
	if (version !== undefined) params.set("v", String(version))
	const query = params.toString()
	return query ? `${base}?${query}` : base
}

function message(text: string): void {
	viewer.innerHTML = `<div class="viewer-msg">${text.replace(/[<>&]/g, (c) => `&#${c.charCodeAt(0)};`)}</div>`
}

/** How long a live edit stays flashed on a watcher's screen. */
const FLASH_MS = 1_200

let flashTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Redraws the canvas with a document the room has moved on to.
 *
 * `keepViewport` is the whole point of the call: a new document is normally
 * framed, and re-framing on every op would yank the diagram out from under
 * someone who had zoomed in to watch one corner of it.
 */
function showLiveUpdate(doc: WatcherDoc, change: Change | null): void {
	const canvas = current
	const file = data.files[activeIndex]
	if (!canvas || file?.filename !== doc.filename) return

	canvas.loadDefinitions(doc.defs, { keepViewport: true })

	if (flashTimer !== null) clearTimeout(flashTimer)
	if (change) {
		canvas.highlight(change.touched, "changed")
		canvas.highlight(change.created, "new")
		flashTimer = setTimeout(() => canvas.clearHighlights(), FLASH_MS)
	}
}

async function renderBpmn(xml: string): Promise<void> {
	viewer.innerHTML = ""
	// Frame the whole diagram (fit-to-viewport), but never enlarge a small
	// diagram past 100% — the first auto-fit reports its scale and we cap it.
	let capped = false
	const canvas = new BpmnCanvas({ container: viewer, xml, theme, grid: true, fit: "contain" })
	current = canvas
	canvas.on("viewport:change", (state) => {
		scale = state.scale
		zoomLevel.textContent = `${Math.round(scale * 100)}%`
		if (!capped) {
			capped = true
			// The auto-fit would zoom in past 100% for small diagrams — pin to 100%,
			// keeping the (already-centered) diagram centered.
			if (state.scale > 1.001) canvas.zoom(1)
		}
	})
	zoombar.hidden = false
	wireCrossFileLinks(xml, canvas)
}

function renderDmn(json: string): void {
	viewer.innerHTML = ""
	zoombar.hidden = true
	new DmnViewer({ container: viewer, theme }).load(JSON.parse(json))
}

function renderForm(json: string): void {
	viewer.innerHTML = ""
	zoombar.hidden = true
	new FormViewer({ container: viewer, theme }).load(JSON.parse(json))
}

/** Make a clicked task that references a form/decision in this drop jump to its tab. */
function wireCrossFileLinks(xml: string, canvas: BpmnCanvas): void {
	const refs = new Map<string, { formId?: string; decisionId?: string }>()
	try {
		for (const process of compactify(Bpmn.parse(xml)).processes) collectRefs(process.elements, refs)
	} catch {
		return
	}
	canvas.on("element:click", (id: string) => {
		const ref = refs.get(id)
		if (!ref) return
		if (ref.formId) {
			const i = data.files.findIndex((f) => f.kind === "form" && f.name === ref.formId)
			if (i >= 0) return void select(i)
		}
		if (ref.decisionId) {
			const i = data.files.findIndex(
				(f) => f.kind === "dmn" && f.decisionIds.includes(ref.decisionId as string),
			)
			if (i >= 0) void select(i)
		}
	})
}

interface RefElement {
	id: string
	formId?: string
	decisionId?: string
	children?: { elements: RefElement[] }
}
function collectRefs(
	elements: RefElement[],
	into: Map<string, { formId?: string; decisionId?: string }>,
): void {
	for (const el of elements) {
		if (el.formId || el.decisionId)
			into.set(el.id, { formId: el.formId, decisionId: el.decisionId })
		if (el.children) collectRefs(el.children.elements, into)
	}
}

/**
 * Shows one of the drop's files.
 *
 * `xml` short-circuits the fetch, for the one case where the page already has
 * something newer than the server: the moment a writer puts the baton down. The
 * room is the authority and the editor was in step with it, so re-reading would
 * only risk showing something staler.
 */
async function select(index: number, xml?: string): Promise<void> {
	if (index === activeIndex) return
	const file = data.files[index]
	if (!file) return
	activeIndex = index

	for (const tab of document.querySelectorAll<HTMLElement>(".ed-tab")) {
		tab.classList.toggle("active", Number(tab.dataset.index) === index)
	}
	// `?v=0` is the uploaded file, not the current one — the label says "Original"
	// and a mutable drop has to make that literally true.
	dlOriginal.href = contentUrl(file, undefined, 0)
	dlOriginal.setAttribute("download", file.filename)
	dlJson.href = contentUrl(file, "json")
	dlJson.setAttribute("download", `${file.filename}.json`)

	// AI review applies to BPMN only; reset per-file review state on switch.
	setActiveReviewFile(file.kind === "bpmn" ? file : null)
	// Only BPMN has an op vocabulary, so a DMN or form tab watches nothing.
	watcher.watch(file.kind === "bpmn" ? file.filename : null)
	updateEditAffordance()
	exitVersionPreview()
	if (historyPanel && !historyPanel.hidden) void loadHistory()

	current?.destroy()
	current = null
	message("Loading…")
	try {
		if (file.kind === "bpmn") {
			await renderBpmn(xml ?? (await (await fetch(contentUrl(file))).text()))
		} else if (file.kind === "dmn") {
			renderDmn(await (await fetch(contentUrl(file, "json"))).text())
		} else {
			renderForm(await (await fetch(contentUrl(file, "json"))).text())
		}
	} catch {
		message("Failed to load this file.")
	}
}

for (const tab of document.querySelectorAll<HTMLElement>(".ed-tab")) {
	tab.addEventListener("click", () => void select(Number(tab.dataset.index)))
}

// ── Zoom controls (BPMN canvas only) ────────────────────────────────────────

document.getElementById("zoomIn")?.addEventListener("click", () => current?.zoom(scale * 1.2))
document.getElementById("zoomOut")?.addEventListener("click", () => current?.zoom(scale / 1.2))
document.getElementById("zoomReset")?.addEventListener("click", () => current?.resetZoom())
document.getElementById("zoomFit")?.addEventListener("click", () => current?.zoom("fit"))

// ── AI process review panel ─────────────────────────────────────────────────

function dot(severity: string): HTMLElement {
	const d = document.createElement("span")
	d.className = `ai-dot ${severity}`
	return d
}

function suggestionCard(s: Suggestion): HTMLElement {
	const card = document.createElement("div")
	card.className = s.elementId ? "ai-card clickable" : "ai-card"
	const title = document.createElement("div")
	title.className = "ai-title"
	const text = document.createElement("span")
	text.textContent = s.title // textContent: hostile names can't inject markup
	title.append(dot(s.severity), text)
	const why = document.createElement("div")
	why.className = "ai-why"
	why.textContent = s.why
	card.append(title, why)
	const id = s.elementId
	if (id) {
		card.addEventListener("mouseenter", () => current?.highlight([id], "changed"))
		card.addEventListener("mouseleave", () => current?.clearHighlights())
		// Click pins the highlight (touch devices have no hover).
		card.addEventListener("click", () => {
			current?.clearHighlights()
			current?.highlight([id], "changed")
		})
	}
	return card
}

function label(txt: string): HTMLElement {
	const l = document.createElement("div")
	l.className = "ai-label"
	l.textContent = txt
	return l
}

function renderReview(review: ReviewResult): void {
	if (!aiBody) return
	aiBody.replaceChildren()
	if (review.summary) {
		const sum = document.createElement("div")
		sum.className = "ai-summary"
		sum.textContent = review.summary
		aiBody.append(sum)
	}
	if (review.suggestions.length > 0) {
		aiBody.append(label("AI suggestions"))
		for (const s of review.suggestions) aiBody.append(suggestionCard(s))
	}
	if (review.deterministic.length > 0) {
		aiBody.append(label("Automated checks"))
		for (const s of review.deterministic) aiBody.append(suggestionCard(s))
	}
	if (review.note) {
		const note = document.createElement("div")
		note.className = "ai-msg"
		note.textContent = review.note
		aiBody.append(note)
	}
	if (review.deterministic.length === 0 && review.suggestions.length === 0 && !review.summary) {
		const ok = document.createElement("div")
		ok.className = "ai-msg"
		ok.textContent = "No issues found by the automated checks. Nice diagram!"
		aiBody.append(ok)
	}
	if (aiModelEl) {
		aiModelEl.textContent = review.model
			? `Model: ${review.model}${review.cached ? " (cached)" : ""}`
			: ""
	}
}

function aiMessage(text: string): void {
	aiBody?.replaceChildren(
		Object.assign(document.createElement("div"), { className: "ai-msg", textContent: text }),
	)
}

/** Prompt for the closed-beta access code; on submit, store it and retry. */
function showPasscodeForm(error = false): void {
	if (!aiBody) return
	const wrap = document.createElement("div")
	wrap.className = error ? "ai-passcode err" : "ai-passcode"
	const msg = document.createElement("div")
	msg.className = "ai-msg"
	msg.textContent = error
		? "Invalid access code. Try again."
		: "This feature is in a closed beta. Enter your access code."
	const input = document.createElement("input")
	input.type = "password"
	input.placeholder = "Access code"
	input.autocomplete = "off"
	const submit = document.createElement("button")
	submit.className = "btn-primary"
	submit.textContent = "Unlock"
	const go = () => {
		const code = input.value.trim()
		if (!code) return
		localStorage.setItem(AI_CODE_STORAGE_KEY, code)
		void loadReview()
	}
	submit.addEventListener("click", go)
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") go()
	})
	wrap.append(msg, input, submit)
	aiBody.replaceChildren(wrap)
	input.focus()
}

async function loadReview(): Promise<void> {
	if (!reviewFile || !aiBody) return
	const code = localStorage.getItem(AI_CODE_STORAGE_KEY)
	if (!code) {
		showPasscodeForm(false)
		return
	}
	aiMessage("Analyzing…")
	try {
		const res = await fetch(
			`/drop/api/ai-review/${data.shareId}/${encodeURIComponent(reviewFile.filename)}`,
			{ method: "POST", headers: { "X-Drop-AI-Code": code } },
		)
		if (res.status === 401) {
			localStorage.removeItem(AI_CODE_STORAGE_KEY)
			showPasscodeForm(true)
			return
		}
		if (res.status === 429) {
			aiMessage("Too many attempts. Please try again later.")
			return
		}
		if (res.status === 404) {
			if (aiBtn) aiBtn.hidden = true
			if (aiPanel) aiPanel.hidden = true
			return
		}
		if (!res.ok) throw new Error(`status ${res.status}`)
		renderReview((await res.json()) as ReviewResult)
	} catch {
		aiMessage("Couldn't run the review. Please try again.")
	}
}

aiBtn?.addEventListener("click", () => {
	if (!aiPanel) return
	aiPanel.hidden = !aiPanel.hidden
	if (!aiPanel.hidden) void loadReview()
})
document.getElementById("aiClose")?.addEventListener("click", () => {
	if (aiPanel) aiPanel.hidden = true
})

// ── Version history ─────────────────────────────────────────────────────────
// The bound is the feature: the pinned original plus a fixed number of rolling
// milestones. The panel says so out loud, so a missing older entry reads as the
// design rather than as data loss.

interface VersionEntry {
	seq: number
	createdAt: number
	label: "original" | "layout" | "model"
	bytes: number
	opCount: number
}

const historyBtn = document.getElementById("historyBtn") as HTMLButtonElement | null
const historyPanel = document.getElementById("historyPanel") as HTMLElement | null
const historyBody = document.getElementById("historyBody") as HTMLElement | null
const historyBound = document.getElementById("historyBound") as HTMLElement | null
const historyBanner = document.getElementById("historyBanner") as HTMLElement | null
const historyBannerText = document.getElementById("historyBannerText") as HTMLElement | null

/** Which stored version the canvas is showing, or null for the live one. */
let previewing: number | null = null

// The demo drop is served from memory and has no rows to keep history in.
if (historyBtn && data.shareId !== DEMO_SHARE_ID) historyBtn.hidden = false

function when(ms: number): string {
	return new Date(ms).toISOString().slice(0, 16).replace("T", " ")
}

function labelText(entry: VersionEntry): string {
	if (entry.label === "original") return "Original"
	if (entry.label === "layout") return "Layout only"
	return "Model changed"
}

function historyMessage(text: string): void {
	historyBody?.replaceChildren(
		Object.assign(document.createElement("div"), { className: "ai-msg", textContent: text }),
	)
}

function exitVersionPreview(): void {
	previewing = null
	if (historyBanner) historyBanner.hidden = true
}

/** Renders a stored version on the canvas, without making it current. */
async function previewVersion(entry: VersionEntry): Promise<void> {
	const file = data.files[activeIndex]
	if (!file || file.kind !== "bpmn") return
	message("Loading…")
	try {
		const xml = await (await fetch(contentUrl(file, undefined, entry.seq))).text()
		await renderBpmn(xml)
		previewing = entry.seq
		if (historyBanner && historyBannerText) {
			historyBannerText.textContent =
				entry.seq === 0
					? `Showing the original, from ${when(entry.createdAt)}`
					: `Showing version ${entry.seq}, from ${when(entry.createdAt)}`
			historyBanner.hidden = false
		}
	} catch {
		message("That version could not be loaded.")
	}
}

async function restoreVersion(entry: VersionEntry): Promise<void> {
	const file = data.files[activeIndex]
	if (!file) return
	const res = await fetch(
		`/drop/${data.shareId}/restore/${encodeURIComponent(file.filename)}/${entry.seq}`,
		{ method: "POST" },
	)
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { error?: string } | null
		historyMessage(body?.error ?? "That version could not be restored.")
		return
	}
	// Restoring appends rather than rewinds, so the timeline is longer afterwards.
	location.reload()
}

function versionRow(entry: VersionEntry, isCurrent: boolean): HTMLElement {
	const wrap = document.createElement("div")

	const row = document.createElement("div")
	row.className = isCurrent ? "hv-row current" : "hv-row"
	const seq = document.createElement("span")
	seq.className = "hv-seq"
	seq.textContent = entry.seq === 0 ? "ORIG" : `v${entry.seq}`
	const time = document.createElement("span")
	time.className = "hv-when"
	time.textContent = when(entry.createdAt)
	const tag = document.createElement("span")
	tag.className = entry.label === "model" ? "hv-tag model" : "hv-tag"
	tag.textContent = labelText(entry)
	row.append(seq, time, tag)

	const actions = document.createElement("div")
	actions.className = "hv-actions"
	const file = data.files[activeIndex]
	if (file?.kind === "bpmn") {
		const view = document.createElement("button")
		view.className = "hv-btn"
		view.type = "button"
		view.textContent = "View"
		view.addEventListener("click", () => void previewVersion(entry))
		actions.append(view)
	}
	const restore = document.createElement("button")
	restore.className = "hv-btn"
	restore.type = "button"
	restore.textContent = "Restore"
	restore.addEventListener("click", () => void restoreVersion(entry))
	actions.append(restore)

	wrap.append(row, actions)
	return wrap
}

async function loadHistory(): Promise<void> {
	const file = data.files[activeIndex]
	if (!file || !historyBody) return
	historyMessage("Loading…")
	try {
		const res = await fetch(`/drop/${data.shareId}/history/${encodeURIComponent(file.filename)}`)
		if (!res.ok) {
			historyMessage("No history for this file.")
			return
		}
		const { entries, maxMilestones } = (await res.json()) as {
			entries: VersionEntry[]
			maxMilestones: number
		}
		historyBody.replaceChildren()
		entries.forEach((entry, i) => historyBody.append(versionRow(entry, i === 0)))
		if (historyBound) {
			historyBound.textContent = `The original is kept forever, plus the last ${maxMilestones} milestones. Repeated saves inside an hour count as one.`
		}
	} catch {
		historyMessage("Couldn't load the history. Please try again.")
	}
}

historyBtn?.addEventListener("click", () => {
	if (!historyPanel) return
	historyPanel.hidden = !historyPanel.hidden
	if (!historyPanel.hidden) void loadHistory()
})
document.getElementById("historyClose")?.addEventListener("click", () => {
	if (historyPanel) historyPanel.hidden = true
})
document.getElementById("historyExit")?.addEventListener("click", () => {
	exitVersionPreview()
	const file = data.files[activeIndex]
	if (file?.kind === "bpmn") {
		void fetch(contentUrl(file))
			.then((r) => r.text())
			.then((xml) => renderBpmn(xml))
	}
})

// ── Presence & actions ──────────────────────────────────────────────────────

const presenceEl = document.getElementById("presence") as HTMLElement

/**
 * The live document, replayed from the writer's ops.
 *
 * Created before the socket so `select()` can point it at a file whatever order
 * the two happen to run in — the page renders before the socket opens.
 */
let watcherSend: (message: ClientMessage) => void = () => {
	// Until the socket exists a resync would be sent into nothing. Dropping it is
	// safe: the watcher only asks in response to a message, so there is always a
	// live socket by the time it does.
}
const watcher = new DocWatcher({
	send: (message) => watcherSend(message),
	render: showLiveUpdate,
})

try {
	const proto = location.protocol === "https:" ? "wss" : "ws"
	const ws = new WebSocket(`${proto}://${location.host}/drop/api/presence/${data.shareId}`)
	watcherSend = (message) => {
		if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
	}

	// The heartbeat the room answers without waking up. It is what lets a later
	// alarm notice a socket that has gone quiet — a closed laptop lid sends no
	// close event — so the edit baton is never stuck on a holder who has gone.
	let heartbeat: ReturnType<typeof setInterval> | null = null
	ws.addEventListener("open", () => {
		heartbeat = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) ws.send(PING)
		}, PING_INTERVAL_MS)
	})
	const stopHeartbeat = () => {
		if (heartbeat !== null) clearInterval(heartbeat)
		heartbeat = null
	}
	ws.addEventListener("close", stopHeartbeat)
	ws.addEventListener("error", stopHeartbeat)

	ws.addEventListener("message", (e) => {
		const raw = e.data as string
		if (raw === PONG) return // the auto-response; it carries nothing to render
		let message: ServerMessage
		try {
			message = JSON.parse(raw) as ServerMessage
		} catch {
			return
		}
		if (message.type === "hello" || message.type === "presence") {
			// Saying someone is editing is what makes a diagram changing under the
			// reader's eyes legible rather than unsettling.
			const editing = message.holder === null ? "" : " · 1 EDITING"
			presenceEl.textContent = `${message.viewers} VIEWING${editing}`
			presenceEl.hidden = message.viewers < 1
		}
		handleEditMessage(message)
		watcher.handle(message)
	})
} catch {
	// presence is decorative — ignore failures
}

// ── Edit mode ───────────────────────────────────────────────────────────────

const editBtn = document.getElementById("editBtn") as HTMLButtonElement | null
const doneBtn = document.getElementById("doneBtn") as HTMLButtonElement | null
const localHistoryBtn = document.getElementById("localHistoryBtn") as HTMLButtonElement | null
const localHistoryPanel = document.getElementById("localHistoryPanel") as HTMLElement | null
const localHistoryBody = document.getElementById("localHistoryBody") as HTMLElement | null
const editNotice = document.getElementById("editNotice") as HTMLElement | null
const editNoticeText = document.getElementById("editNoticeText") as HTMLElement | null

/** The editor, once someone has claimed the baton. Null while reading. */
let session: import("./edit-session.js").EditSession | null = null
/** The file the editor is open on, for going back to it afterwards. */
let editingFile: string | null = null
/** Numbers this writer's ops, so a rejection can name the one it refused. */
let opSeq = 0
let noticeTimer: ReturnType<typeof setTimeout> | null = null

function notice(text: string, holdMs = 4_000): void {
	if (!editNotice || !editNoticeText) return
	editNoticeText.textContent = text
	editNotice.hidden = false
	if (noticeTimer !== null) clearTimeout(noticeTimer)
	noticeTimer = setTimeout(() => {
		if (editNotice) editNotice.hidden = true
	}, holdMs)
}

/** Edit is offered for BPMN files of a real drop — the demo has nowhere to save. */
function updateEditAffordance(): void {
	const file = data.files[activeIndex]
	const editable = file?.kind === "bpmn" && data.shareId !== DEMO_SHARE_ID
	if (editBtn) editBtn.hidden = !editable || session !== null
	if (doneBtn) doneBtn.hidden = session === null
	if (localHistoryBtn) localHistoryBtn.hidden = session === null
}

/**
 * Swaps the read-only canvas for an editor, in place.
 *
 * The editor chunk is fetched here and nowhere else, so a reader never
 * downloads it. The view comes across by hand — the whole reason
 * `getViewport`/`setViewport` are public — because being dropped somewhere else
 * in the diagram at the moment you start editing is disorienting.
 */
async function enterEditMode(granted: { filename: string; xml: string }): Promise<void> {
	const viewport = current?.getViewport() ?? { tx: 0, ty: 0, scale: 1 }
	// The watcher and the editor must not both be driving the canvas.
	watcher.watch(null)
	current?.destroy()
	current = null
	viewer.innerHTML = ""

	editingFile = granted.filename
	const { startEditSession } = await import("./edit-session.js")
	session = startEditSession({
		container: viewer,
		xml: granted.xml,
		viewport,
		theme,
		shareId: data.shareId,
		filename: granted.filename,
		sendOp: (op) => {
			opSeq += 1
			watcherSend({ type: "op", seq: opSeq, op })
		},
	})
	localHistoryBody?.replaceChildren(session.historyPanel)
	void session.refreshHistory()
	zoombar.hidden = true
	updateEditAffordance()
}

/** Puts the baton down and goes back to reading. */
function leaveEditMode(): void {
	if (!session) return
	const edited = session.currentXml()
	session.destroy()
	session = null
	localHistoryBody?.replaceChildren()
	if (localHistoryPanel) localHistoryPanel.hidden = true

	// Back to the reading view, showing what was just edited rather than what the
	// server has: the room is the authority, the editor was in step with it, and
	// D1 does not catch up until the autosave checkpoint. `activeIndex` is
	// cleared so `select` does not treat this as a no-op.
	const index = data.files.findIndex((f) => f.filename === editingFile)
	editingFile = null
	activeIndex = -1
	updateEditAffordance()
	void select(index >= 0 ? index : 0, index >= 0 ? edited : undefined)
}

/** Why the baton went away, in the writer's words. */
const REVOKE_TEXT: Record<string, string> = {
	released: "You are reading again.",
	idle: "Editing ended — the drop was idle, so anyone can take it now.",
	disconnected: "Editing ended — the connection dropped.",
}

/**
 * Everything the room says that concerns the writer rather than the watcher.
 *
 * Kept apart from `DocWatcher` on purpose: the watcher's job is to keep a
 * read-only document correct, and while this tab holds the baton it is not
 * watching at all — the editor is the thing driving the canvas.
 */
function handleEditMessage(message: ServerMessage): void {
	switch (message.type) {
		case "granted":
			void enterEditMode(message)
			return
		case "denied":
			notice("Someone else is editing this drop right now.")
			return
		case "warning":
			notice(
				`Editing ends in ${message.secondsLeft}s unless you change something.`,
				message.secondsLeft * 1000,
			)
			return
		case "revoked":
			notice(REVOKE_TEXT[message.reason] ?? "Editing ended.")
			leaveEditMode()
			return
		case "rejected":
			// The editor applied this locally already, so the local document is now
			// ahead of the truth. Rather than guess at an inverse, take the room's.
			if (session && editingFile) {
				notice(`That change was not saved: ${message.detail ?? message.reason}.`)
				watcherSend({ type: "resync", filename: editingFile })
			} else if (message.reason === "no-document") {
				notice("This file cannot be edited.")
			}
			return
		case "state":
			if (session && message.filename === editingFile) session.replace(message.xml)
			return
		default:
			return
	}
}

editBtn?.addEventListener("click", () => {
	const file = data.files[activeIndex]
	if (!file) return
	watcherSend({ type: "claim", filename: file.filename })
})

doneBtn?.addEventListener("click", () => {
	watcherSend({ type: "release" })
	leaveEditMode()
})

localHistoryBtn?.addEventListener("click", () => {
	if (!localHistoryPanel) return
	localHistoryPanel.hidden = !localHistoryPanel.hidden
	if (!localHistoryPanel.hidden) void session?.refreshHistory()
})
document.getElementById("localHistoryClose")?.addEventListener("click", () => {
	if (localHistoryPanel) localHistoryPanel.hidden = true
})

document.getElementById("copyLink")?.addEventListener("click", async () => {
	await navigator.clipboard.writeText(location.href)
	const btn = document.getElementById("copyLink") as HTMLButtonElement
	btn.textContent = "Copied"
	setTimeout(() => {
		btn.textContent = "Copy link"
	}, 1500)
})

// ── Report abuse ────────────────────────────────────────────────────────────

const dialog = document.getElementById("reportDialog") as HTMLDialogElement
document.getElementById("reportBtn")?.addEventListener("click", () => dialog.showModal())
document.getElementById("reportSubmit")?.addEventListener("click", (e) => {
	e.preventDefault()
	const reason = (document.getElementById("reportReason") as HTMLSelectElement).value
	const details = (document.getElementById("reportDetails") as HTMLTextAreaElement).value
	void fetch("/drop/api/reports", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ shareId: data.shareId, reason, details }),
	})
	dialog.close()
	alert("Thanks — your report has been submitted.")
})

// ── Start ───────────────────────────────────────────────────────────────────
// Last, deliberately: `select` touches the panels declared above it in this
// file, and a `const` is not readable before its declaration has run.

void select(data.primaryIndex)
