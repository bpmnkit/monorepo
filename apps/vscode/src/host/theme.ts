/** Which colour scheme the webviews should draw in, from the editor's theme. */
import * as vscode from "vscode"
import type { ViewerTheme } from "../shared/protocol.js"

/**
 * The active editor theme as a viewer theme.
 *
 * VS Code has four theme kinds and the canvas has two, so the high-contrast
 * kinds map onto the polarity they share: high-contrast-light is a light theme
 * with more contrast, not a third thing.
 */
export function currentTheme(): ViewerTheme {
	const kind = vscode.window.activeColorTheme.kind
	return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight
		? "light"
		: "dark"
}
