// Bundles the `casen dev` browser UI into dist/dev-ui/app.js.
//
// The editor, its plugins and the engine run in the browser, so they are
// bundled here, at build time, rather than installed with the CLI: a user of
// `casen` downloads one pre-built script instead of the editor's dependency
// tree, and the dev server needs nothing but Node built-ins to serve it.
// dist/**/*.js is already in the package's `files`, so the tarball carries it.
import { rm } from "node:fs/promises"
import { build } from "esbuild"

const outdir = new URL("../dist/dev-ui/", import.meta.url)
await rm(outdir, { recursive: true, force: true })

await build({
	entryPoints: { app: "dev-ui/app.ts" },
	bundle: true,
	format: "esm",
	platform: "browser",
	target: "es2022",
	outdir: "dist/dev-ui",
	// The engine's optional WASM runner is never imported by the UI; nothing
	// Node-only may end up in a browser bundle.
	minify: true,
	sourcemap: false,
	logLevel: "warning",
})
