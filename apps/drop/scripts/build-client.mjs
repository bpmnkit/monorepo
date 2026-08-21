// Bundles the browser client entry points into public/drop/assets/ with esbuild,
// and generates the use-case mini-diagram SVGs at build time (no runtime cost).
// The Worker itself is bundled by wrangler at deploy time.
import { mkdir, writeFile } from "node:fs/promises"
import { expand, exportSvg } from "@bpmnkit/core"
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

console.log("client bundles + usecases.json written to public/drop/assets/")
