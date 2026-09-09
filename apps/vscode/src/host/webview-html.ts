/**
 * The HTML shell every webview in this extension is served from.
 *
 * There is exactly one, because there is exactly one set of security decisions
 * to get right. A webview is a full browser context inside the editor: it is
 * given no network access here (`default-src 'none'`), scripts run only with
 * the per-load nonce, and the only readable files are the ones under the
 * extension's own directory.
 */

import * as vscode from "vscode"

/** A fresh script nonce per load; a reused one is not a nonce. */
function nonce(): string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	let out = ""
	for (let i = 0; i < 32; i += 1) {
		out += alphabet[Math.floor(Math.random() * alphabet.length)]
	}
	return out
}

export interface WebviewShellOptions {
	/** The bundle under `dist/webview/`, without the extension. */
	readonly script: "viewer" | "diff" | "feel"
	/** Body markup. Static only — everything dynamic arrives by `postMessage`. */
	readonly body: string
	readonly title: string
}

/**
 * Builds the page for a webview.
 *
 * Inline styles are permitted because `@bpmnkit/ui` and every canvas plugin
 * inject their stylesheet at runtime; inline *scripts* are not, which is the
 * half that matters.
 *
 * @param webview - The webview the page is for; supplies its own CSP source.
 * @param root - The extension's install directory.
 * @param options - Which bundle to load and what static markup to load it into.
 */
export function webviewShell(
	webview: vscode.Webview,
	root: vscode.Uri,
	options: WebviewShellOptions,
): string {
	const script = webview.asWebviewUri(
		vscode.Uri.joinPath(root, "dist", "webview", `${options.script}.js`),
	)
	const styles = webview.asWebviewUri(vscode.Uri.joinPath(root, "media", "webview.css"))
	const key = nonce()

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; script-src 'nonce-${key}';" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link href="${styles}" rel="stylesheet" />
<title>${options.title}</title>
</head>
<body>
${options.body}
<script nonce="${key}" type="module" src="${script}"></script>
</body>
</html>`
}
