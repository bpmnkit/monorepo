// Two bundles with nothing in common: the extension host runs in Node with the
// `vscode` module injected, the webviews run in a browser with no Node at all.
// esbuild rather than tsc because both halves pull in workspace packages that
// ship ESM only, and the host has to end up as CommonJS.
import { copyFile, rm } from "node:fs/promises"
import { build } from "esbuild"
import "./gen-icon.mjs"

// Clear the output first. esbuild writes over what it produces and leaves
// everything else, so a renamed entry point stays in dist/ and gets packaged —
// a dead bundle in the .vsix that nothing loads and every user downloads.
await rm(new URL("../dist/", import.meta.url), { recursive: true, force: true })

// The .vsix carries its own licence; copying the repository's keeps the two from
// ever disagreeing, the same reason the Marketplace icon is rendered rather than
// drawn.
await copyFile(new URL("../../../LICENSE", import.meta.url), new URL("../LICENSE", import.meta.url))

await build({
	entryPoints: { extension: "src/extension.ts" },
	bundle: true,
	format: "cjs",
	platform: "node",
	target: "node20",
	// Provided by the extension host at runtime; bundling it would break it.
	external: ["vscode"],
	outdir: "dist",
	outExtension: { ".js": ".cjs" },
	minify: true,
	sourcemap: false,
	logLevel: "info",
})

await build({
	entryPoints: {
		editor: "src/webview/editor.ts",
		diff: "src/webview/diff.ts",
		feel: "src/webview/feel.ts",
	},
	bundle: true,
	format: "esm",
	platform: "browser",
	target: "es2022",
	outdir: "dist/webview",
	minify: true,
	sourcemap: false,
	logLevel: "info",
})
