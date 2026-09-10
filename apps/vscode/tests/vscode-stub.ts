/**
 * Just enough of the `vscode` module for `activate()` to run.
 *
 * The real module only exists inside a running editor, so `vitest.config.ts`
 * aliases it here. Everything is a recorder: the tests care about *what the
 * extension registers*, which is the half that can silently drift from
 * `package.json` and that `vsce package` does not check.
 */

export interface Registration {
	readonly kind: "customEditor" | "command"
	readonly id: string
}

export const registrations: Registration[] = []

/** Clears the recorder between tests. */
export function reset(): void {
	registrations.length = 0
}

const disposable = { dispose: () => {} }
const noopEvent = () => disposable

export class Disposable {
	constructor(private readonly onDispose: () => void = () => {}) {}
	dispose(): void {
		this.onDispose()
	}
}

export const ColorThemeKind = { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 } as const
export const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 } as const
export const ViewColumn = { Active: -1, Beside: -2 } as const

export const window = {
	activeColorTheme: { kind: ColorThemeKind.Dark },
	activeTextEditor: undefined,
	registerCustomEditorProvider(viewType: string) {
		registrations.push({ kind: "customEditor", id: viewType })
		return disposable
	},
	showErrorMessage: () => Promise.resolve(undefined),
	showInformationMessage: () => Promise.resolve(undefined),
	createWebviewPanel: () => {
		throw new Error("not needed for activation")
	},
	onDidChangeActiveColorTheme: noopEvent,
}

export const commands = {
	registerCommand(id: string) {
		registrations.push({ kind: "command", id })
		return disposable
	},
	executeCommand: () => Promise.resolve(undefined),
}

export const languages = {
	createDiagnosticCollection: () => ({
		set: () => {},
		delete: () => {},
		dispose: () => {},
	}),
}

export const workspace = {
	textDocuments: [] as unknown[],
	getConfiguration: () => ({ get: <T>(_key: string, fallback: T): T => fallback }),
	onDidOpenTextDocument: noopEvent,
	onDidSaveTextDocument: noopEvent,
	onDidChangeTextDocument: noopEvent,
	onDidCloseTextDocument: noopEvent,
	onDidChangeConfiguration: noopEvent,
	createFileSystemWatcher: () => ({
		onDidChange: noopEvent,
		onDidCreate: noopEvent,
		dispose: () => {},
	}),
	openTextDocument: () => Promise.resolve({}),
	fs: { readFile: () => Promise.resolve(new Uint8Array()) },
}

export const extensions = { getExtension: () => undefined }

export const Uri = {
	joinPath: (base: unknown, ...parts: string[]) => ({ path: parts.join("/"), base }),
}

export class RelativePattern {
	constructor(
		readonly base: unknown,
		readonly pattern: string,
	) {}
}
