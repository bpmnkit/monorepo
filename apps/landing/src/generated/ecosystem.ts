/**
 * Every package this repo publishes, as its manifest states it.
 *
 * **Auto-generated** by `scripts/generate-ecosystem.mjs` from
 * `scripts/published-packages.mjs` and each package's own `package.json`, on
 * every `dev` and `build`. Do not edit it by hand — a version typed twice is a
 * version that drifts, which is the bug this file exists to make impossible.
 *
 * Editorial copy lives in `content.ts`; this file carries only facts.
 */

/** A product's public tier. `TIERS` says what each one promises. */
export type Tier = "core" | "tools" | "experimental"

export const TIERS: Readonly<Record<Tier, { readonly label: string; readonly promise: string }>> = {
	"core": {
		"label": "Core",
		"promise": "Semver at 1.0: nothing breaks without a major release."
	},
	"tools": {
		"label": "Tools",
		"promise": "Maintained, on 0.x: a minor release can break, so pin a version."
	},
	"experimental": {
		"label": "Experimental",
		"promise": "May change or be discontinued. Not for production."
	}
}

export interface PackageFact {
	/** Workspace-relative directory, e.g. `packages/core`. */
	readonly dir: string
	/** npm package name. */
	readonly name: string
	/** The version in the package's own manifest — what the next release publishes. */
	readonly version: string
	/** The manifest's `description`, used when `content.ts` has nothing to say. */
	readonly description: string
	readonly tier: Tier
	readonly npm: string
	readonly github: string
	/** Collection id of the docs page that describes it, e.g. `packages/core`, or null. */
	readonly docs: string | null
}

export const PACKAGE_FACTS: readonly PackageFact[] = [
	{
		dir: "packages/api",
		name: "@bpmnkit/api",
		version: "1.0.0",
		description: "TypeScript client for the Camunda 8 REST API — 180 typed operations, OAuth2, retries, and caching",
		tier: "core",
		npm: "https://www.npmjs.com/package/@bpmnkit/api",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/api",
		docs: "packages/api",
	},
	{
		dir: "packages/ascii",
		name: "@bpmnkit/ascii",
		version: "1.0.0",
		description: "Render BPMN diagrams as Unicode box-drawing ASCII art — perfect for terminals and docs",
		tier: "core",
		npm: "https://www.npmjs.com/package/@bpmnkit/ascii",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/ascii",
		docs: "packages/ascii",
	},
	{
		dir: "packages/astro-shared",
		name: "@bpmnkit/astro-shared",
		version: "0.1.1",
		description: "Shared CSS design tokens, page ground, and site metadata for BPMN Kit Astro apps",
		tier: "tools",
		npm: "https://www.npmjs.com/package/@bpmnkit/astro-shared",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/astro-shared",
		docs: null,
	},
	{
		dir: "packages/camunda-docspack",
		name: "@bpmnkit/camunda-docspack",
		version: "0.1.3",
		description: "Camunda 8 documentation as an offline, version-locked docspack package for AI agents",
		tier: "tools",
		npm: "https://www.npmjs.com/package/@bpmnkit/camunda-docspack",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/camunda-docspack",
		docs: "packages/camunda-docspack",
	},
	{
		dir: "packages/canvas",
		name: "@bpmnkit/canvas",
		version: "1.0.0",
		description: "Zero-dependency SVG BPMN viewer with pan/zoom, theming, and a plugin API",
		tier: "core",
		npm: "https://www.npmjs.com/package/@bpmnkit/canvas",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/canvas",
		docs: "packages/canvas",
	},
	{
		dir: "plugins-cli/casen-report",
		name: "@bpmnkit/casen-report",
		version: "0.1.11",
		description: "Render HTML reports from Camunda 8 incident and SLA data",
		tier: "tools",
		npm: "https://www.npmjs.com/package/@bpmnkit/casen-report",
		github: "https://github.com/bpmnkit/monorepo/tree/main/plugins-cli/casen-report",
		docs: null,
	},
	{
		dir: "plugins-cli/casen-worker-ai",
		name: "@bpmnkit/casen-worker-ai",
		version: "0.1.10",
		description: "AI task worker plugin for casen — classify, summarize, extract, and decide using Claude",
		tier: "tools",
		npm: "https://www.npmjs.com/package/@bpmnkit/casen-worker-ai",
		github: "https://github.com/bpmnkit/monorepo/tree/main/plugins-cli/casen-worker-ai",
		docs: null,
	},
	{
		dir: "plugins-cli/casen-worker-http",
		name: "@bpmnkit/casen-worker-http",
		version: "0.1.10",
		description: "Example casen worker plugin — processes HTTP connector jobs using the JSONPlaceholder API",
		tier: "tools",
		npm: "https://www.npmjs.com/package/@bpmnkit/casen-worker-http",
		github: "https://github.com/bpmnkit/monorepo/tree/main/plugins-cli/casen-worker-http",
		docs: null,
	},
	{
		dir: "apps/cli",
		name: "@bpmnkit/cli",
		version: "1.0.0",
		description: "Command-line interface for Camunda 8 — deploy, manage, and monitor processes from the terminal",
		tier: "core",
		npm: "https://www.npmjs.com/package/@bpmnkit/cli",
		github: "https://github.com/bpmnkit/monorepo/tree/main/apps/cli",
		docs: "cli/casen",
	},
	{
		dir: "packages/cli-sdk",
		name: "@bpmnkit/cli-sdk",
		version: "0.0.10",
		description: "Plugin authoring SDK for the casen CLI",
		tier: "tools",
		npm: "https://www.npmjs.com/package/@bpmnkit/cli-sdk",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/cli-sdk",
		docs: null,
	},
	{
		dir: "packages/connector-gen",
		name: "@bpmnkit/connector-gen",
		version: "1.0.0",
		description: "Generate Camunda REST connector element templates from OpenAPI/Swagger specs",
		tier: "core",
		npm: "https://www.npmjs.com/package/@bpmnkit/connector-gen",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/connector-gen",
		docs: "packages/connector-gen",
	},
	{
		dir: "packages/connectors",
		name: "@bpmnkit/connectors",
		version: "1.0.0",
		description: "Camunda 8 out-of-the-box connector catalog and deterministic element-template application for @bpmnkit/core",
		tier: "core",
		npm: "https://www.npmjs.com/package/@bpmnkit/connectors",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/connectors",
		docs: "packages/connectors",
	},
	{
		dir: "packages/core",
		name: "@bpmnkit/core",
		version: "1.0.0",
		description: "TypeScript-first BPMN 2.0 SDK — parse, build, layout, and optimize diagrams",
		tier: "core",
		npm: "https://www.npmjs.com/package/@bpmnkit/core",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/core",
		docs: "packages/core",
	},
	{
		dir: "packages/create-casen-plugin",
		name: "@bpmnkit/create-casen-plugin",
		version: "0.0.10",
		description: "Scaffold a new casen CLI plugin in seconds",
		tier: "tools",
		npm: "https://www.npmjs.com/package/@bpmnkit/create-casen-plugin",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/create-casen-plugin",
		docs: null,
	},
	{
		dir: "packages/docspack",
		name: "@bpmnkit/docspack",
		version: "1.0.0",
		description: "BPMN Kit documentation as an offline, version-locked docspack package with a built-in search CLI for AI agents",
		tier: "core",
		npm: "https://www.npmjs.com/package/@bpmnkit/docspack",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/docspack",
		docs: "packages/docspack",
	},
	{
		dir: "packages/editor",
		name: "@bpmnkit/editor",
		version: "1.0.0",
		description: "Full-featured interactive BPMN editor with undo/redo, HUD, and side-dock UI",
		tier: "core",
		npm: "https://www.npmjs.com/package/@bpmnkit/editor",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/editor",
		docs: "packages/editor",
	},
	{
		dir: "packages/engine",
		name: "@bpmnkit/engine",
		version: "1.0.0",
		description: "Lightweight BPMN 2.0 process simulator for tests and demos in browsers and Node.js — zero dependencies",
		tier: "core",
		npm: "https://www.npmjs.com/package/@bpmnkit/engine",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/engine",
		docs: "packages/engine",
	},
	{
		dir: "packages/feel",
		name: "@bpmnkit/feel",
		version: "1.0.0",
		description: "FEEL (Friendly Enough Expression Language) parser, evaluator, formatter and highlighter — 94% DMN TCK conformance",
		tier: "core",
		npm: "https://www.npmjs.com/package/@bpmnkit/feel",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/feel",
		docs: "packages/feel",
	},
	{
		dir: "packages/markdown",
		name: "@bpmnkit/markdown",
		version: "0.0.0",
		description: "Real BPMN diagrams in Markdown — render bpmn and bpmn-compact code blocks to inline, themeable, accessible SVG",
		tier: "tools",
		npm: "https://www.npmjs.com/package/@bpmnkit/markdown",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/markdown",
		docs: null,
	},
	{
		dir: "packages/operate",
		name: "@bpmnkit/operate",
		version: "0.1.5",
		description: "Lightweight monitoring and operations UI for Camunda 8 dev clusters, C8 Run and SaaS trials",
		tier: "experimental",
		npm: "https://www.npmjs.com/package/@bpmnkit/operate",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/operate",
		docs: "packages/operate",
	},
	{
		dir: "packages/patterns",
		name: "@bpmnkit/patterns",
		version: "0.0.6",
		description: "Domain process patterns for BPMNKit AIKit — compact BPMN templates and worker specs for common business processes",
		tier: "tools",
		npm: "https://www.npmjs.com/package/@bpmnkit/patterns",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/patterns",
		docs: null,
	},
	{
		dir: "packages/plugins",
		name: "@bpmnkit/plugins",
		version: "1.0.0",
		description: "34 composable canvas plugins for BPMN editors and viewers — minimap, AI chat, process simulation, storage, and more",
		tier: "core",
		npm: "https://www.npmjs.com/package/@bpmnkit/plugins",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/plugins",
		docs: "packages/plugins",
	},
	{
		dir: "packages/profiles",
		name: "@bpmnkit/profiles",
		version: "0.0.20",
		description: "Shared auth, profile storage, and client factories for the BPMN Kit CLI and proxy server",
		tier: "tools",
		npm: "https://www.npmjs.com/package/@bpmnkit/profiles",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/profiles",
		docs: null,
	},
	{
		dir: "apps/proxy",
		name: "@bpmnkit/proxy",
		version: "0.3.0",
		description: "Local proxy server for BPMN Kit — AI bridge (SSE/MCP) and Camunda API proxy using stored CLI profiles",
		tier: "tools",
		npm: "https://www.npmjs.com/package/@bpmnkit/proxy",
		github: "https://github.com/bpmnkit/monorepo/tree/main/apps/proxy",
		docs: null,
	},
	{
		dir: "apps/reebe-wasm",
		name: "@bpmnkit/reebe-wasm",
		version: "0.1.7",
		description: "The Reebe dev/test BPMN engine, compiled to WebAssembly — not for production",
		tier: "experimental",
		npm: "https://www.npmjs.com/package/@bpmnkit/reebe-wasm",
		github: "https://github.com/bpmnkit/monorepo/tree/main/apps/reebe-wasm",
		docs: null,
	},
	{
		dir: "packages/ui",
		name: "@bpmnkit/ui",
		version: "0.3.0",
		description: "Shared design tokens, theme management, and UI components for BPMN Kit packages",
		tier: "tools",
		npm: "https://www.npmjs.com/package/@bpmnkit/ui",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/ui",
		docs: null,
	},
	{
		dir: "packages/user-tasks",
		name: "@bpmnkit/user-tasks",
		version: "0.1.1",
		description: "Embeddable user task widget for Camunda 8 — form rendering, claim/complete actions, zero dependencies",
		tier: "experimental",
		npm: "https://www.npmjs.com/package/@bpmnkit/user-tasks",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/user-tasks",
		docs: null,
	},
	{
		dir: "packages/worker-client",
		name: "@bpmnkit/worker-client",
		version: "0.0.6",
		description: "Thin Zeebe REST client for standalone workers — no BPMNKit SDK required at runtime",
		tier: "tools",
		npm: "https://www.npmjs.com/package/@bpmnkit/worker-client",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/worker-client",
		docs: "packages/worker-client",
	},
]

/** A product that is not an npm package: an app, an extension, a service. */
export interface AppFact {
	readonly dir: string
	readonly name: string
	/** The version in its `package.json` or `Cargo.toml`. */
	readonly version: string
	readonly description: string
	readonly tier: Tier
	readonly github: string
	readonly docs: string | null
}

export const APP_FACTS: readonly AppFact[] = [
	{
		dir: "apps/vscode",
		name: "BPMN Kit for VS Code",
		version: "0.4.11",
		description: "View, edit, lint, diff and simulate BPMN, DMN and Forms in VS Code",
		tier: "tools",
		github: "https://github.com/bpmnkit/monorepo/tree/main/apps/vscode",
		docs: "guides/vscode",
	},
	{
		dir: "apps/drop",
		name: "Drop",
		version: "0.0.11",
		description: "Share a BPMN, DMN or Form file as a link at bpmnkit.com/drop",
		tier: "tools",
		github: "https://github.com/bpmnkit/monorepo/tree/main/apps/drop",
		docs: "guides/drop",
	},
	{
		dir: "apps/reebe",
		name: "Reebe",
		version: "0.1.4",
		description: "Single-node dev/test engine for the Zeebe API, in Rust. Not for production",
		tier: "experimental",
		github: "https://github.com/bpmnkit/monorepo/tree/main/apps/reebe",
		docs: null,
	},
	{
		dir: "apps/studio",
		name: "Studio",
		version: "0.1.1",
		description: "Browser workspace for models, a local WASM engine and cluster monitoring",
		tier: "experimental",
		github: "https://github.com/bpmnkit/monorepo/tree/main/apps/studio",
		docs: null,
	},
	{
		dir: "apps/desktop",
		name: "Desktop app",
		version: "0.1.42",
		description: "Tauri build of the editor for Windows, macOS and Linux",
		tier: "experimental",
		github: "https://github.com/bpmnkit/monorepo/tree/main/apps/desktop",
		docs: null,
	},
	{
		dir: "apps/proxy-rs",
		name: "proxy-rs",
		version: "0.1.0",
		description: "Rust port of the AI bridge and MCP server, bundled with the desktop app",
		tier: "experimental",
		github: "https://github.com/bpmnkit/monorepo/tree/main/apps/proxy-rs",
		docs: null,
	},
]
