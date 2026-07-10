// Bundles the browser client entry points into public/drop/assets/ with esbuild.
// The Worker itself is bundled by wrangler at deploy time.
import { build } from "esbuild"

await build({
	entryPoints: {
		drop: "src/client/drop.ts",
		viewer: "src/client/viewer.ts",
		admin: "src/client/admin.ts",
		landing: "src/client/landing.ts",
	},
	bundle: true,
	format: "esm",
	platform: "browser",
	target: "es2022",
	minify: true,
	sourcemap: false,
	outdir: "public/drop/assets",
	logLevel: "info",
})

console.log("client bundles written to public/drop/assets/")
