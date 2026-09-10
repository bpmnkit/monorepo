/**
 * Reading a file as it is at a git ref, through the built-in Git extension.
 *
 * Shelling out to `git` would work and is worse: the built-in extension already
 * knows which repository a file belongs to, handles worktrees and submodules,
 * and is the same source the Source Control panel is showing. Its API is not in
 * `@types/vscode`, so the two calls this needs are declared structurally below
 * rather than pulling in another dependency for two method signatures.
 */

import * as vscode from "vscode"

interface GitRepository {
	/** The file's content at `ref`. Rejects when the file is not in that commit. */
	show(ref: string, path: string): Promise<string>
}

interface GitApi {
	getRepository(uri: vscode.Uri): GitRepository | null
}

interface GitExtensionExports {
	getAPI(version: 1): GitApi
}

/** Raised when the comparison cannot be set up, with a message worth showing. */
export class GitUnavailableError extends Error {}

/**
 * The file's content at a git ref, or `null` when the ref does not have it.
 *
 * `null` is the everyday case, not a failure: comparing a newly added diagram
 * against HEAD means there is no earlier version, and the caller should say so
 * rather than report an error.
 *
 * @param uri - The working-tree file.
 * @param ref - A git ref. Defaults to `HEAD`.
 * @throws GitUnavailableError when git itself is not available for this file.
 */
export async function readAtRef(uri: vscode.Uri, ref = "HEAD"): Promise<string | null> {
	const extension = vscode.extensions.getExtension<GitExtensionExports>("vscode.git")
	if (extension === undefined) {
		throw new GitUnavailableError(
			"The built-in Git extension is disabled, so there is nothing to compare against.",
		)
	}

	const exports = extension.isActive ? extension.exports : await extension.activate()
	const repository = exports.getAPI(1).getRepository(uri)
	if (repository === null) {
		throw new GitUnavailableError(`${uri.fsPath} is not inside a git repository.`)
	}

	try {
		return await repository.show(ref, uri.fsPath)
	} catch {
		// `show` rejects for a path the ref does not contain, which is exactly
		// what an untracked or newly added file looks like.
		return null
	}
}
