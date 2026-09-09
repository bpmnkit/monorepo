/**
 * The visual diff, as a webview panel.
 *
 * Not as a diff editor: VS Code's diff editor pairs two *text* editors, and a
 * custom editor cannot stand in for either side. So the visual comparison is
 * its own panel, reached from the places a reader already looks for a
 * comparison — the Source Control panel, and an Explorer two-file selection —
 * while the text diff stays exactly where it was. Two views of the same change,
 * neither replacing the other.
 */

import * as vscode from "vscode"
import type { HostMessage, WebviewMessage } from "../shared/protocol.js"
import { currentTheme } from "./theme.js"
import { webviewShell } from "./webview-html.js"

const BODY = `<div class="diff-bar"><span id="summary" class="diff-summary">Comparing…</span>
<span id="labels" class="diff-labels"></span></div>
<div class="diff-panes">
<div class="diff-pane"><div class="diff-pane-label" id="beforeLabel"></div><div id="before" class="viewer"></div></div>
<div class="diff-pane"><div class="diff-pane-label" id="afterLabel"></div><div id="after" class="viewer"></div></div>
</div>`

export interface DiffRequest {
	readonly before: string
	readonly after: string
	readonly beforeLabel: string
	readonly afterLabel: string
}

/**
 * Opens a comparison of two diagrams.
 *
 * @param context - The extension context, for the webview's resource roots.
 * @param request - Both documents' text and the labels naming them.
 */
export function openDiffPanel(context: vscode.ExtensionContext, request: DiffRequest): void {
	const panel = vscode.window.createWebviewPanel(
		"bpmnkit.diff",
		`${request.beforeLabel} ↔ ${request.afterLabel}`,
		vscode.ViewColumn.Active,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [context.extensionUri],
		},
	)

	panel.webview.html = webviewShell(panel.webview, context.extensionUri, {
		script: "diff",
		body: BODY,
		title: "BPMN Kit diff",
	})

	const grid = vscode.workspace.getConfiguration("bpmnkit").get<boolean>("viewer.grid", true)
	const post = (message: HostMessage): void => {
		void panel.webview.postMessage(message)
	}

	const subscriptions = [
		panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
			if (message.type === "ready") {
				post({ type: "diff", ...request, theme: currentTheme(), grid })
			} else if (message.type === "error") {
				void vscode.window.showErrorMessage(message.message)
			}
		}),
		vscode.window.onDidChangeActiveColorTheme(() => {
			post({ type: "theme", theme: currentTheme() })
		}),
	]

	panel.onDidDispose(() => {
		for (const subscription of subscriptions) subscription.dispose()
	})
}
