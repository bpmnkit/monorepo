import { injectUiStyles } from "@bpmnkit/ui"
import { ValidationError, validateFile } from "../lib/validate.js"
import { MAX_FILES_PER_DROP } from "../shared/constants.js"

injectUiStyles()

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const dropzone = $("dropzone")
const fileInput = $<HTMLInputElement>("fileInput")
const errorsBox = $("errors")
const result = $("result")
const shareUrl = $<HTMLInputElement>("shareUrl")
const openBtn = $<HTMLAnchorElement>("openBtn")
const preview = $<HTMLIFrameElement>("preview")
const copyBtn = $<HTMLButtonElement>("copyBtn")
const overlay = $("dropOverlay")

function showErrors(messages: string[]): void {
	errorsBox.innerHTML = `<strong>Couldn't upload:</strong><ul>${messages
		.map((m) => `<li>${escapeText(m)}</li>`)
		.join("")}</ul>`
	errorsBox.classList.remove("hidden")
}

function escapeText(s: string): string {
	const div = document.createElement("div")
	div.textContent = s
	return div.innerHTML
}

async function handleFiles(files: File[]): Promise<void> {
	errorsBox.classList.add("hidden")
	if (files.length === 0) return
	if (files.length > MAX_FILES_PER_DROP) {
		showErrors([`Too many files — up to ${MAX_FILES_PER_DROP} allowed.`])
		return
	}

	// Validate every file in the browser first so problems surface instantly.
	const problems: string[] = []
	for (const file of files) {
		try {
			validateFile(file.name, await file.text())
		} catch (err) {
			problems.push(err instanceof ValidationError ? err.message : `${file.name}: unreadable`)
		}
	}
	if (problems.length > 0) {
		showErrors(problems)
		return
	}

	const body = new FormData()
	for (const file of files) body.append("files", file, file.name)

	dropzone.classList.add("drag")
	try {
		const res = await fetch("/drop/api/drops", { method: "POST", body })
		const data = (await res.json()) as { url?: string; error?: string; details?: string[] }
		if (!res.ok) {
			showErrors(data.details ?? [data.error ?? "Upload failed."])
			return
		}
		showResult(data.url as string)
	} catch {
		showErrors(["Network error — please try again."])
	} finally {
		dropzone.classList.remove("drag")
	}
}

function showResult(path: string): void {
	const absolute = new URL(path, location.origin).href
	shareUrl.value = absolute
	openBtn.href = path
	preview.src = path
	result.classList.remove("hidden")
	result.scrollIntoView({ behavior: "smooth", block: "nearest" })
}

// ── Click / keyboard / file picker ──────────────────────────────────────────

dropzone.addEventListener("click", () => fileInput.click())
dropzone.addEventListener("keydown", (e) => {
	if (e.key === "Enter" || e.key === " ") {
		e.preventDefault()
		fileInput.click()
	}
})
fileInput.addEventListener("change", () => {
	if (fileInput.files) void handleFiles([...fileInput.files])
})

// ── Full-page drag & drop ───────────────────────────────────────────────────

let dragDepth = 0
function setOverlay(show: boolean): void {
	overlay.hidden = !show
	document.body.classList.toggle("dragging", show)
}
function hasFiles(e: DragEvent): boolean {
	return Array.from(e.dataTransfer?.types ?? []).includes("Files")
}

window.addEventListener("dragenter", (e) => {
	if (!hasFiles(e)) return
	dragDepth++
	setOverlay(true)
})
window.addEventListener("dragover", (e) => {
	if (hasFiles(e)) e.preventDefault()
})
window.addEventListener("dragleave", () => {
	dragDepth = Math.max(0, dragDepth - 1)
	if (dragDepth === 0) setOverlay(false)
})
window.addEventListener("drop", (e) => {
	e.preventDefault()
	dragDepth = 0
	setOverlay(false)
	const dropped = e.dataTransfer?.files
	if (dropped?.length) void handleFiles([...dropped])
})

// ── Paste BPMN/DMN/Form content anywhere ────────────────────────────────────

document.addEventListener("paste", (e) => {
	const target = e.target
	if (target instanceof Element && target.closest("input, textarea")) return
	const text = e.clipboardData?.getData("text/plain")?.trim()
	if (!text) return
	const looksLikeDiagram = /^</.test(text) || /^[{[]/.test(text)
	if (!looksLikeDiagram) return
	e.preventDefault()
	const name = /^[{[]/.test(text) ? "pasted.json" : "pasted.xml"
	void handleFiles([new File([text], name, { type: "text/plain" })])
})

// ── Copy ────────────────────────────────────────────────────────────────────

copyBtn.addEventListener("click", async () => {
	await navigator.clipboard.writeText(shareUrl.value)
	copyBtn.textContent = "Copied"
	setTimeout(() => {
		copyBtn.textContent = "Copy"
	}, 1500)
})
