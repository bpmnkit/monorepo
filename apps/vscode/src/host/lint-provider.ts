/**
 * BPMN static analysis in the Problems panel.
 *
 * This runs in the extension host, where Node is available and `@bpmnkit/core`
 * runs unchanged — the analysis is the same code `casen lint` runs, not a
 * reimplementation of it, and the engine rule it applies is the same one
 * (`doc/roadmap.md`, Phase 3): a diagram that names no execution platform is
 * not judged against Camunda 8 deployability.
 *
 * Only `.bpmn` is linted. The optimizer analyses BPMN; a DMN or form file has
 * nothing for it to say.
 */

import { Bpmn, lintDiagram } from "@bpmnkit/core"
import * as vscode from "vscode"
import { placeDiagnostics } from "./diagnostics.js"
import { kindForPath } from "./documents.js"

const SEVERITY: Record<"error" | "warning" | "info", vscode.DiagnosticSeverity> = {
	error: vscode.DiagnosticSeverity.Error,
	warning: vscode.DiagnosticSeverity.Warning,
	info: vscode.DiagnosticSeverity.Information,
}

/** How long to wait after a keystroke before re-analysing, in `onType` mode. */
const DEBOUNCE_MS = 400

export class LintProvider {
	private readonly collection = vscode.languages.createDiagnosticCollection("bpmnkit")
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()

	static register(): vscode.Disposable[] {
		const provider = new LintProvider()

		const subscriptions = [
			provider.collection,
			vscode.workspace.onDidOpenTextDocument((document) => provider.schedule(document, true)),
			vscode.workspace.onDidSaveTextDocument((document) => provider.schedule(document, true)),
			vscode.workspace.onDidChangeTextDocument((event) => provider.schedule(event.document, false)),
			vscode.workspace.onDidCloseTextDocument((document) => provider.forget(document)),
			vscode.workspace.onDidChangeConfiguration((event) => {
				if (event.affectsConfiguration("bpmnkit.lint")) provider.refreshAll()
			}),
			new vscode.Disposable(() => provider.dispose()),
		]

		// Anything already open when the extension activated never fires
		// onDidOpenTextDocument, and would otherwise show no problems until touched.
		provider.refreshAll()
		return subscriptions
	}

	/**
	 * Queues an analysis of a document.
	 *
	 * @param immediate - True for open and save, which are discrete events the
	 *   user is waiting on; false for a keystroke, which is not.
	 */
	private schedule(document: vscode.TextDocument, immediate: boolean): void {
		if (kindForPath(document.uri.path) !== "bpmn") return

		const settings = vscode.workspace.getConfiguration("bpmnkit", document.uri)
		if (!settings.get<boolean>("lint.enabled", true)) {
			this.clear(document.uri)
			return
		}
		if (!immediate && settings.get<string>("lint.run", "onType") !== "onType") return

		const key = document.uri.toString()
		const existing = this.timers.get(key)
		if (existing !== undefined) clearTimeout(existing)

		if (immediate) {
			this.timers.delete(key)
			this.run(document)
			return
		}
		this.timers.set(
			key,
			setTimeout(() => {
				this.timers.delete(key)
				this.run(document)
			}, DEBOUNCE_MS),
		)
	}

	private run(document: vscode.TextDocument): void {
		const text = document.getText()
		let report: ReturnType<typeof lintDiagram>
		try {
			report = lintDiagram(Bpmn.parse(text), {
				forceEngineRules: vscode.workspace
					.getConfiguration("bpmnkit", document.uri)
					.get<boolean>("lint.forceEngineRules", false),
			})
		} catch {
			// A file mid-edit is routinely not parseable. The XML language service
			// already says so; repeating it here in a different voice, and then
			// clearing every real finding, would be worse than staying quiet.
			return
		}

		this.collection.set(
			document.uri,
			placeDiagnostics(text, report).map((placed) => {
				const range = new vscode.Range(
					document.positionAt(placed.span.offset),
					document.positionAt(placed.span.offset + placed.span.length),
				)
				const diagnostic = new vscode.Diagnostic(range, placed.message, SEVERITY[placed.severity])
				diagnostic.source = "bpmnkit"
				diagnostic.code = placed.code
				// The panel shows one line per problem, so the suggestion becomes a
				// child row instead of being folded into the message.
				diagnostic.relatedInformation = [
					new vscode.DiagnosticRelatedInformation(
						new vscode.Location(document.uri, range),
						placed.suggestion,
					),
				]
				return diagnostic
			}),
		)
	}

	private refreshAll(): void {
		for (const document of vscode.workspace.textDocuments) this.schedule(document, true)
	}

	private clear(uri: vscode.Uri): void {
		this.collection.delete(uri)
	}

	private forget(document: vscode.TextDocument): void {
		const key = document.uri.toString()
		const timer = this.timers.get(key)
		if (timer !== undefined) clearTimeout(timer)
		this.timers.delete(key)
		this.clear(document.uri)
	}

	private dispose(): void {
		for (const timer of this.timers.values()) clearTimeout(timer)
		this.timers.clear()
	}
}
