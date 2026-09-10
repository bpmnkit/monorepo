/**
 * The custom editor behind `.bpmn`, `.dmn` and `.form`.
 *
 * It is a **text** custom editor, and that choice is the whole design. VS
 * Code's other custom-editor protocol hands you an opaque document and makes
 * you implement dirty state, undo, hot exit, backup and external-change
 * reconciliation yourself — which is why `doc/roadmap.md` deferred editing as
 * a piece of work of its own. But these files are text, and a
 * `CustomTextEditorProvider` is backed by the same `TextDocument` a text editor
 * would open. Every one of those problems becomes VS Code's: the file is dirty
 * when the document is, Ctrl+S saves, hot exit restores, and a text editor open
 * on the same file is not a conflicting copy — it is another view of the one
 * document.
 *
 * What is left is a two-way sync with an echo in it, which is
 * [`document-sync.ts`](document-sync.ts).
 */

import * as vscode from "vscode"
import type { HostMessage, ViewerKind, WebviewMessage } from "../shared/protocol.js"
import { DocumentSync } from "./document-sync.js"
import { kindForPath } from "./documents.js"
import { currentTheme } from "./theme.js"
import { webviewShell } from "./webview-html.js"

const BODY = `<div class="stage">
<div id="toolbar" class="sim-bar" hidden></div>
<div id="root" class="viewer"></div>
<div id="play" class="sim-panel" hidden></div>
</div>
<div id="status" class="status" hidden></div>`

/**
 * How long to let edits pile up before writing them to the document.
 *
 * Every write is an undo step in the text editor, so this is really "how much
 * modelling is one Ctrl+Z". Short enough that a save never races the user,
 * long enough that dragging one element is one step rather than one per
 * command the drag produced.
 */
const WRITE_DEBOUNCE_MS = 200

export class DiagramEditorProvider implements vscode.CustomTextEditorProvider {
	constructor(private readonly context: vscode.ExtensionContext) {}

	/** Registers one provider per artifact kind; they differ only in view type. */
	static register(context: vscode.ExtensionContext): vscode.Disposable[] {
		const provider = new DiagramEditorProvider(context)
		const kinds: ViewerKind[] = ["bpmn", "dmn", "form"]
		return kinds.map((kind) =>
			vscode.window.registerCustomEditorProvider(`bpmnkit.${kind}`, provider, {
				webviewOptions: { retainContextWhenHidden: true },
				supportsMultipleEditorsPerDocument: true,
			}),
		)
	}

	resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
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
			script: "editor",
			body: BODY,
			title: "BPMN Kit",
		})

		const sync = new DocumentSync(document.getText())
		const post = (message: HostMessage): void => {
			void panel.webview.postMessage(message)
		}

		const render = (): void => {
			const settings = vscode.workspace.getConfiguration("bpmnkit", document.uri)
			post({
				type: "render",
				kind,
				text: document.getText(),
				theme: currentTheme(),
				grid: settings.get<boolean>("viewer.grid", true),
				minimap: settings.get<boolean>("viewer.minimap", true),
				simulate: kind === "bpmn" && settings.get<boolean>("simulation.enabled", true),
				editable: settings.get<boolean>("editing.enabled", true),
			})
		}

		/** The most recent text the webview produced, waiting to be written. */
		let queued: string | null = null
		const flush = debounce(() => {
			const text = queued
			queued = null
			if (text === null) return
			if (!sync.fromWebview(text, document.getText())) return

			const edit = new vscode.WorkspaceEdit()
			edit.replace(document.uri, wholeDocument(document), text)
			void vscode.workspace.applyEdit(edit)
		}, WRITE_DEBOUNCE_MS)

		const subscriptions: vscode.Disposable[] = [
			// The webview asks; the host answers. A message posted before the
			// bundle has run is dropped, and the panel stays blank forever.
			panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
				if (message.type === "ready") render()
				else if (message.type === "error") void vscode.window.showErrorMessage(message.message)
				else if (message.type === "edit") {
					queued = message.text
					flush.run()
				}
			}),
			vscode.window.onDidChangeActiveColorTheme(() => {
				post({ type: "theme", theme: currentTheme() })
			}),
			// Everything that is not this editor's own write: a keystroke in a text
			// editor on the same file, an undo, a revert, a branch switch. The
			// document is the truth and the diagram has to be rebuilt from it.
			vscode.workspace.onDidChangeTextDocument((event) => {
				if (event.document.uri.toString() !== document.uri.toString()) return
				if (sync.fromDocument(event.document.getText())) render()
			}),
		]

		panel.onDidDispose(() => {
			flush.cancel()
			for (const subscription of subscriptions) subscription.dispose()
		})
	}
}

/** The range covering everything in a document. */
function wholeDocument(document: vscode.TextDocument): vscode.Range {
	return new vscode.Range(0, 0, document.lineCount, 0)
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
