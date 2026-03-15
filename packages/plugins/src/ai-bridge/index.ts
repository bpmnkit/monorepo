import type { BpmnDefinitions } from "@bpmnkit/core"
import { DEFAULT_SERVER, createAiPanel } from "./panel.js"
import type { NodeContext } from "./panel.js"

export type { NodeContext }

// ── Element lookup helpers ────────────────────────────────────────────────────

type Container = {
	flowElements: Array<{ id: string; type: string; name?: string; flowElements?: unknown[] }>
	sequenceFlows: Array<{ id: string; name?: string }>
	textAnnotations: Array<{ id: string; text?: string }>
}

function searchContainer(container: Container, id: string): NodeContext | null {
	for (const el of container.flowElements) {
		if (el.id === id) return { id: el.id, type: el.type, name: el.name }
		if (el.flowElements) {
			const nested = searchContainer(el as unknown as Container, id)
			if (nested) return nested
		}
	}
	for (const sf of container.sequenceFlows) {
		if (sf.id === id) return { id: sf.id, type: "sequenceFlow", name: sf.name }
	}
	for (const ann of container.textAnnotations) {
		if (ann.id === id) return { id: ann.id, type: "textAnnotation", name: ann.text }
	}
	return null
}

function findElementById(defs: BpmnDefinitions | null, id: string): NodeContext | null {
	if (!defs) return null
	for (const proc of defs.processes) {
		const found = searchContainer(proc, id)
		if (found) return found
	}
	return null
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export interface AiBridgePluginOptions {
	/** URL of the local AI server. Defaults to http://localhost:3033 */
	serverUrl?: string
	/** Returns the current diagram definitions, or null if no diagram is loaded. */
	getDefinitions(): BpmnDefinitions | null
	/** Loads the given XML into the editor. */
	loadXml(xml: string): void
	/** Returns the current storage context for checkpoint saving, if available. */
	getCurrentContext?(): { projectId: string; fileId: string } | null
	/** Dock AI pane to mount into instead of document.body. */
	container?: HTMLElement
	/** Called when the button is clicked in docked mode. */
	onOpen?: () => void
	/** Returns the current editor theme — used to match the diagram preview color scheme. */
	getTheme?(): "dark" | "light"
	/**
	 * Called when the user requests creation of a companion DMN or Form file.
	 * Receives a suggested file name, file type, and the serialized content.
	 */
	createCompanionFile?(name: string, type: "dmn" | "form", content: string): Promise<void>
}

const AI_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M5.5 6.5C5.5 5.4 6.4 4.5 7.5 4.5h1C9.6 4.5 10.5 5.4 10.5 6.5S9.6 8.5 8.5 8.5H8V10"/><circle cx="8" cy="12" r="0.5" fill="currentColor" stroke="none"/></svg>`

/**
 * Creates an AI bridge plugin that provides a chat panel for AI-assisted
 * BPMN diagram creation and modification.
 *
 * The returned `button` should be passed to `initEditorHud` as `aiButton`.
 * The panel is injected into `document.body` on first open.
 */
export function createAiBridgePlugin(options: AiBridgePluginOptions): {
	name: string
	install(api: unknown): void
	button: HTMLButtonElement
	/** Initialize the panel (if not yet created) and open it. */
	openPanel(): void
	/** Set the node context shown as a badge above the chat input. Pass null to clear. */
	setContext(node: NodeContext | null): void
} {
	const serverUrl = options.serverUrl ?? DEFAULT_SERVER

	let panelInstance: ReturnType<typeof createAiPanel> | null = null
	let panelOpen = false
	let _pendingContext: NodeContext | null = null
	let _canvasApi: { getTheme(): "dark" | "light" | "auto" } | null = null

	function getOrCreatePanel(): ReturnType<typeof createAiPanel> {
		if (!panelInstance) {
			panelInstance = createAiPanel({
				serverUrl,
				getDefinitions: options.getDefinitions,
				loadXml: options.loadXml,
				getCurrentContext: options.getCurrentContext,
				createCompanionFile: options.createCompanionFile,
				getTheme: options.getTheme
					? options.getTheme
					: _canvasApi
						? () => {
								const t = _canvasApi?.getTheme()
								return t === "light" ? "light" : "dark"
							}
						: undefined,
			})
			if (_pendingContext !== null) {
				panelInstance.setContext(_pendingContext)
			}
			if (options.container) {
				panelInstance.panel.classList.add("ai-panel--docked")
				options.container.append(panelInstance.panel)
			} else {
				document.body.append(panelInstance.panel)
			}
		}
		return panelInstance
	}

	const button = document.createElement("button")
	button.title = "AI Assistant"
	button.innerHTML = AI_ICON

	button.addEventListener("click", () => {
		const p = getOrCreatePanel()
		if (options.container) {
			options.onOpen?.()
			p.open()
		} else if (panelOpen) {
			p.close()
			panelOpen = false
		} else {
			p.open()
			panelOpen = true
		}
	})

	function openPanel(): void {
		const p = getOrCreatePanel()
		if (options.container) {
			options.onOpen?.()
			p.open()
		} else {
			p.open()
			panelOpen = true
		}
	}

	function setContext(node: NodeContext | null): void {
		_pendingContext = node
		panelInstance?.setContext(node)
	}

	function install(api: unknown): void {
		_canvasApi = api as { getTheme(): "dark" | "light" | "auto" }
		type AnyOn = (event: string, handler: (...args: unknown[]) => void) => () => void
		const on = (api as { on: AnyOn }).on.bind(api as { on: AnyOn })
		on("editor:select", (rawIds) => {
			const ids = rawIds as string[]
			if (ids.length !== 1) {
				setContext(null)
				return
			}
			const id = ids[0]
			if (!id) return
			setContext(findElementById(options.getDefinitions(), id))
		})
	}

	return {
		name: "ai-bridge",
		install,
		button,
		openPanel,
		setContext,
	}
}
