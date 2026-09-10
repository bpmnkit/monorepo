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
import { renderForPaste } from "./host/ascii.js"
import {
	DeployError,
	type DeployTarget,
	type DeployedProcess,
	deployResource,
	listDeployTargets,
	parseVariables,
	startInstance,
} from "./host/camunda.js"
import { pairFromCommandArgs, uriFromCommandArg } from "./host/command-args.js"
import { DiagramEditorProvider } from "./host/diagram-editor.js"
import { openDiffPanel } from "./host/diff-panel.js"
import { kindForPath, viewTypeFor } from "./host/documents.js"
import { openFeelPanel, selectedExpression } from "./host/feel-panel.js"
import { basename, readText } from "./host/files.js"
import { GitUnavailableError, readAtRef } from "./host/git.js"
import { LintProvider } from "./host/lint-provider.js"
import { type Payload, discoverPayloads } from "./host/payloads.js"

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		...DiagramEditorProvider.register(context),
		...LintProvider.register(),
		vscode.commands.registerCommand("bpmnkit.openPreview", (arg: unknown) => openPreview(arg)),
		vscode.commands.registerCommand("bpmnkit.diffWithHead", (arg: unknown) =>
			diffWithHead(context, arg),
		),
		vscode.commands.registerCommand("bpmnkit.compareSelected", (...args: unknown[]) =>
			compareSelected(context, args),
		),
		vscode.commands.registerCommand("bpmnkit.feelPlayground", () => {
			openFeelPanel(context, selectedExpression(vscode.window.activeTextEditor))
		}),
		vscode.commands.registerCommand("bpmnkit.copyAscii", (arg: unknown) => copyAscii(arg)),
		vscode.commands.registerCommand("bpmnkit.deploy", (arg: unknown) => deploy(arg, false)),
		vscode.commands.registerCommand("bpmnkit.deployAndStart", (arg: unknown) => deploy(arg, true)),
	)
}

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

// ── ASCII ────────────────────────────────────────────────────────────────────

async function copyAscii(arg: unknown): Promise<void> {
	const uri = target(arg)
	if (uri === null || kindForPath(uri.path) !== "bpmn") {
		void vscode.window.showInformationMessage("Open a .bpmn file to render it as text.")
		return
	}

	let art: string
	try {
		art = renderForPaste(await readText(uri))
	} catch (error) {
		void vscode.window.showErrorMessage(
			`Could not render ${basename(uri)}: ${error instanceof Error ? error.message : String(error)}`,
		)
		return
	}

	await vscode.env.clipboard.writeText(art)
	const choice = await vscode.window.showInformationMessage(
		`${basename(uri)} copied as text.`,
		"Show",
	)
	if (choice !== "Show") return

	// Markdown, because the rendering is a fenced block and the reader is about
	// to paste it somewhere that renders one.
	const preview = await vscode.workspace.openTextDocument({ content: art, language: "markdown" })
	await vscode.window.showTextDocument(preview, { preview: true })
}

// ── Deploy ───────────────────────────────────────────────────────────────────

/**
 * Deploys the open resource to a cluster `casen` knows about, and optionally
 * starts an instance of what was deployed.
 */
async function deploy(arg: unknown, andStart: boolean): Promise<void> {
	const uri = target(arg)
	if (uri === null || kindForPath(uri.path) === null) {
		void vscode.window.showInformationMessage("Open a .bpmn, .dmn or .form file to deploy it.")
		return
	}

	const profile = await pickProfile()
	if (profile === null) return

	const content = await readText(uri)
	try {
		const deployed = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: `Deploying to ${profile.name}…` },
			() => deployResource(profile.name, basename(uri), content),
		)

		if (!andStart) {
			void vscode.window.showInformationMessage(describeDeployment(deployed, profile.name))
			return
		}
		await start(deployed, profile, uri)
	} catch (error) {
		void vscode.window.showErrorMessage(
			error instanceof DeployError ? error.message : `Deploy failed: ${String(error)}`,
		)
	}
}

/** What the cluster accepted, said in one line. */
function describeDeployment(deployed: DeployedProcess[], profileName: string): string {
	if (deployed.length === 0) return `Deployed to ${profileName}.`
	const names = deployed
		.map((process) => `${process.processDefinitionId} v${process.version}`)
		.join(", ")
	return `Deployed ${names} to ${profileName}.`
}

/**
 * Starts an instance of what was just deployed.
 *
 * By key rather than by process id: the key names the version this deploy
 * produced, so the instance runs the diagram on screen even if someone else
 * deployed a newer one a second ago.
 */
async function start(
	deployed: DeployedProcess[],
	profile: DeployTarget,
	uri: vscode.Uri,
): Promise<void> {
	const first = deployed[0]
	if (first === undefined) {
		void vscode.window.showInformationMessage(
			"Deployed, but the file holds no process to start an instance of.",
		)
		return
	}

	const chosen =
		deployed.length === 1
			? first
			: (
					await vscode.window.showQuickPick(
						deployed.map((process) => ({ label: process.processDefinitionId, process })),
						{ title: "Start an instance of which process?" },
					)
				)?.process
	if (chosen === undefined) return

	const variables = await pickVariables(uri, chosen.processDefinitionId)
	if (variables === null) return

	const key = await startInstance(profile.name, chosen.processDefinitionKey, variables)
	void vscode.window.showInformationMessage(
		`Started ${chosen.processDefinitionId} on ${profile.name} — instance ${key}.`,
	)
}

/**
 * Which cluster to deploy to.
 *
 * One profile is not a choice, so it is not offered as one. Several is, and the
 * active one leads — but a deploy is the kind of thing where picking the wrong
 * cluster matters, so it is never silently assumed when there is more than one.
 */
async function pickProfile(): Promise<DeployTarget | null> {
	const targets = listDeployTargets()
	if (targets.length === 0) {
		void vscode.window.showErrorMessage(
			"No Camunda 8 profile configured. Create one with: casen profile create <name> --base-url <url>",
		)
		return null
	}
	const only = targets[0]
	if (targets.length === 1 && only !== undefined) return only

	const picked = await vscode.window.showQuickPick(
		targets.map((profile) => ({
			label: profile.name,
			description: profile.active ? "$(check) active" : "",
			detail: profile.baseUrl,
			profile,
		})),
		{ title: "Deploy to which cluster?", matchOnDetail: true },
	)
	return picked?.profile ?? null
}

export function deactivate(): void {}

/**
 * The variables to start with: a payload from the repository, or typed in.
 *
 * Payloads found beside the diagram lead, because a process is tried with the
 * same three or four inputs over and over and none of them should have to be
 * retyped. Typing stays available, and is the only option when there are none —
 * a picker whose one entry says "type it" is a worse prompt than the box.
 */
async function pickVariables(
	uri: vscode.Uri,
	processDefinitionId: string,
): Promise<Record<string, unknown> | null> {
	const folder = vscode.workspace.getWorkspaceFolder(uri)
	const { payloads, problems } = await discoverPayloads(uri.fsPath, folder?.uri.fsPath)
	for (const problem of problems) {
		void vscode.window.showWarningMessage(`Ignoring ${problem.path}: ${problem.message}`)
	}

	if (payloads.length > 0) {
		const picked = await vscode.window.showQuickPick(
			[
				...payloads.map((payload: Payload) => ({
					label: payload.name,
					description: `${Object.keys(payload.variables).length} variables`,
					detail: payload.path,
					payload: payload as Payload | null | undefined,
				})),
				{ label: "$(edit) Type variables…", payload: null },
				{ label: "$(circle-slash) No variables", payload: undefined },
			],
			{ title: `Start ${processDefinitionId} with`, matchOnDetail: true },
		)
		if (picked === undefined) return null
		if (picked.payload === undefined) return {}
		if (picked.payload !== null) return picked.payload.variables
	}

	const typed = await vscode.window.showInputBox({
		title: `Variables for ${processDefinitionId}`,
		prompt: "JSON object, or empty for none",
		placeHolder: '{"amount": 100}',
		validateInput: (value) => {
			try {
				parseVariables(value)
				return null
			} catch (error) {
				return error instanceof Error ? error.message : String(error)
			}
		},
	})
	return typed === undefined ? null : parseVariables(typed)
}
