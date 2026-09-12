// Bundles the browser client entry points into public/drop/assets/ with esbuild,
// generates the use-case mini-diagram SVGs at build time (no runtime cost), and
// copies the design-system webfonts out of the landing app so Drop serves them
// from its own origin instead of depending on the marketing site's routes.
// The Worker itself is bundled by wrangler at deploy time.
import { cp, mkdir, writeFile } from "node:fs/promises"
import { expand, exportSvg } from "@bpmnkit/core"
import { build } from "esbuild"

const shared = {
	bundle: true,
	format: "esm",
	platform: "browser",
	target: "es2022",
	minify: true,
	sourcemap: false,
	outdir: "public/drop/assets",
	logLevel: "info",
}

await build({
	entryPoints: {
		drop: "src/client/drop.ts",
		diff: "src/client/diff.ts",
		admin: "src/client/admin.ts",
		landing: "src/client/landing.ts",
	},
	...shared,
})

// The viewer is built on its own, with splitting, because it is the only entry
// with a dynamic `import()`: the editor is fetched when someone presses Edit and
// never by the far larger number of people who only read a drop. Splitting the
// other entries alongside it would be worse, not better — esbuild would hoist
// what they share into chunks, and gzip compresses several small files
// noticeably worse than one large one, so readers would pay for a split that
// buys them nothing.
await build({
	entryPoints: { viewer: "src/client/viewer.ts" },
	...shared,
	splitting: true,
})

// ── Use-case mini-diagrams (rendered once, served as a static asset) ─────────
const mini = (id, elements, flows) =>
	exportSvg(expand({ id, processes: [{ id: `${id}_p`, elements, flows }] }), { padding: 12 })

const usecases = {
	review: mini(
		"review",
		[
			{ id: "a", type: "startEvent", name: "Open PR" },
			{ id: "b", type: "userTask", name: "Review" },
			{ id: "c", type: "endEvent", name: "Merge" },
		],
		[
			{ id: "1", from: "a", to: "b" },
			{ id: "2", from: "b", to: "c" },
		],
	),
	incident: mini(
		"incident",
		[
			{ id: "a", type: "startEvent", name: "Alert" },
			{ id: "b", type: "serviceTask", name: "Triage" },
			{ id: "g", type: "exclusiveGateway", name: "" },
			{ id: "c", type: "endEvent", name: "Resolved" },
		],
		[
			{ id: "1", from: "a", to: "b" },
			{ id: "2", from: "b", to: "g" },
			{ id: "3", from: "g", to: "c" },
		],
	),
	docs: mini(
		"docs",
		[
			{ id: "a", type: "startEvent", name: "Draft" },
			{ id: "b", type: "userTask", name: "Approve" },
			{ id: "c", type: "endEvent", name: "Publish" },
		],
		[
			{ id: "1", from: "a", to: "b" },
			{ id: "2", from: "b", to: "c" },
		],
	),
	handoff: mini(
		"handoff",
		[
			{ id: "a", type: "startEvent", name: "Design" },
			{ id: "b", type: "serviceTask", name: "Deploy" },
			{ id: "c", type: "endEvent", name: "Live" },
		],
		[
			{ id: "1", from: "a", to: "b" },
			{ id: "2", from: "b", to: "c" },
		],
	),
}

await mkdir("public/drop/assets", { recursive: true })
await writeFile("public/drop/assets/usecases.json", JSON.stringify(usecases))

// ── Webfonts (Space Grotesk + Space Mono, both OFL 1.1) ─────────────────────
// Copied verbatim, licences included, from the single set the landing app owns.
await cp("../landing/public/fonts", "public/drop/fonts", { recursive: true })

console.log("client bundles + usecases.json + fonts written to public/drop/")
