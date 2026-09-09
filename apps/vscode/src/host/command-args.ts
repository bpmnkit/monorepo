/**
 * What a command actually receives, which is not always what its menu suggests.
 *
 * The same command is contributed to the editor title bar, the Explorer context
 * menu and the Source Control panel. The first two hand it a `Uri`; the third
 * hands it a `SourceControlResourceState`, whose `Uri` is one field in. Getting
 * this wrong produces a command that works everywhere except the panel it was
 * mainly written for, so it is a shape check with tests rather than a cast.
 *
 * Nothing here imports `vscode` at runtime — the checks are structural — which
 * is what lets them be tested outside an extension host.
 */

import type { Uri } from "vscode"

function isUri(value: unknown): value is Uri {
	if (typeof value !== "object" || value === null) return false
	const candidate = value as { scheme?: unknown; path?: unknown }
	return typeof candidate.scheme === "string" && typeof candidate.path === "string"
}

/** The file a command was invoked on, from whichever menu invoked it. */
export function uriFromCommandArg(arg: unknown): Uri | null {
	if (isUri(arg)) return arg
	if (typeof arg === "object" && arg !== null) {
		const state = arg as { resourceUri?: unknown }
		if (isUri(state.resourceUri)) return state.resourceUri
	}
	return null
}

/**
 * The two files an Explorer multi-selection names, oldest first.
 *
 * VS Code passes the clicked item and then the whole selection, and the
 * selection is in the order the Explorer lists them — which is the order the
 * user sees, so it is the order the two panes get.
 */
export function pairFromCommandArgs(args: readonly unknown[]): readonly [Uri, Uri] | null {
	const list = args.find((arg): arg is unknown[] => Array.isArray(arg)) ?? []
	const uris = list.map(uriFromCommandArg).filter((uri): uri is Uri => uri !== null)
	if (uris.length !== 2) return null
	const [left, right] = uris
	return left !== undefined && right !== undefined ? [left, right] : null
}
