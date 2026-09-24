import { BpmnCanvas, type ViewportState } from "@bpmnkit/canvas"
import { Bpmn, type BpmnDefinitions, compactify, sha256Hex } from "@bpmnkit/core"
import { DmnViewer } from "@bpmnkit/plugins/dmn-viewer"
import { FormViewer } from "@bpmnkit/plugins/form-viewer"
import { injectUiStyles } from "@bpmnkit/ui"
import type { ReviewResult, Suggestion } from "../lib/review.js"
import { AI_CODE_STORAGE_KEY, DEMO_SHARE_ID, type FileKind } from "../shared/constants.js"
import { type FeelDocument, feelLabel, serializeFeelDocument } from "../shared/feel-doc.js"
import {
	type ClientMessage,
	PING,
	PING_INTERVAL_MS,
	PONG,
	type ServerMessage,
} from "../shared/room-protocol.js"
import { CommentsPanel } from "./comments.js"
import { type FeelEditor, mountFeelEditor } from "./feel-edit.js"
import { renderFeelDocument } from "./feel-view.js"
import { type Change, DocWatcher, type WatcherDoc } from "./watcher.js"

interface DropFile {
	filename: string
	kind: FileKind
	name: string | null
	decisionIds: string[]
	/** BPMN process count. The editor addresses one; several means read-only. */
	processes: number
}
interface DropData {
	shareId: string
	files: DropFile[]
	primaryIndex: number
	/** Pinned by an operator: never expires, and read-only for the same reason. */
	pinned?: boolean
	/** Turnstile site key, when the deployment challenges claims. Absent = it does not. */
	turnstileKey?: string
}

/** The slice of Turnstile's global this page uses. */
interface Turnstile {
	render(
		el: HTMLElement,
		options: {
			sitekey: string
			callback(token: string): void
			"error-callback"?(): void
			"expired-callback"?(): void
			theme?: "light" | "dark"
		},
	): string
	remove(widgetId: string): void
}

injectUiStyles()

const data = JSON.parse(
	(document.getElementById("drop-data") as HTMLScriptElement).textContent ?? "{}",
) as DropData

/** The built-in demo: served from memory, with no row behind it to write to. */
const isDemo = data.shareId === DEMO_SHARE_ID

/** Where a new drop is created. The same endpoint the drop zone posts to. */
const DROP_UPLOAD_PATH = "/drop/api/drops"

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

/** An element's name for a comment anchor, falling back to its id. */
function elementLabel(canvas: BpmnCanvas, id: string): string {
	const el = canvas.getElement(id)
	const name = el && "shape" in el ? (el.flowElement?.name ?? el.annotation?.text) : undefined
	return name?.trim() || id
}

/** `preview` marks an older version on the canvas, for how comments describe their anchors. */
async function renderBpmn(xml: string, preview = false): Promise<void> {
	viewer.innerHTML = ""
	// Frame the whole diagram (fit-to-viewport), but never enlarge a small
	// diagram past 100% — the first auto-fit reports its scale and we cap it.
	let capped = false
	const canvas = new BpmnCanvas({ container: viewer, theme, grid: true, fit: "contain" })
	current = canvas
	// Every load and every plane change clears the canvas's overlays, so the
	// comment markers are put back on each — including a watcher's live update.
	let shown: BpmnDefinitions | null = null
	canvas.on("diagram:load", (defs) => {
		shown = defs
		comments.showOn(canvas, defs, preview)
	})
	canvas.on("plane:change", () => comments.showOn(canvas, shown, preview))
	canvas.on("element:click", (id: string) => {
		if (comments.isOpen()) comments.pick(id, elementLabel(canvas, id))
	})
	canvas.load(xml)
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

/** The statement on the active tab, once its tab has loaded. */
let feelDoc: FeelDocument | null = null
/** The hash of that statement as stored, which the next save is made against. */
let feelBase: string | null = null

async function renderFeel(json: string): Promise<void> {
	zoombar.hidden = true
	const doc = JSON.parse(json) as FeelDocument
	feelDoc = doc
	// A FEEL drop's stored bytes are always its document's canonical form — the
	// upload stores that and so does a save — so the hash the server holds can be
	// recomputed here instead of being carried in a header.
	feelBase = await sha256Hex(serializeFeelDocument(doc))
	renderFeelDocument(viewer, doc)
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
		// With the comments panel open a click picks what to comment on; jumping
		// to another tab under the reader would lose the comment they were starting.
		if (comments.isOpen()) return
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
	comments.setFile(file)
	// Only BPMN has an op vocabulary, so a DMN or form tab watches nothing.
	watcher.watch(file.kind === "bpmn" ? file.filename : null)
	feelEditor?.destroy()
	feelEditor = null
	feelDoc = null
	feelBase = null
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
		} else if (file.kind === "feel") {
			await renderFeel(await (await fetch(contentUrl(file, "json"))).text())
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
		await renderBpmn(xml, true)
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

// ── Comments ────────────────────────────────────────────────────────────────

const commentsPanel = document.getElementById("commentsPanel") as HTMLElement
const mentionNotice = document.getElementById("mentionNotice") as HTMLElement

const comments = new CommentsPanel({
	shareId: data.shareId,
	// The same two carve-outs the room makes for edits, for the same reasons.
	readOnly: isDemo
		? "the demo cannot be annotated — take a copy to comment on one you own"
		: data.pinned
			? "this drop is pinned by an operator"
			: null,
	toggle: document.getElementById("commentsBtn") as HTMLButtonElement,
	panel: commentsPanel,
	list: document.getElementById("commentsBody") as HTMLElement,
	compose: document.getElementById("commentsCompose") as HTMLElement,
	notice: {
		box: mentionNotice,
		text: document.getElementById("mentionText") as HTMLElement,
		open: document.getElementById("mentionOpen") as HTMLButtonElement,
	},
	challenge: (title) => challenge(title),
	announceName: (name) => watcherSend({ type: "name", name }),
	onOpen: () => {
		for (const panel of [aiPanel, historyPanel, localHistoryPanel]) if (panel) panel.hidden = true
	},
})
document.getElementById("commentsClose")?.addEventListener("click", () => comments.close())
document.getElementById("mentionDismiss")?.addEventListener("click", () => {
	mentionNotice.hidden = true
})
void comments.load()

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
			presenceEl.title = message.names.join(", ")
			comments.setPresentNames(message.names)
			// Said once per connection, so a reconnect is named again too.
			if (message.type === "hello" && comments.displayName) {
				watcherSend({ type: "name", name: comments.displayName })
			}
		}
		if (message.type === "comment") comments.receive(message.comment)
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
const editorLangSelect = document.getElementById("editorLang") as HTMLSelectElement | null
const localHistoryPanel = document.getElementById("localHistoryPanel") as HTMLElement | null
const localHistoryBody = document.getElementById("localHistoryBody") as HTMLElement | null
const editNotice = document.getElementById("editNotice") as HTMLElement | null
const editNoticeText = document.getElementById("editNoticeText") as HTMLElement | null
const turnstileDialog = document.getElementById("turnstileDialog") as HTMLDialogElement | null
const turnstileWidget = document.getElementById("turnstileWidget") as HTMLElement | null
const turnstileTitle = document.getElementById("turnstileTitle") as HTMLElement | null
const turnstileError = document.getElementById("turnstileError") as HTMLElement | null
document
	.getElementById("turnstileCancel")
	?.addEventListener("click", () => turnstileDialog?.close())

/** The rendered challenge, so it can be torn down rather than stacking up. */
let widgetId: string | null = null

/** The editor, once someone has claimed the baton. Null while reading. */
let session: import("./edit-session.js").EditSession | null = null
/** The editor chunk, once fetched — it also carries the language list and loaders. */
let editModule: typeof import("./edit-session.js") | null = null
/** The language the editor is built in. The page around it stays English. */
let editorLang: Awaited<ReturnType<typeof import("./edit-session.js").loadEditorLocale>> = {
	code: "en",
}
/** The statement editor, when a FEEL tab is open for editing. */
let feelEditor: FeelEditor | null = null
/** The file the editor is open on, for going back to it afterwards. */
let editingFile: string | null = null
/** Set when we let the baton go ourselves and have already said why. */
let quietRelease = false
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

/**
 * Why this file cannot be edited, or null when it can.
 *
 * The same three rules the room enforces, asked here so the button can say no
 * before the click rather than after it. The room is what actually decides —
 * this is the courtesy, not the control.
 */
function readOnlyReason(file: DropFile | undefined): string | null {
	if (!file || (file.kind !== "bpmn" && file.kind !== "feel")) return null
	if (isDemo) return "The demo cannot be edited — take a copy to make one you own."
	if (data.pinned) return "This drop is pinned by an operator and is read-only."
	if (file.kind === "bpmn" && file.processes !== 1) {
		return "The editor handles one process at a time, and this file has several."
	}
	return null
}

/**
 * Puts the topbar into reading, editing, or cannot-edit.
 *
 * The demo gets a working button rather than a disabled one: there *is*
 * something useful to do with it, which is to take a copy you own.
 */
function updateEditAffordance(): void {
	const file = data.files[activeIndex]
	const isBpmn = file?.kind === "bpmn"
	const isFeel = file?.kind === "feel"
	const blocked = readOnlyReason(file)
	const editing = session !== null || feelEditor !== null

	if (editBtn) {
		editBtn.hidden = !(isBpmn || isFeel) || editing
		editBtn.textContent = isDemo && isBpmn ? "Edit a copy" : "Edit"
		// Disabled with a reason beats hidden: a button that is not there looks
		// like a feature you do not have, rather than one this file cannot use.
		// A statement is the exception — it opens whatever the drop's state,
		// because trying it with your own numbers writes nothing, and only Save
		// is refused.
		editBtn.disabled = blocked !== null && !isDemo && !isFeel
		editBtn.title = isFeel ? "" : (blocked ?? "")
	}
	if (doneBtn) doneBtn.hidden = !editing
	if (localHistoryBtn) localHistoryBtn.hidden = session === null
	if (editorLangSelect) editorLangSelect.hidden = session === null
}

/**
 * Uploads the demo's contents as a new drop and goes there.
 *
 * The demo has no row to write to, so "edit" has to mean "make one you own" —
 * which the existing upload endpoint already does, with no new server code.
 */
async function dropACopy(file: DropFile): Promise<void> {
	notice("Making you a copy…", 10_000)
	try {
		const xml = await (await fetch(contentUrl(file))).text()
		const body = new FormData()
		body.append("files", new File([xml], file.filename, { type: "application/xml" }), file.filename)
		const res = await fetch(DROP_UPLOAD_PATH, { method: "POST", body })
		if (!res.ok) throw new Error(String(res.status))
		const created = (await res.json()) as { url: string }
		location.href = created.url
	} catch {
		notice("Couldn't make a copy. Please try again.")
	}
}

// ── Editing a statement ─────────────────────────────────────────────────────
// No baton and no ops: a statement is not a document the room can advance one
// change at a time, it is two boxes of text. So editing it is local until the
// writer says otherwise, and a save is one request that replaces the whole
// thing — see `routes/feel.ts` for what that request has to get past.

/** Scopes this tab's saves, so an hour of them collapses into one milestone. */
const FEEL_SESSION = `feel-${Math.random().toString(36).slice(2, 10)}`

function enterFeelEdit(file: DropFile): void {
	const doc = feelDoc
	if (!doc) return
	feelEditor = mountFeelEditor({
		container: viewer,
		doc,
		filename: file.filename,
		readOnly: readOnlyReason(file),
		save: (next) => saveFeel(file, next),
		shareCopy: (next) => shareFeelCopy(file, next),
	})
	updateEditAffordance()
}

/** Back to reading, on whatever the drop says now rather than on the boxes. */
function leaveFeelEdit(): void {
	if (!feelEditor) return
	const unsaved = feelEditor.dirty()
	feelEditor.destroy()
	feelEditor = null
	updateEditAffordance()
	if (feelDoc) renderFeelDocument(viewer, feelDoc)
	if (unsaved) notice("Your changes were discarded — they were never saved.")
}

/**
 * Writes the statement to the drop, or rejects with what to tell the writer.
 *
 * The challenge sits here rather than on Edit: playing with somebody's
 * expression never leaves the browser, and asking a person to prove they are
 * one for that would be a toll on the thing the feature is for.
 */
async function saveFeel(file: DropFile, doc: FeelDocument): Promise<void> {
	const verified = await challenge()
	if (!verified.ok) {
		throw new Error(
			verified.reason === "cancelled"
				? "Saving needs that check — press Save again to retry."
				: "Couldn't load the human check. Reload the page, or allow challenges.cloudflare.com.",
		)
	}

	const res = await fetch(`/drop/${data.shareId}/feel/${encodeURIComponent(file.filename)}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			document: doc,
			baseHash: feelBase,
			sessionId: FEEL_SESSION,
			...(verified.token ? { token: verified.token } : {}),
		}),
	})
	const payload = (await res.json().catch(() => null)) as { hash?: string; error?: string } | null
	if (!res.ok || !payload?.hash) throw new Error(payload?.error ?? "That could not be saved.")

	feelDoc = doc
	feelBase = payload.hash
	// A statement's name is its expression, and the expression just changed — so
	// the tab that carries it has to say the new one.
	file.name = feelLabel(doc)
	const tab = document.querySelector(`.ed-tab[data-index="${activeIndex}"] .ed-tab-name`)
	if (tab) tab.textContent = file.name
}

/** Posts the statement as a drop of its own and goes there — the copy you kept. */
async function shareFeelCopy(file: DropFile, doc: FeelDocument): Promise<void> {
	const body = new FormData()
	const copy = new File([JSON.stringify(doc, null, 2)], file.filename, {
		type: "application/json",
	})
	body.append("files", copy, copy.name)
	const res = await fetch(DROP_UPLOAD_PATH, { method: "POST", body })
	const payload = (await res.json().catch(() => null)) as {
		url?: string
		error?: string
		details?: string[]
	} | null
	if (!res.ok || !payload?.url) {
		throw new Error(payload?.details?.join("\n") ?? payload?.error ?? "That could not be shared.")
	}
	location.href = payload.url
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
	// Fetched before anything is torn down, because it can fail to arrive: a
	// deploy between this page loading and this click leaves the cached bundle
	// asking for a chunk hash that no longer exists. Loading first means a
	// failure costs nothing — the reader keeps the canvas they had.
	try {
		editModule = await import("./edit-session.js")
		editorLang = await editModule.loadEditorLocale()
	} catch {
		// Hand the baton straight back, or the drop stays locked by a tab that
		// never got an editor. The release earns a `revoked` whose own message
		// would otherwise replace this one — the reason is what matters here.
		quietRelease = true
		watcherSend({ type: "release" })
		notice("Couldn't load the editor. Reload the page and try again.", 8_000)
		return
	}

	const viewport = current?.getViewport() ?? { tx: 0, ty: 0, scale: 1 }
	// The watcher and the editor must not both be driving the canvas.
	watcher.watch(null)
	comments.showOn(null, null)
	current?.destroy()
	current = null
	viewer.innerHTML = ""

	editingFile = granted.filename
	openSession(editModule, granted.filename, granted.xml, viewport)
	fillLanguagePicker(editModule)
	zoombar.hidden = true
	updateEditAffordance()
}

/** Builds the editor on `viewer` in the current language. */
function openSession(
	mod: typeof import("./edit-session.js"),
	filename: string,
	xml: string,
	viewport: ViewportState,
): void {
	// `lang` on the editor alone: it is what speaks the language, not the page.
	// It also makes Japanese and Chinese pick their own forms of shared glyphs.
	viewer.lang = editorLang.code
	session = mod.startEditSession({
		container: viewer,
		xml,
		viewport,
		theme,
		shareId: data.shareId,
		filename,
		translate: editorLang.translate,
		sendOp: (op) => {
			opSeq += 1
			watcherSend({ type: "op", seq: opSeq, op })
		},
	})
	localHistoryBody?.replaceChildren(session.historyPanel)
	void session.refreshHistory()
}

/** Lists the editor's languages, once, each in its own name. */
function fillLanguagePicker(mod: typeof import("./edit-session.js")): void {
	if (!editorLangSelect) return
	if (editorLangSelect.options.length === 0) {
		for (const { code, name } of mod.EDITOR_LANGUAGES) {
			editorLangSelect.append(new Option(name, code))
		}
	}
	editorLangSelect.value = editorLang.code
}

/**
 * A new language rebuilds the editor in place — same document, same view, same
 * baton. Its strings are fixed when it is built, and a rebuild sends nothing to
 * the room: loading is not an edit.
 */
editorLangSelect?.addEventListener("change", () => {
	const mod = editModule
	const code = editorLangSelect.value
	if (!mod) return
	mod.storeEditorLocale(code)
	void mod.loadEditorLocale(code).then((lang) => {
		editorLang = lang
		if (!session || editingFile === null) return
		const xml = session.currentXml()
		const viewport = session.viewport()
		session.destroy()
		viewer.innerHTML = ""
		openSession(mod, editingFile, xml, viewport)
	})
})

/** Puts the baton down and goes back to reading. */
function leaveEditMode(): void {
	if (!session) return
	const edited = session.currentXml()
	session.destroy()
	session = null
	viewer.removeAttribute("lang")
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
			if (quietRelease && message.reason === "released") quietRelease = false
			else notice(REVOKE_TEXT[message.reason] ?? "Editing ended.")
			leaveEditMode()
			return
		case "rejected":
			if (message.reason === "unverified") {
				notice("That check did not go through. Try Edit again.")
				return
			}
			if (message.reason === "read-only") {
				// The room decides, and it says why — the button's own check is only
				// a courtesy and can be out of date with what the server believes.
				notice(message.detail ?? "This file cannot be edited.")
				return
			}
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

/**
 * The outcome of asking someone to prove they are a person.
 *
 * Three outcomes, not two, and the third is the one worth naming: the challenge
 * could not be *shown*. An extension that blocks challenges.cloudflare.com, or
 * a network that drops it, would otherwise leave Edit doing nothing at all —
 * silently, because there is no token and no error either.
 */
type ChallengeResult =
	| { ok: true; token: string | null }
	| { ok: false; reason: "cancelled" | "unavailable" }

/**
 * Gets a Turnstile token, when the deployment asks for one.
 *
 * The widget is rendered on Edit rather than sitting on the page: the
 * overwhelming majority of people who open a drop never edit it, and a
 * challenge to look at for a diagram they came to read is a worse page for no
 * benefit. With no key configured it resolves immediately with no token, so the
 * whole thing disappears from a deployment that does not use it.
 */
function challenge(title = "One check before you edit"): Promise<ChallengeResult> {
	const sitekey = data.turnstileKey
	if (!sitekey) return Promise.resolve({ ok: true, token: null })

	const api = (globalThis as { turnstile?: Turnstile }).turnstile
	if (!api || !turnstileDialog || !turnstileWidget) {
		return Promise.resolve({ ok: false, reason: "unavailable" })
	}

	return new Promise((resolve) => {
		let settled = false
		const finish = (result: ChallengeResult) => {
			if (settled) return
			settled = true
			if (widgetId) api.remove(widgetId)
			widgetId = null
			turnstileDialog.close()
			resolve(result)
		}

		if (turnstileError) turnstileError.hidden = true
		if (turnstileTitle) turnstileTitle.textContent = title
		turnstileWidget.replaceChildren()
		turnstileDialog.showModal()
		// Cancelling is the escape hatch for a challenge that will not resolve —
		// Escape closes the dialog, and `close` is what both paths end at.
		turnstileDialog.addEventListener("close", () => finish({ ok: false, reason: "cancelled" }), {
			once: true,
		})

		widgetId = api.render(turnstileWidget, {
			sitekey,
			theme,
			callback: (token) => finish({ ok: true, token }),
			"error-callback": () => {
				if (turnstileError) turnstileError.hidden = false
			},
			"expired-callback": () => {
				if (turnstileError) turnstileError.hidden = false
			},
		})
	})
}

editBtn?.addEventListener("click", () => {
	const file = data.files[activeIndex]
	if (!file) return
	// A statement needs neither the baton nor the challenge to open: it opens
	// locally, and the challenge is on the save.
	if (file.kind === "feel") return enterFeelEdit(file)
	if (isDemo) return void dropACopy(file)
	void challenge().then((result) => {
		if (!result.ok) {
			// Cancelling is a decision and needs no comment; a challenge that could
			// not be shown does, or Edit is a button that does nothing.
			if (result.reason === "unavailable") {
				notice(
					"Couldn't load the human check. Reload the page, or allow challenges.cloudflare.com.",
					8_000,
				)
			}
			return
		}
		const token = result.token
		watcherSend({ type: "claim", filename: file.filename, ...(token ? { token } : {}) })
	})
})

doneBtn?.addEventListener("click", () => {
	if (feelEditor) return leaveFeelEdit()
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
