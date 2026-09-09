/** Reading the file a user is actually looking at. */
import { posix } from "node:path"
import * as vscode from "vscode"

/**
 * A file's current text.
 *
 * An open text document wins over the bytes on disk: a preview or a comparison
 * should show what the author is looking at, and for an unsaved buffer that is
 * not what the file says.
 */
export async function readText(uri: vscode.Uri): Promise<string> {
	const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString())
	if (open !== undefined) return open.getText()
	return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri))
}

/** The file's name, without its directories. */
export function basename(uri: vscode.Uri): string {
	return posix.basename(uri.path)
}
