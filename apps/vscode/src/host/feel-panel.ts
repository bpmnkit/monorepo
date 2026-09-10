/**
 * The FEEL playground, opened as a panel beside whatever the user is reading.
 *
 * One panel, reused: a second invocation re-seeds the one that is open rather
 * than stacking another tab, because the expression under the cursor changes
 * far more often than the desire for another playground.
 */

import * as vscode from "vscode"
import type { HostMessage, WebviewMessage } from "../shared/protocol.js"
import { currentTheme } from "./theme.js"
import { webviewShell } from "./webview-html.js"

let panel: vscode.WebviewPanel | null = null
let pending = ""

/**
 * Opens the playground, pre-filled with an expression.
 *
 * @param context - The extension context, for the webview's resource roots.
 * @param expression - What to put in the expression box; empty for the default.
 */
export function openFeelPanel(context: vscode.ExtensionContext, expression: string): void {
	pending = expression

	if (panel !== null) {
		panel.reveal(vscode.ViewColumn.Beside, true)
		void panel.webview.postMessage(seed())
		return
	}

	panel = vscode.window.createWebviewPanel(
		"bpmnkit.feel",
		"FEEL Playground",
		{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [context.extensionUri],
		},
	)

	panel.webview.html = webviewShell(panel.webview, context.extensionUri, {
		script: "feel",
		body: `<div id="root" class="feel-root"></div>`,
		title: "FEEL Playground",
	})

	const subscriptions = [
		panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
			if (message.type === "ready") void panel?.webview.postMessage(seed())
			else if (message.type === "error") void vscode.window.showErrorMessage(message.message)
		}),
		vscode.window.onDidChangeActiveColorTheme(() => {
			void panel?.webview.postMessage({
				type: "theme",
				theme: currentTheme(),
			} satisfies HostMessage)
		}),
	]

	panel.onDidDispose(() => {
		for (const subscription of subscriptions) subscription.dispose()
		panel = null
	})
}

function seed(): HostMessage {
	return { type: "feel", expression: pending, theme: currentTheme() }
}

/**
 * The FEEL expression the user has selected, if any.
 *
 * A selection is the only reliable signal. Guessing one from the cursor
 * position would mean parsing the XML around it and being wrong in the cases
 * that matter — a multi-line expression, a nested `if`.
 */
export function selectedExpression(editor: vscode.TextEditor | undefined): string {
	if (editor === undefined || editor.selection.isEmpty) return ""
	return editor.document.getText(editor.selection).trim()
}
