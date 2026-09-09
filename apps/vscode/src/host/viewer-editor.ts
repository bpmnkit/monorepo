/**
 * The read-only custom editor behind `.bpmn`, `.dmn` and `.form`.
 *
 * Read-only is a scope decision, not a limitation of the stack: VS Code's
 * editable custom-document protocol brings dirty state, hot exit, external
 * edits and a text editor open on the same file that can disagree with you.
 * That is its own piece of work (`doc/roadmap.md`, Phase 7). What read-only
 * buys — seeing the diagram, and seeing it change as the XML beside it
 * changes — needs none of it.
 */

import { posix } from "node:path"
import * as vscode from "vscode"
import type { HostMessage, ViewerKind, WebviewMessage } from "../shared/protocol.js"
import { kindForPath } from "./documents.js"
import { readText } from "./files.js"
import { currentTheme } from "./theme.js"
import { webviewShell } from "./webview-html.js"

/**
 * A document that is only ever read.
 *
 * The file's text is deliberately *not* cached here. It is read at render
 * time, so a diagram opened beside its XML redraws from what is on disk rather
 * than from what was on disk when the tab was opened.
 */
class ViewerDocument implements vscode.CustomDocument {
	constructor(readonly uri: vscode.Uri) {}
	dispose(): void {}
}

const BODY = `<div id="root" class="viewer"></div>
<div id="status" class="status" hidden></div>`

export class ViewerEditorProvider implements vscode.CustomReadonlyEditorProvider<ViewerDocument> {
	constructor(private readonly context: vscode.ExtensionContext) {}

	/** Registers one provider per artifact kind; they differ only in view type. */
	static register(context: vscode.ExtensionContext): vscode.Disposable[] {
		const provider = new ViewerEditorProvider(context)
		const kinds: ViewerKind[] = ["bpmn", "dmn", "form"]
		return kinds.map((kind) =>
			vscode.window.registerCustomEditorProvider(`bpmnkit.${kind}`, provider, {
				webviewOptions: { retainContextWhenHidden: true },
				supportsMultipleEditorsPerDocument: true,
			}),
		)
	}

	openCustomDocument(uri: vscode.Uri): ViewerDocument {
		return new ViewerDocument(uri)
	}

	async resolveCustomEditor(document: ViewerDocument, panel: vscode.WebviewPanel): Promise<void> {
		const kind = kindForPath(document.uri.path)
		if (kind === null) {
			panel.webview.html = "<p>BPMN Kit cannot show this file.</p>"
			return
		}

		panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		}
		panel.webview.html = webviewShell(panel.webview, this.context.extensionUri, {
			script: "viewer",
			body: BODY,
			title: "BPMN Kit",
		})

		const post = (message: HostMessage): void => {
			void panel.webview.postMessage(message)
		}

		const render = async (): Promise<void> => {
			const settings = vscode.workspace.getConfiguration("bpmnkit", document.uri)
			post({
				type: "render",
				kind,
				text: await readText(document.uri),
				theme: currentTheme(),
				grid: settings.get<boolean>("viewer.grid", true),
				minimap: settings.get<boolean>("viewer.minimap", true),
			})
		}

		// Re-rendering on every keystroke would re-parse the document each time;
		// a short pause is imperceptible and turns a burst of edits into one draw.
		const redraw = debounce(() => void render(), 250)

		// Registering the file as a text document costs one read and buys two
		// things: `readText` can follow the unsaved buffer, and the analysis in
		// `lint-provider.ts` reports problems for a diagram opened only in here.
		await vscode.workspace.openTextDocument(document.uri)

		const subscriptions: vscode.Disposable[] = [
			// The webview asks; the host answers. A message posted before the
			// bundle has run is dropped, and the panel stays blank forever.
			panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
				if (message.type === "ready") void render()
				else if (message.type === "error") void vscode.window.showErrorMessage(message.message)
			}),
			vscode.window.onDidChangeActiveColorTheme(() => {
				post({ type: "theme", theme: currentTheme() })
			}),
			// Follow the text editor beside it as it is typed in, not only when it
			// is saved — an unsaved buffer is what the author is actually looking at.
			vscode.workspace.onDidChangeTextDocument((event) => {
				if (event.document.uri.toString() === document.uri.toString()) redraw.run()
			}),
			// And follow the file itself, for everything that is not a text edit:
			// a branch switch, a code generator, a save from another window.
			watch(document.uri, redraw.run),
		]

		panel.onDidDispose(() => {
			redraw.cancel()
			for (const subscription of subscriptions) subscription.dispose()
		})
	}
}

interface Debounced {
	run: () => void
	cancel: () => void
}

function debounce(fn: () => void, ms: number): Debounced {
	let timer: ReturnType<typeof setTimeout> | null = null
	return {
		run: () => {
			if (timer !== null) clearTimeout(timer)
			timer = setTimeout(fn, ms)
		},
		cancel: () => {
			if (timer !== null) clearTimeout(timer)
			timer = null
		},
	}
}

/** Fires whenever this one file is written to, by anyone. */
function watch(uri: vscode.Uri, onChange: () => void): vscode.Disposable {
	const watcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(vscode.Uri.joinPath(uri, ".."), posix.basename(uri.path)),
	)
	watcher.onDidChange(onChange)
	watcher.onDidCreate(onChange)
	return watcher
}
