/**
 * The webview's half of the message channel.
 *
 * `acquireVsCodeApi` is injected into the webview by the editor and can only be
 * called once per page, so it is called here and nowhere else.
 */

import type { HostMessage, WebviewMessage } from "../shared/protocol.js"

interface VsCodeApi {
	postMessage(message: WebviewMessage): void
}

declare const acquireVsCodeApi: () => VsCodeApi

const api = acquireVsCodeApi()

/** Tells the host this view is listening. Nothing arrives before this is sent. */
export function ready(): void {
	api.postMessage({ type: "ready" })
}

/** Reports a failure the host should surface, rather than leaving a blank panel. */
export function reportError(error: unknown): void {
	api.postMessage({
		type: "error",
		message: error instanceof Error ? error.message : String(error),
	})
}

/** Subscribes to messages from the extension host. */
export function onHostMessage(handler: (message: HostMessage) => void): void {
	window.addEventListener("message", (event: MessageEvent<HostMessage>) => {
		handler(event.data)
	})
}

/**
 * Applies a theme to the document.
 *
 * `@bpmnkit/ui` is light by default and switches on `[data-theme="dark"]`, and
 * `media/webview.css` re-points the tokens that should follow the editor
 * exactly. Setting the attribute is all either of them needs.
 */
export function applyTheme(theme: "light" | "dark"): void {
	document.documentElement.dataset.theme = theme
}
