/**
 * The diagram webview: BPMN, DMN or a form, edited in place.
 *
 * Nothing here knows it is inside VS Code beyond `vscode-api.ts`. The editors
 * are the same ones the studio and the desktop app mount, and all three have
 * the same shape — load text, report a change, hand back text — so the sync is
 * written once and the kind only decides which class to construct.
 *
 * Two rules keep the round trip honest, and both matter more than they look:
 *
 * - **Loading is not editing.** The host writes what this view reports back
 *   into the document. If a load counted as a change, opening a file would
 *   rewrite it with a re-serialised copy of itself, and every diagram in a
 *   repository would come back modified the moment someone looked at it.
 * - **A rebuild is not editing either.** When the document changes underneath
 *   us — a hand edit, an undo, a branch switch — the host sends the new text
 *   and this view reloads. That reload must be silent for the same reason.
 *
 * For BPMN it also mounts the simulator. `@bpmnkit/engine` is a TypeScript
 * process engine with no server and no Node dependency, so the diagram on
 * screen executes, one element at a time, with tokens drawn on the elements
 * they are sitting on.
 */

import { BpmnCanvas } from "@bpmnkit/canvas"
import type { CanvasPlugin } from "@bpmnkit/canvas"
import {
	Bpmn,
	Dmn,
	Form,
	preserveBpmnFormatting,
	preserveDmnFormatting,
	preserveFormFormatting,
} from "@bpmnkit/core"
import { BpmnEditor } from "@bpmnkit/editor"
import { Engine } from "@bpmnkit/engine"
import { DmnEditor } from "@bpmnkit/plugins/dmn-editor"
import { DmnViewer } from "@bpmnkit/plugins/dmn-viewer"
import { FormEditor } from "@bpmnkit/plugins/form-editor"
import { createMinimapPlugin } from "@bpmnkit/plugins/minimap"
import { createProcessRunnerPlugin } from "@bpmnkit/plugins/process-runner"
import { createTokenHighlightPlugin } from "@bpmnkit/plugins/token-highlight"
import { createZoomControlsPlugin } from "@bpmnkit/plugins/zoom-controls"
import { injectUiStyles } from "@bpmnkit/ui"
import type { HostMessage, ViewerTheme } from "../shared/protocol.js"
import { applyTheme, onHostMessage, ready, reportEdit, reportError } from "./vscode-api.js"

injectUiStyles()

const root = document.getElementById("root") as HTMLDivElement
const status = document.getElementById("status") as HTMLDivElement
const toolbar = document.getElementById("toolbar") as HTMLDivElement
const play = document.getElementById("play") as HTMLDivElement

/** Whatever is mounted, reduced to the three things this file needs of it. */
interface Mounted {
	setTheme(theme: ViewerTheme): void
	destroy(): void
}

let mounted: Mounted | null = null
let theme: ViewerTheme = "dark"

/**
 * The document as the host last knew it — what an edit is written against.
 *
 * A visual editor serialises the whole model, so without this every save
 * reformats the file to this toolkit's own output and the commit says "the
 * whole diagram" when it means "a box moved". `preserve*Formatting` writes the
 * change into the document that was already there; each edit then becomes the
 * base for the next, so a run of edits stays as small as the first.
 */
let baseline = ""

function reason(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

/**
 * Reports an edit the user made.
 *
 * Change handlers are attached *after* the document has been loaded into an
 * editor, never before, which is what keeps a load from counting as an edit.
 * A guard flag would do the same job and would have to be right about when
 * every editor emits; ordering is right by construction.
 */
function edited(serialise: () => string): void {
	try {
		reportEdit(serialise())
	} catch (error) {
		setStatus(`This change could not be written — ${reason(error)}`)
	}
}

/**
 * Says what went wrong without taking the diagram away.
 *
 * The file is being edited in the pane beside this one, so it is routinely
 * unparseable for a keystroke or two. Blanking the view every time would make
 * the preview flicker; keeping the last good drawing and saying it is stale is
 * what a reader wants.
 */
function setStatus(text: string | null): void {
	status.textContent = text ?? ""
	status.hidden = text === null
}

function clear(): void {
	// `destroy()` uninstalls every plugin, and the runner takes its own toolbar
	// and panel out of the DOM when it goes — so a redraw leaves nothing behind.
	mounted?.destroy()
	mounted = null
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

function renderBpmn(message: Extract<HostMessage, { type: "render" }>): void {
	// Parse before tearing anything down. The editor parses internally, so this
	// is one extra parse per redraw — the price of never blanking a good drawing
	// because the file was half-typed when the debounce fired.
	Bpmn.parse(message.text)

	const plugins: CanvasPlugin[] = [createZoomControlsPlugin()]
	if (message.minimap) plugins.push(createMinimapPlugin())
	clear()
	if (message.simulate) withSimulation(plugins)

	if (!message.editable) {
		const canvas = new BpmnCanvas({
			container: root,
			xml: message.text,
			theme,
			grid: message.grid,
			fit: "contain",
			plugins,
		})
		mounted = canvas
		return
	}

	const editor = new BpmnEditor({
		container: root,
		theme,
		grid: message.grid,
		fit: "contain",
		plugins,
	})
	editor.load(message.text)
	editor.on("diagram:change", () => {
		edited(() => keep(preserveBpmnFormatting(baseline, editor.exportXml()).xml))
	})
	mounted = editor
}

function renderDmn(message: Extract<HostMessage, { type: "render" }>): void {
	// The DMN editor has no read-only mode, so read-only is the viewer — which
	// shows the decision tables and not the DRD canvas. Different view, same
	// answer to "what does this file say".
	if (!message.editable) {
		const decision = Dmn.parse(message.text)
		clear()
		const viewer = new DmnViewer({ container: root, theme })
		viewer.load(decision)
		mounted = { setTheme: (next) => viewer.setTheme(next), destroy: () => root.replaceChildren() }
		return
	}

	Dmn.parse(message.text)
	clear()
	const editor = new DmnEditor({ container: root, theme })
	mounted = editor
	void editor.loadXML(message.text).then(() => {
		editor.onChange(() => {
			void editor.getXML().then((xml) => {
				edited(() => keep(preserveDmnFormatting(baseline, xml).xml))
			})
		})
	})
}

function renderForm(message: Extract<HostMessage, { type: "render" }>): void {
	const schema = JSON.parse(message.text) as Record<string, unknown>
	// Reject anything that is not a form before tearing the old one down; the
	// editor normalises whatever it is given and would happily show an empty one.
	Form.parse(message.text)
	clear()
	const editor = new FormEditor({ container: root, theme, readonly: !message.editable })
	mounted = editor
	void editor.loadSchema(schema).then(() => {
		editor.onChange(() => {
			// `getSchema()` is the form as this toolkit would write it; preserving
			// turns that into the form as *this file* is written — its indentation,
			// its key order, its trailing newline.
			const written = JSON.stringify(editor.getSchema(), null, 2)
			edited(() => keep(preserveFormFormatting(baseline, written).json))
		})
	})
}

/** Records what the document now says, so the next edit is written against it. */
function keep(xml: string): string {
	baseline = xml
	return xml
}

function render(message: Extract<HostMessage, { type: "render" }>): void {
	theme = message.theme
	applyTheme(theme)
	baseline = message.text
	try {
		if (message.kind === "bpmn") renderBpmn(message)
		else if (message.kind === "dmn") renderDmn(message)
		else renderForm(message)
		setStatus(null)
	} catch (error) {
		// First render: there is no earlier drawing to fall back to, so the host
		// should say so out loud. Later ones keep what is on screen.
		if (root.childElementCount === 0) reportError(error)
		setStatus(`Showing the last version that parsed — ${reason(error)}`)
	}
}

onHostMessage((incoming) => {
	if (incoming.type === "render") render(incoming)
	else if (incoming.type === "theme") {
		theme = incoming.theme
		applyTheme(theme)
		mounted?.setTheme(theme)
	}
})

ready()
