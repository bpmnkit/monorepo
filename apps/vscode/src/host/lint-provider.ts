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
 *
 * A `.bpmnlintrc` in the file's folder or above is honoured the way `casen
 * lint` honours it: its levels govern BPMN Kit's equivalent findings, and when
 * the workspace has bpmnlint installed, that bpmnlint runs the configured rules
 * — plugins included — in place of the equivalents.
 */

import { Bpmn, type BpmnDefinitions, lintDiagram } from "@bpmnkit/core"
import { type BpmnlintSetup, prepareBpmnlint } from "@bpmnkit/core/node"
import * as vscode from "vscode"
import {
	type PlacedDiagnostic,
	bpmnlintNotice,
	placeBpmnlintReports,
	placeDiagnostics,
} from "./diagnostics.js"
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
			...provider.watchBpmnlintrc(),
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
			void this.run(document)
			return
		}
		this.timers.set(
			key,
			setTimeout(() => {
				this.timers.delete(key)
				void this.run(document)
			}, DEBOUNCE_MS),
		)
	}

	/** A `.bpmnlintrc` appearing, changing or going away changes every file under it. */
	private watchBpmnlintrc(): vscode.Disposable[] {
		const watcher = vscode.workspace.createFileSystemWatcher("**/.bpmnlintrc")
		return [
			watcher,
			watcher.onDidCreate(() => this.refreshAll()),
			watcher.onDidChange(() => this.refreshAll()),
			watcher.onDidDelete(() => this.refreshAll()),
		]
	}

	/**
	 * The `.bpmnlintrc` setup for a document, or a problem to show instead.
	 * Only files on disk have a folder to find one in.
	 */
	private async bpmnlint(
		document: vscode.TextDocument,
		text: string,
	): Promise<{ setup?: BpmnlintSetup; problem?: PlacedDiagnostic }> {
		const settings = vscode.workspace.getConfiguration("bpmnkit", document.uri)
		if (document.uri.scheme !== "file" || !settings.get<boolean>("lint.bpmnlintrc", true)) {
			return {}
		}
		try {
			const setup = await prepareBpmnlint(document.uri.fsPath, text)
			return setup === undefined ? {} : { setup }
		} catch (err) {
			// A broken .bpmnlintrc is the user's to fix; say so where they are looking.
			return {
				problem: {
					span: { offset: 0, length: 0 },
					severity: "error",
					message: (err as Error).message,
					suggestion: "Fix the .bpmnlintrc, or turn off bpmnkit.lint.bpmnlintrc.",
					code: "bpmnlintrc",
					source: "bpmnkit",
				},
			}
		}
	}

	private async run(document: vscode.TextDocument): Promise<void> {
		const text = document.getText()
		const version = document.version
		let definitions: BpmnDefinitions
		try {
			definitions = Bpmn.parse(text)
		} catch {
			// A file mid-edit is routinely not parseable. The XML language service
			// already says so; repeating it here in a different voice, and then
			// clearing every real finding, would be worse than staying quiet.
			return
		}

		const { setup, problem } = await this.bpmnlint(document, text)
		// Typing continued while bpmnlint ran; the run scheduled for that edit wins.
		if (document.version !== version || document.isClosed) return

		const report = lintDiagram(definitions, {
			forceEngineRules: vscode.workspace
				.getConfiguration("bpmnkit", document.uri)
				.get<boolean>("lint.forceEngineRules", false),
			...(setup !== undefined
				? { bpmnlint: setup.config, bpmnlintDelegated: setup.delegated }
				: {}),
		})
		const notice =
			setup === undefined
				? undefined
				: bpmnlintNotice(setup.path, report.bpmnlintUnsupported ?? [], setup.failure)
		const placedAll = [
			...placeDiagnostics(text, report),
			...placeBpmnlintReports(text, setup?.reports ?? []),
			...(notice !== undefined ? [notice] : []),
			...(problem !== undefined ? [problem] : []),
		]

		this.collection.set(
			document.uri,
			placedAll.map((placed) => {
				const range = new vscode.Range(
					document.positionAt(placed.span.offset),
					document.positionAt(placed.span.offset + placed.span.length),
				)
				const diagnostic = new vscode.Diagnostic(range, placed.message, SEVERITY[placed.severity])
				diagnostic.source = placed.source
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
