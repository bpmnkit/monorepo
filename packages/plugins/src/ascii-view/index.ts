import { renderBpmnAscii } from "@bpmn-sdk/ascii";
import type { CanvasPlugin } from "@bpmn-sdk/canvas";
import { injectAsciiViewStyles } from "./css.js";

export { ASCII_VIEW_CSS, ASCII_VIEW_STYLE_ID, injectAsciiViewStyles } from "./css.js";

const ASCII_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M4 7l1.5 2L4 11"/><path d="M8.5 11h3.5"/></svg>`;

export interface AsciiViewPluginOptions {
	/** Returns the current BPMN XML string, or null if no diagram is loaded. */
	getXml: () => string | null;
}

function showAsciiDialog(xml: string): void {
	const ascii = renderBpmnAscii(xml, { title: false });

	const overlay = document.createElement("div");
	overlay.className = "bpmn-ascii-overlay";
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) overlay.remove();
	});

	const panel = document.createElement("div");
	panel.className = "bpmn-ascii-panel";

	const header = document.createElement("div");
	header.className = "bpmn-ascii-header";

	const title = document.createElement("div");
	title.className = "bpmn-ascii-title";
	title.textContent = "ASCII Diagram";

	const actions = document.createElement("div");
	actions.className = "bpmn-ascii-actions";

	const copyBtn = document.createElement("button");
	copyBtn.className = "bpmn-ascii-btn";
	copyBtn.textContent = "Copy";
	copyBtn.addEventListener("click", () => {
		void navigator.clipboard.writeText(ascii).then(() => {
			copyBtn.textContent = "Copied!";
			copyBtn.classList.add("bpmn-ascii-btn-copied");
			setTimeout(() => {
				copyBtn.textContent = "Copy";
				copyBtn.classList.remove("bpmn-ascii-btn-copied");
			}, 1500);
		});
	});

	const closeBtn = document.createElement("button");
	closeBtn.className = "bpmn-ascii-btn";
	closeBtn.textContent = "Close";
	closeBtn.addEventListener("click", () => overlay.remove());

	actions.append(copyBtn, closeBtn);
	header.append(title, actions);

	const body = document.createElement("div");
	body.className = "bpmn-ascii-body";

	const pre = document.createElement("pre");
	pre.className = "bpmn-ascii-pre";
	pre.textContent = ascii;

	body.append(pre);
	panel.append(header, body);
	overlay.append(panel);
	document.body.append(overlay);

	// Close on Escape
	const onKey = (e: KeyboardEvent): void => {
		if (e.key === "Escape") {
			overlay.remove();
			document.removeEventListener("keydown", onKey);
		}
	};
	document.addEventListener("keydown", onKey);
	overlay.addEventListener("remove", () => document.removeEventListener("keydown", onKey));
}

/**
 * Creates an ASCII view plugin that provides a button for viewing the current
 * BPMN diagram rendered as a Unicode box-drawing ASCII diagram.
 *
 * The returned `button` should be passed to `initEditorHud` as `asciiButton`.
 *
 * @example
 * ```typescript
 * const asciiViewPlugin = createAsciiViewPlugin({
 *   getXml: () => editorRef?.getXml() ?? null,
 * });
 * // ...
 * initEditorHud(editor, { asciiButton: asciiViewPlugin.button });
 * ```
 */
export function createAsciiViewPlugin(
	options: AsciiViewPluginOptions,
): CanvasPlugin & { button: HTMLButtonElement } {
	injectAsciiViewStyles();

	const button = document.createElement("button");
	button.title = "View as ASCII";
	button.innerHTML = ASCII_ICON;

	button.addEventListener("click", () => {
		const xml = options.getXml();
		if (!xml) return;
		showAsciiDialog(xml);
	});

	return {
		name: "ascii-view",
		install() {},
		button,
	};
}
