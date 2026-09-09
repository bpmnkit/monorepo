/**
 * What crosses the extension-host / webview boundary.
 *
 * The boundary is a `postMessage`, so everything here is plain data — the rule
 * `doc/port-pattern.md` states for anything a host forwards. Neither side
 * imports the other's world: this file names no `vscode` type and no DOM type,
 * which is why both `tsconfig.json` and `tsconfig.webview.json` can include it.
 *
 * @packageDocumentation
 */

/** The three artifact kinds the extension can show. */
export type ViewerKind = "bpmn" | "dmn" | "form"

/** Which colour scheme the webview should render in. */
export type ViewerTheme = "light" | "dark"

/** Extension host → webview. */
export type HostMessage =
	| {
			readonly type: "render"
			readonly kind: ViewerKind
			/** The file's text, exactly as it is on disk. */
			readonly text: string
			readonly theme: ViewerTheme
			readonly grid: boolean
			readonly minimap: boolean
	  }
	| {
			readonly type: "diff"
			readonly before: string
			readonly after: string
			/** Human labels for the two sides, e.g. `"HEAD"` and `"working tree"`. */
			readonly beforeLabel: string
			readonly afterLabel: string
			readonly theme: ViewerTheme
			readonly grid: boolean
	  }
	/** The theme changed while the view was open; re-render in place. */
	| { readonly type: "theme"; readonly theme: ViewerTheme }

/** Webview → extension host. */
export type WebviewMessage =
	/**
	 * The webview's script has run and is listening. The host must not send
	 * content before this arrives — a message posted into a webview that has not
	 * finished loading is dropped, and the view stays blank.
	 */
	| { readonly type: "ready" }
	/**
	 * Rendering failed. The host surfaces this, so a malformed file reads as an
	 * error the user can act on instead of an empty panel.
	 */
	| { readonly type: "error"; readonly message: string }
