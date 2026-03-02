import type { BpmnDefinitions } from "@bpmn-sdk/core";
import { DEFAULT_SERVER, createAiPanel } from "./panel.js";

export interface AiBridgePluginOptions {
	/** URL of the local AI server. Defaults to http://localhost:3033 */
	serverUrl?: string;
	/** Returns the current diagram definitions, or null if no diagram is loaded. */
	getDefinitions(): BpmnDefinitions | null;
	/** Loads the given XML into the editor. */
	loadXml(xml: string): void;
	/** Returns the current storage context for checkpoint saving, if available. */
	getCurrentContext?(): { projectId: string; fileId: string } | null;
	/** Dock AI pane to mount into instead of document.body. */
	container?: HTMLElement;
	/** Called when the button is clicked in docked mode. */
	onOpen?: () => void;
}

const AI_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M5.5 6.5C5.5 5.4 6.4 4.5 7.5 4.5h1C9.6 4.5 10.5 5.4 10.5 6.5S9.6 8.5 8.5 8.5H8V10"/><circle cx="8" cy="12" r="0.5" fill="currentColor" stroke="none"/></svg>`;

/**
 * Creates an AI bridge plugin that provides a chat panel for AI-assisted
 * BPMN diagram creation and modification.
 *
 * The returned `button` should be passed to `initEditorHud` as `aiButton`.
 * The panel is injected into `document.body` on first open.
 */
export function createAiBridgePlugin(options: AiBridgePluginOptions): {
	name: string;
	install(): void;
	button: HTMLButtonElement;
} {
	const serverUrl = options.serverUrl ?? DEFAULT_SERVER;

	let panelInstance: ReturnType<typeof createAiPanel> | null = null;
	let panelOpen = false;

	function getOrCreatePanel(): ReturnType<typeof createAiPanel> {
		if (!panelInstance) {
			panelInstance = createAiPanel({
				serverUrl,
				getDefinitions: options.getDefinitions,
				loadXml: options.loadXml,
				getCurrentContext: options.getCurrentContext,
			});
			if (options.container) {
				panelInstance.panel.classList.add("ai-panel--docked");
				options.container.append(panelInstance.panel);
			} else {
				document.body.append(panelInstance.panel);
			}
		}
		return panelInstance;
	}

	const button = document.createElement("button");
	button.title = "AI Assistant";
	button.innerHTML = AI_ICON;

	button.addEventListener("click", () => {
		const p = getOrCreatePanel();
		if (options.container) {
			options.onOpen?.();
			p.open();
		} else if (panelOpen) {
			p.close();
			panelOpen = false;
		} else {
			p.open();
			panelOpen = true;
		}
	});

	return {
		name: "ai-bridge",
		install(): void {},
		button,
	};
}
