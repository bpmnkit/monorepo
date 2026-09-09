/**
 * The read-only viewer webview: one diagram, redrawn whenever the host says so.
 *
 * Nothing here knows it is inside VS Code beyond `vscode-api.ts`. It is the
 * same `@bpmnkit/canvas` the studio and Drop mount, given text and told which
 * way round the colours go.
 *
 * For BPMN it also mounts the simulator. `@bpmnkit/engine` is a TypeScript
 * process engine with no server and no Node dependency, so it runs in the
 * webview: the diagram on screen executes, one element at a time, with tokens
 * drawn on the elements they are sitting on. That is the whole reason this
 * extension is not a picture viewer.
 */

import { BpmnCanvas } from "@bpmnkit/canvas"
import type { CanvasPlugin } from "@bpmnkit/canvas"
import { Bpmn, Dmn, Form } from "@bpmnkit/core"
import { Engine } from "@bpmnkit/engine"
import { DmnViewer } from "@bpmnkit/plugins/dmn-viewer"
import { FormViewer } from "@bpmnkit/plugins/form-viewer"
import { createMinimapPlugin } from "@bpmnkit/plugins/minimap"
import { createProcessRunnerPlugin } from "@bpmnkit/plugins/process-runner"
import { createTokenHighlightPlugin } from "@bpmnkit/plugins/token-highlight"
import { createZoomControlsPlugin } from "@bpmnkit/plugins/zoom-controls"
import { injectUiStyles } from "@bpmnkit/ui"
import type { HostMessage, ViewerTheme } from "../shared/protocol.js"
import { applyTheme, onHostMessage, ready, reportError } from "./vscode-api.js"

injectUiStyles()

const root = document.getElementById("root") as HTMLDivElement
const status = document.getElementById("status") as HTMLDivElement
const toolbar = document.getElementById("toolbar") as HTMLDivElement
const play = document.getElementById("play") as HTMLDivElement

let canvas: BpmnCanvas | null = null
/** Retheming whatever is currently mounted — a canvas, a table, or a form. */
let retheme: ((theme: ViewerTheme) => void) | null = null
let theme: ViewerTheme = "dark"

/**
 * Says what went wrong without taking the diagram away.
 *
 * The file is being edited in the pane beside this one, so it is routinely
 * unparseable for a keystroke or two. Blanking the view every time would make
 * the preview flicker; keeping the last good drawing and saying it is stale is
 * what a reader wants.
 */
function setStatus(message: string | null): void {
	status.textContent = message ?? ""
	status.hidden = message === null
}

function clear(): void {
	// `destroy()` uninstalls every plugin, and the runner takes its own toolbar
	// and panel out of the DOM when it goes — so a redraw leaves nothing behind.
	canvas?.destroy()
	canvas = null
	retheme = null
	root.replaceChildren()
	toolbar.hidden = true
	play.hidden = true
}

/**
 * Adds the simulator to a diagram's plugin list.
 *
 * The runner deploys to the engine itself on `diagram:load`, so all it needs
 * from a host is somewhere to put its controls. Here that is a bar above the
 * canvas and a panel below it, both hidden until the user starts.
 */
function withSimulation(plugins: CanvasPlugin[]): void {
	const tokenHighlight = createTokenHighlightPlugin()
	const runner = createProcessRunnerPlugin({
		engine: new Engine(),
		tokenHighlight,
		playContainer: play,
		onShowPlayTab: () => {
			play.hidden = false
		},
		onHidePlayTab: () => {
			play.hidden = true
		},
	})

	toolbar.replaceChildren(runner.playButton, runner.toolbar)
	toolbar.hidden = false
	plugins.push(tokenHighlight, runner)
}

function renderBpmn(text: string, grid: boolean, minimap: boolean, simulate: boolean): void {
	// Parse before tearing anything down. `BpmnCanvas` parses internally, so
	// this is one extra parse per redraw — the price of never blanking a good
	// drawing because the file was half-typed when the debounce fired.
	Bpmn.parse(text)

	const plugins: CanvasPlugin[] = [createZoomControlsPlugin()]
	if (minimap) plugins.push(createMinimapPlugin())
	clear()
	if (simulate) withSimulation(plugins)

	canvas = new BpmnCanvas({ container: root, xml: text, theme, grid, fit: "contain", plugins })
	retheme = (next) => canvas?.setTheme(next)
}

function render(message: Extract<HostMessage, { type: "render" }>): void {
	theme = message.theme
	applyTheme(theme)
	try {
		if (message.kind === "bpmn") {
			renderBpmn(message.text, message.grid, message.minimap, message.simulate)
		} else if (message.kind === "dmn") {
			const decision = Dmn.parse(message.text)
			clear()
			const viewer = new DmnViewer({ container: root, theme })
			viewer.load(decision)
			retheme = (next) => viewer.setTheme(next)
		} else {
			const form = Form.parse(message.text)
			clear()
			const viewer = new FormViewer({ container: root, theme })
			viewer.load(form)
			retheme = (next) => viewer.setTheme(next)
		}
		setStatus(null)
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error)
		// First render: there is no earlier drawing to fall back to, so the host
		// should say so out loud. Later ones keep what is on screen.
		if (root.childElementCount === 0) reportError(error)
		setStatus(`Showing the last version that parsed — ${reason}`)
	}
}

onHostMessage((message) => {
	if (message.type === "render") render(message)
	else if (message.type === "theme") {
		theme = message.theme
		applyTheme(theme)
		retheme?.(theme)
	}
})

ready()
