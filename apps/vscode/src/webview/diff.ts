/**
 * The visual-diff webview: two canvases, one comparison.
 *
 * `createBpmnDiff()` produces a *pair* of plugins that keep their viewports in
 * step, so panning one pane pans the other — which is what makes a moved
 * element read as moved rather than as two unrelated pictures.
 */

import { BpmnCanvas } from "@bpmnkit/canvas"
import type { BpmnDiffResult } from "@bpmnkit/core"
import { createBpmnDiff } from "@bpmnkit/plugins/diff"
import { injectUiStyles } from "@bpmnkit/ui"
import type { HostMessage, ViewerTheme } from "../shared/protocol.js"
import { applyTheme, onHostMessage, ready, reportError } from "./vscode-api.js"

injectUiStyles()

const before = document.getElementById("before") as HTMLDivElement
const after = document.getElementById("after") as HTMLDivElement
const summary = document.getElementById("summary") as HTMLElement
const beforeLabel = document.getElementById("beforeLabel") as HTMLElement
const afterLabel = document.getElementById("afterLabel") as HTMLElement

let left: BpmnCanvas | null = null
let right: BpmnCanvas | null = null
let theme: ViewerTheme = "dark"

/** The counts, in the order a reviewer reads them: what is new, then what went. */
function describe(result: BpmnDiffResult): string {
	if (result.total === 0) return "No differences"
	const parts = [
		result.added.length > 0 ? `${result.added.length} added` : null,
		result.removed.length > 0 ? `${result.removed.length} removed` : null,
		result.changed.length > 0 ? `${result.changed.length} changed` : null,
		result.moved.length > 0 ? `${result.moved.length} moved` : null,
	].filter((part): part is string => part !== null)
	// Differences on a plane the canvas is not showing are the diff plugin's own
	// legend to report; it knows which plane is on screen and this does not.
	return parts.join(" · ")
}

function render(message: Extract<HostMessage, { type: "diff" }>): void {
	theme = message.theme
	applyTheme(theme)
	beforeLabel.textContent = message.beforeLabel
	afterLabel.textContent = message.afterLabel

	left?.destroy()
	right?.destroy()
	before.replaceChildren()
	after.replaceChildren()

	const diff = createBpmnDiff({
		onDiff: (result) => {
			summary.textContent = describe(result)
		},
	})

	try {
		left = new BpmnCanvas({
			container: before,
			xml: message.before,
			theme,
			grid: message.grid,
			fit: "contain",
			plugins: [diff.before],
		})
		right = new BpmnCanvas({
			container: after,
			xml: message.after,
			theme,
			grid: message.grid,
			fit: "contain",
			plugins: [diff.after],
		})
	} catch (error) {
		summary.textContent = "Could not compare these diagrams"
		reportError(error)
	}
}

onHostMessage((message) => {
	if (message.type === "diff") render(message)
	else if (message.type === "theme") {
		theme = message.theme
		applyTheme(theme)
		left?.setTheme(theme)
		right?.setTheme(theme)
	}
})

ready()
