/**
 * The packages this repo publishes to npm, as workspace-relative directories.
 *
 * One list, because three scripts need it and a package missing from one of
 * them is exactly the drift they exist to catch: a package with no LICENSE, no
 * generated README, or one that never gets its tarball opened.
 *
 * Adding a package here is step one; see the "Adding a New Package" section of
 * CLAUDE.md for the rest.
 */
export const PUBLISHED = [
	"packages/core",
	"packages/canvas",
	"packages/editor",
	"packages/ui",
	"packages/plugins",
	"packages/engine",
	"packages/feel",
	"packages/api",
	"packages/ascii",
	"packages/markdown",
	"packages/docspack",
	"packages/camunda-docspack",
	"packages/profiles",
	"packages/operate",
	"packages/astro-shared",
	"packages/connector-gen",
	"packages/connectors",
	"packages/patterns",
	"packages/worker-client",
	"packages/user-tasks",
	"apps/cli",
	"packages/cli-sdk",
	"packages/create-casen-plugin",
	"apps/proxy",
	"apps/reebe-wasm",
	"plugins-cli/casen-report",
	"plugins-cli/casen-worker-http",
	"plugins-cli/casen-worker-ai",
]

/**
 * Published packages whose licence is not the repo's MIT, and the licence they carry instead.
 *
 * `@bpmnkit/camunda-docspack` carries documentation that belongs to Camunda Services GmbH, not
 * to BPMN Kit, published by them under CC BY-SA 3.0. Chunking that prose and rendering its
 * embedded diagrams as text make the package an Adaptation under §1 of that licence, and
 * ShareAlike then requires the result to carry the same terms — so it cannot be relicensed
 * MIT, and `sync-license.mjs` must not copy the root LICENCE over the one it ships.
 *
 * Keep this empty unless a package genuinely cannot be MIT. It is an exception, not an option.
 */
export const LICENSE_OVERRIDES = {
	"packages/camunda-docspack": "CC-BY-SA-3.0",
}

/**
 * The packages that carry the 1.0 stability promise.
 *
 * https://bpmnkit.com/docs/getting-started/stability is the contract; this is
 * the membership. A package belongs here when all three conditions that page
 * sets are true of it:
 *
 *   1. a test suite that would catch its own breakage,
 *   2. a documentation page on bpmnkit.com,
 *   3. an API worth defending for a year.
 *
 * Only the first two can be checked by a script, and `check-packages.mjs` does,
 * in both directions: nothing here may lack tests or a page, and nothing at
 * 1.0.0 or above may be missing from this list. The third is a judgement, and
 * the reasoning for each call is in `doc/release-1.0.0.md`.
 *
 * Joining later costs nothing — a package going 0.x → 1.0 breaks no one — so
 * the bar is applied strictly rather than generously. Most published packages
 * are deliberately not here.
 */
export const STABLE = [
	"packages/core",
	"packages/canvas",
	"packages/editor",
	"packages/plugins",
	"packages/engine",
	"packages/feel",
	"packages/api",
	"packages/ascii",
	"packages/docspack",
	"packages/connector-gen",
	"packages/connectors",
	"apps/cli",
]

/**
 * What each product tier promises, in one line. The labels and lines here are the ones
 * the READMEs and the site print.
 *
 * https://bpmnkit.com/docs/getting-started/stability#product-tiers is the long form.
 */
export const TIERS = {
	core: {
		label: "Core",
		promise: "Semver at 1.0: nothing breaks without a major release.",
	},
	tools: {
		label: "Tools",
		promise: "Maintained, on 0.x: a minor release can break, so pin a version.",
	},
	experimental: {
		label: "Experimental",
		promise: "May change or be discontinued. Not for production.",
	},
}

/**
 * The tier of every package in `PUBLISHED`, keyed by the same directory.
 *
 * `check-packages.mjs` holds this to three rules: every published package has a tier,
 * `core` is exactly `STABLE`, and nothing `experimental` is at 1.0 or above.
 */
export const TIER = {
	"packages/core": "core",
	"packages/canvas": "core",
	"packages/editor": "core",
	"packages/plugins": "core",
	"packages/engine": "core",
	"packages/feel": "core",
	"packages/api": "core",
	"packages/ascii": "core",
	"packages/docspack": "core",
	"packages/connector-gen": "core",
	"packages/connectors": "core",
	"apps/cli": "core",

	// The MCP server ships in the proxy and runs as `casen proxy mcp`.
	"apps/proxy": "tools",
	"packages/markdown": "tools",
	"packages/camunda-docspack": "tools",
	"packages/patterns": "tools",
	"packages/worker-client": "tools",
	"packages/cli-sdk": "tools",
	"packages/create-casen-plugin": "tools",
	"plugins-cli/casen-report": "tools",
	"plugins-cli/casen-worker-http": "tools",
	"plugins-cli/casen-worker-ai": "tools",
	// Plumbing that Core packages and the site depend on, so it is maintained with them.
	"packages/ui": "tools",
	"packages/profiles": "tools",
	"packages/astro-shared": "tools",

	"packages/operate": "experimental",
	"packages/user-tasks": "experimental",
	"apps/reebe-wasm": "experimental",
}

/**
 * Products that are not npm packages, each with the manifest its version is read from and
 * the documentation page that describes it, if there is one.
 */
export const APPS = [
	{
		dir: "apps/vscode",
		name: "BPMN Kit for VS Code",
		tier: "tools",
		manifest: "apps/vscode/package.json",
		description: "View, edit, lint, diff and simulate BPMN, DMN and Forms in VS Code",
		docs: "guides/vscode",
	},
	{
		dir: "apps/drop",
		name: "Drop",
		tier: "tools",
		manifest: "apps/drop/package.json",
		description: "Share a BPMN, DMN or Form file as a link at bpmnkit.com/drop",
		docs: "guides/drop",
	},
	{
		dir: "apps/reebe",
		name: "Reebe",
		tier: "experimental",
		manifest: "apps/reebe/package.json",
		description: "Single-node dev/test engine for the Zeebe API, in Rust. Not for production",
		docs: null,
	},
	{
		dir: "apps/studio",
		name: "Studio",
		tier: "experimental",
		manifest: "apps/studio/package.json",
		description: "Browser workspace for models, a local WASM engine and cluster monitoring",
		docs: null,
	},
	{
		dir: "apps/desktop",
		name: "Desktop app",
		tier: "experimental",
		manifest: "apps/desktop/package.json",
		description: "Tauri build of the editor for Windows, macOS and Linux",
		docs: null,
	},
	{
		dir: "apps/proxy-rs",
		name: "proxy-rs",
		tier: "experimental",
		manifest: "apps/proxy-rs/Cargo.toml",
		description: "Rust port of the AI bridge and MCP server, bundled with the desktop app",
		docs: null,
	},
]

/** The version a `package.json` or `Cargo.toml` manifest declares. */
export function manifestVersion(text, path) {
	const version = path.endsWith(".toml")
		? /^version\s*=\s*"([^"]+)"/m.exec(text)?.[1]
		: JSON.parse(text).version
	if (typeof version !== "string") throw new Error(`${path} declares no version`)
	return version
}
