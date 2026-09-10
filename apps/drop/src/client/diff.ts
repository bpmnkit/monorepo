import { BpmnCanvas } from "@bpmnkit/canvas"
import type { BpmnDiffResult } from "@bpmnkit/core"
import { createBpmnDiff } from "@bpmnkit/plugins/diff"
import { injectUiStyles } from "@bpmnkit/ui"

interface DiffSide {
	shareId: string
	files: string[]
}
interface DiffData {
	left: DiffSide
	right: DiffSide
}

injectUiStyles()

const data = JSON.parse(
	(document.getElementById("diff-data") as HTMLScriptElement).textContent ?? "{}",
) as DiffData

const leftPane = document.getElementById("leftPane") as HTMLDivElement
const rightPane = document.getElementById("rightPane") as HTMLDivElement
const leftPick = document.getElementById("leftPick") as HTMLSelectElement
const rightPick = document.getElementById("rightPick") as HTMLSelectElement
const summary = document.getElementById("diffSummary") as HTMLElement

// Follow the page theme, not the OS — the canvas would otherwise go dark on a
// light page. Same rule the single-diagram viewer follows.
const theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"

let left: BpmnCanvas | null = null
let right: BpmnCanvas | null = null

function fileUrl(side: DiffSide, index: number): string {
	const filename = side.files[index]
	if (filename === undefined) throw new Error("No such file in this drop")
	return `/drop/${side.shareId}/f/${encodeURIComponent(filename)}`
}

async function fetchXml(side: DiffSide, index: number): Promise<string> {
	const res = await fetch(fileUrl(side, index))
	if (!res.ok) throw new Error(`Could not load ${side.files[index]} (${res.status})`)
	return res.text()
}

function describe(result: BpmnDiffResult): string {
	if (result.total === 0) return "No differences"
	const parts: string[] = []
	if (result.added.length > 0) parts.push(`${result.added.length} added`)
	if (result.removed.length > 0) parts.push(`${result.removed.length} removed`)
	if (result.changed.length > 0) parts.push(`${result.changed.length} changed`)
	if (result.moved.length > 0) parts.push(`${result.moved.length} moved`)
	return parts.join(" · ")
}

function fail(message: string): void {
	summary.textContent = message
	for (const pane of [leftPane, rightPane]) {
		pane.replaceChildren()
		const msg = document.createElement("div")
		msg.className = "viewer-msg"
		msg.textContent = message
		pane.appendChild(msg)
	}
}

async function render(): Promise<void> {
	left?.destroy()
	right?.destroy()
	left = null
	right = null
	summary.textContent = "Comparing…"

	let leftXml: string
	let rightXml: string
	try {
		;[leftXml, rightXml] = await Promise.all([
			fetchXml(data.left, leftPick.selectedIndex),
			fetchXml(data.right, rightPick.selectedIndex),
		])
	} catch (err) {
		fail(err instanceof Error ? err.message : "Could not load these diagrams")
		return
	}

	leftPane.replaceChildren()
	rightPane.replaceChildren()

	const diff = createBpmnDiff({
		onDiff: (result) => {
			summary.textContent = describe(result)
		},
	})

	try {
		left = new BpmnCanvas({
			container: leftPane,
			xml: leftXml,
			theme,
			grid: true,
			fit: "contain",
			plugins: [diff.before],
		})
		right = new BpmnCanvas({
			container: rightPane,
			xml: rightXml,
			theme,
			grid: true,
			fit: "contain",
			plugins: [diff.after],
		})
	} catch (err) {
		fail(err instanceof Error ? err.message : "Could not render these diagrams")
	}
}

// A drop can hold several diagrams; default to the pair whose filenames match,
// which is what two versions of the same process look like.
function selectMatchingPair(): void {
	const shared = data.left.files.findIndex((name) => data.right.files.includes(name))
	if (shared < 0) return
	const name = data.left.files[shared]
	if (name === undefined) return
	leftPick.selectedIndex = shared
	rightPick.selectedIndex = data.right.files.indexOf(name)
}

leftPick.addEventListener("change", () => void render())
rightPick.addEventListener("change", () => void render())

selectMatchingPair()
void render()
