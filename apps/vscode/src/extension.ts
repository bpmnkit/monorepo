/**
 * BPMN Kit for VS Code — activation.
 *
 * Everything this file does is registration. The features themselves live in
 * `src/host/`, and the halves of them that are not about VS Code live in
 * modules that do not import it — which is what makes them testable without an
 * extension host, and is the same seam `doc/port-pattern.md` describes for the
 * canvas plugins.
 */

import * as vscode from "vscode"
import { pairFromCommandArgs, uriFromCommandArg } from "./host/command-args.js"
import { openDiffPanel } from "./host/diff-panel.js"
import { kindForPath, viewTypeFor } from "./host/documents.js"
import { basename, readText } from "./host/files.js"
import { GitUnavailableError, readAtRef } from "./host/git.js"
import { LintProvider } from "./host/lint-provider.js"
import { ViewerEditorProvider } from "./host/viewer-editor.js"

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		...ViewerEditorProvider.register(context),
		...LintProvider.register(),
		vscode.commands.registerCommand("bpmnkit.openPreview", (arg: unknown) => openPreview(arg)),
		vscode.commands.registerCommand("bpmnkit.diffWithHead", (arg: unknown) =>
			diffWithHead(context, arg),
		),
		vscode.commands.registerCommand("bpmnkit.compareSelected", (...args: unknown[]) =>
			compareSelected(context, args),
		),
	)
}

export function deactivate(): void {}

/** The file a command should act on: the one it was given, else the active editor's. */
function target(arg: unknown): vscode.Uri | null {
	return uriFromCommandArg(arg) ?? vscode.window.activeTextEditor?.document.uri ?? null
}

async function openPreview(arg: unknown): Promise<void> {
	const uri = target(arg)
	const kind = uri === null ? null : kindForPath(uri.path)
	if (uri === null || kind === null) {
		void vscode.window.showInformationMessage("Open a .bpmn, .dmn or .form file first.")
		return
	}
	await vscode.commands.executeCommand("vscode.openWith", uri, viewTypeFor(kind), {
		viewColumn: vscode.ViewColumn.Beside,
		preserveFocus: true,
	})
}

async function diffWithHead(context: vscode.ExtensionContext, arg: unknown): Promise<void> {
	const uri = target(arg)
	if (uri === null || kindForPath(uri.path) !== "bpmn") {
		void vscode.window.showInformationMessage("Open a .bpmn file to compare it with HEAD.")
		return
	}

	let before: string | null
	try {
		before = await readAtRef(uri, "HEAD")
	} catch (error) {
		void vscode.window.showErrorMessage(
			error instanceof GitUnavailableError ? error.message : String(error),
		)
		return
	}

	if (before === null) {
		void vscode.window.showInformationMessage(
			`${basename(uri)} is not in HEAD yet, so there is no earlier version to compare it with.`,
		)
		return
	}

	openDiffPanel(context, {
		before,
		after: await readText(uri),
		beforeLabel: `${basename(uri)} (HEAD)`,
		afterLabel: `${basename(uri)} (working tree)`,
	})
}

async function compareSelected(
	context: vscode.ExtensionContext,
	args: readonly unknown[],
): Promise<void> {
	const pair = pairFromCommandArgs(args)
	if (pair === null) {
		void vscode.window.showInformationMessage("Select exactly two .bpmn files to compare.")
		return
	}

	const [left, right] = pair
	openDiffPanel(context, {
		before: await readText(left),
		after: await readText(right),
		beforeLabel: basename(left),
		afterLabel: basename(right),
	})
}
