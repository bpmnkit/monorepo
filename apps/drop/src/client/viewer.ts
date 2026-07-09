import { BpmnCanvas } from "@bpmnkit/canvas"
import { Bpmn, compactify } from "@bpmnkit/core"
import { DmnViewer } from "@bpmnkit/plugins/dmn-viewer"
import { FormViewer } from "@bpmnkit/plugins/form-viewer"
import { injectUiStyles } from "@bpmnkit/ui"
import type { FileKind } from "../shared/constants.js"

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
let current: BpmnCanvas | null = null
let activeIndex = -1
let scale = 1

function contentUrl(file: DropFile, format?: "json"): string {
	const base = `/drop/${data.shareId}/f/${encodeURIComponent(file.filename)}`
	return format ? `${base}?format=json` : base
}

function message(text: string): void {
	viewer.innerHTML = `<div class="viewer-msg">${text.replace(/[<>&]/g, (c) => `&#${c.charCodeAt(0)};`)}</div>`
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

async function select(index: number): Promise<void> {
	if (index === activeIndex) return
	const file = data.files[index]
	if (!file) return
	activeIndex = index

	for (const tab of document.querySelectorAll<HTMLElement>(".ed-tab")) {
		tab.classList.toggle("active", Number(tab.dataset.index) === index)
	}
	dlOriginal.href = contentUrl(file)
	dlOriginal.setAttribute("download", file.filename)
	dlJson.href = contentUrl(file, "json")
	dlJson.setAttribute("download", `${file.filename}.json`)

	current?.destroy()
	current = null
	message("Loading…")
	try {
		if (file.kind === "bpmn") {
			await renderBpmn(await (await fetch(contentUrl(file))).text())
		} else if (file.kind === "dmn") {
			renderDmn(await (await fetch(contentUrl(file, "json"))).text())
		} else {
			renderForm(await (await fetch(contentUrl(file, "json"))).text())
		}
	} catch {
		message("Failed to load this file.")
	}
}

for (const tab of document.querySelectorAll<HTMLElement>(".tab")) {
	tab.addEventListener("click", () => void select(Number(tab.dataset.index)))
}

void select(data.primaryIndex)

// ── Zoom controls (BPMN canvas only) ────────────────────────────────────────

document.getElementById("zoomIn")?.addEventListener("click", () => current?.zoom(scale * 1.2))
document.getElementById("zoomOut")?.addEventListener("click", () => current?.zoom(scale / 1.2))
document.getElementById("zoomReset")?.addEventListener("click", () => current?.resetZoom())
document.getElementById("zoomFit")?.addEventListener("click", () => current?.zoom("fit"))

// ── Presence & actions ──────────────────────────────────────────────────────

const presenceEl = document.getElementById("presence") as HTMLElement
try {
	const proto = location.protocol === "https:" ? "wss" : "ws"
	const ws = new WebSocket(`${proto}://${location.host}/drop/api/presence/${data.shareId}`)
	ws.addEventListener("message", (e) => {
		const { viewers } = JSON.parse(e.data as string) as { viewers: number }
		presenceEl.textContent = `${viewers} viewing`
		presenceEl.hidden = viewers < 1
	})
} catch {
	// presence is decorative — ignore failures
}

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
