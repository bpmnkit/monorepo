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

export interface PackageFact {
	/** Workspace-relative directory, e.g. `packages/core`. */
	readonly dir: string
	/** npm package name. */
	readonly name: string
	/** The version in the package's own manifest — what the next release publishes. */
	readonly version: string
	/** The manifest's `description`, used when `content.ts` has nothing to say. */
	readonly description: string
	readonly npm: string
	readonly github: string
}

export const PACKAGE_FACTS: readonly PackageFact[] = [
	{
		dir: "packages/api",
		name: "@bpmnkit/api",
		version: "1.0.0",
		description: "TypeScript client for the Camunda 8 REST API — 180 typed operations, OAuth2, retries, and caching",
		npm: "https://www.npmjs.com/package/@bpmnkit/api",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/api",
	},
	{
		dir: "packages/ascii",
		name: "@bpmnkit/ascii",
		version: "1.0.0",
		description: "Render BPMN diagrams as Unicode box-drawing ASCII art — perfect for terminals and docs",
		npm: "https://www.npmjs.com/package/@bpmnkit/ascii",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/ascii",
	},
	{
		dir: "packages/astro-shared",
		name: "@bpmnkit/astro-shared",
		version: "0.1.1",
		description: "Shared CSS design tokens, page ground, and site metadata for BPMN Kit Astro apps",
		npm: "https://www.npmjs.com/package/@bpmnkit/astro-shared",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/astro-shared",
	},
	{
		dir: "packages/camunda-docspack",
		name: "@bpmnkit/camunda-docspack",
		version: "0.1.3",
		description: "Camunda 8 documentation as an offline, version-locked docspack package for AI agents",
		npm: "https://www.npmjs.com/package/@bpmnkit/camunda-docspack",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/camunda-docspack",
	},
	{
		dir: "packages/canvas",
		name: "@bpmnkit/canvas",
		version: "1.0.0",
		description: "Zero-dependency SVG BPMN viewer with pan/zoom, theming, and a plugin API",
		npm: "https://www.npmjs.com/package/@bpmnkit/canvas",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/canvas",
	},
	{
		dir: "plugins-cli/casen-report",
		name: "@bpmnkit/casen-report",
		version: "0.1.11",
		description: "Render HTML reports from Camunda 8 incident and SLA data",
		npm: "https://www.npmjs.com/package/@bpmnkit/casen-report",
		github: "https://github.com/bpmnkit/monorepo/tree/main/plugins-cli/casen-report",
	},
	{
		dir: "plugins-cli/casen-worker-ai",
		name: "@bpmnkit/casen-worker-ai",
		version: "0.1.10",
		description: "AI task worker plugin for casen — classify, summarize, extract, and decide using Claude",
		npm: "https://www.npmjs.com/package/@bpmnkit/casen-worker-ai",
		github: "https://github.com/bpmnkit/monorepo/tree/main/plugins-cli/casen-worker-ai",
	},
	{
		dir: "plugins-cli/casen-worker-http",
		name: "@bpmnkit/casen-worker-http",
		version: "0.1.10",
		description: "Example casen worker plugin — processes HTTP connector jobs using the JSONPlaceholder API",
		npm: "https://www.npmjs.com/package/@bpmnkit/casen-worker-http",
		github: "https://github.com/bpmnkit/monorepo/tree/main/plugins-cli/casen-worker-http",
	},
	{
		dir: "apps/cli",
		name: "@bpmnkit/cli",
		version: "1.0.0",
		description: "Command-line interface for Camunda 8 — deploy, manage, and monitor processes from the terminal",
		npm: "https://www.npmjs.com/package/@bpmnkit/cli",
		github: "https://github.com/bpmnkit/monorepo/tree/main/apps/cli",
	},
	{
		dir: "packages/cli-sdk",
		name: "@bpmnkit/cli-sdk",
		version: "0.0.10",
		description: "Plugin authoring SDK for the casen CLI",
		npm: "https://www.npmjs.com/package/@bpmnkit/cli-sdk",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/cli-sdk",
	},
	{
		dir: "packages/connector-gen",
		name: "@bpmnkit/connector-gen",
		version: "1.0.0",
		description: "Generate Camunda REST connector element templates from OpenAPI/Swagger specs",
		npm: "https://www.npmjs.com/package/@bpmnkit/connector-gen",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/connector-gen",
	},
	{
		dir: "packages/connectors",
		name: "@bpmnkit/connectors",
		version: "1.0.0",
		description: "Camunda 8 out-of-the-box connector catalog and deterministic element-template application for @bpmnkit/core",
		npm: "https://www.npmjs.com/package/@bpmnkit/connectors",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/connectors",
	},
	{
		dir: "packages/core",
		name: "@bpmnkit/core",
		version: "1.0.0",
		description: "TypeScript-first BPMN 2.0 SDK — parse, build, layout, and optimize diagrams",
		npm: "https://www.npmjs.com/package/@bpmnkit/core",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/core",
	},
	{
		dir: "packages/create-casen-plugin",
		name: "@bpmnkit/create-casen-plugin",
		version: "0.0.10",
		description: "Scaffold a new casen CLI plugin in seconds",
		npm: "https://www.npmjs.com/package/@bpmnkit/create-casen-plugin",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/create-casen-plugin",
	},
	{
		dir: "packages/docspack",
		name: "@bpmnkit/docspack",
		version: "1.0.0",
		description: "BPMN Kit documentation as an offline, version-locked docspack package with a built-in search CLI for AI agents",
		npm: "https://www.npmjs.com/package/@bpmnkit/docspack",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/docspack",
	},
	{
		dir: "packages/editor",
		name: "@bpmnkit/editor",
		version: "1.0.0",
		description: "Full-featured interactive BPMN editor with undo/redo, HUD, and side-dock UI",
		npm: "https://www.npmjs.com/package/@bpmnkit/editor",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/editor",
	},
	{
		dir: "packages/engine",
		name: "@bpmnkit/engine",
		version: "1.0.0",
		description: "Lightweight BPMN 2.0 process simulator for tests and demos in browsers and Node.js — zero dependencies",
		npm: "https://www.npmjs.com/package/@bpmnkit/engine",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/engine",
	},
	{
		dir: "packages/feel",
		name: "@bpmnkit/feel",
		version: "1.0.0",
		description: "FEEL (Friendly Enough Expression Language) parser, evaluator, formatter and highlighter — 94% DMN TCK conformance",
		npm: "https://www.npmjs.com/package/@bpmnkit/feel",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/feel",
	},
	{
		dir: "packages/markdown",
		name: "@bpmnkit/markdown",
		version: "0.0.0",
		description: "Real BPMN diagrams in Markdown — render bpmn and bpmn-compact code blocks to inline, themeable, accessible SVG",
		npm: "https://www.npmjs.com/package/@bpmnkit/markdown",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/markdown",
	},
	{
		dir: "packages/operate",
		name: "@bpmnkit/operate",
		version: "0.1.5",
		description: "Monitoring and operations frontend for Camunda 8 clusters — real-time SSE, zero dependencies",
		npm: "https://www.npmjs.com/package/@bpmnkit/operate",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/operate",
	},
	{
		dir: "packages/patterns",
		name: "@bpmnkit/patterns",
		version: "0.0.6",
		description: "Domain process patterns for BPMNKit AIKit — compact BPMN templates and worker specs for common business processes",
		npm: "https://www.npmjs.com/package/@bpmnkit/patterns",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/patterns",
	},
	{
		dir: "packages/plugins",
		name: "@bpmnkit/plugins",
		version: "1.0.0",
		description: "34 composable canvas plugins for BPMN editors and viewers — minimap, AI chat, process simulation, storage, and more",
		npm: "https://www.npmjs.com/package/@bpmnkit/plugins",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/plugins",
	},
	{
		dir: "packages/profiles",
		name: "@bpmnkit/profiles",
		version: "0.0.20",
		description: "Shared auth, profile storage, and client factories for the BPMN Kit CLI and proxy server",
		npm: "https://www.npmjs.com/package/@bpmnkit/profiles",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/profiles",
	},
	{
		dir: "apps/proxy",
		name: "@bpmnkit/proxy",
		version: "0.3.0",
		description: "Local proxy server for BPMN Kit — AI bridge (SSE/MCP) and Camunda API proxy using stored CLI profiles",
		npm: "https://www.npmjs.com/package/@bpmnkit/proxy",
		github: "https://github.com/bpmnkit/monorepo/tree/main/apps/proxy",
	},
	{
		dir: "apps/reebe-wasm",
		name: "@bpmnkit/reebe-wasm",
		version: "0.1.7",
		description: "WebAssembly playground for the Reebe BPMN workflow engine",
		npm: "https://www.npmjs.com/package/@bpmnkit/reebe-wasm",
		github: "https://github.com/bpmnkit/monorepo/tree/main/apps/reebe-wasm",
	},
	{
		dir: "packages/ui",
		name: "@bpmnkit/ui",
		version: "0.3.0",
		description: "Shared design tokens, theme management, and UI components for BPMN Kit packages",
		npm: "https://www.npmjs.com/package/@bpmnkit/ui",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/ui",
	},
	{
		dir: "packages/user-tasks",
		name: "@bpmnkit/user-tasks",
		version: "0.1.1",
		description: "Embeddable user task widget for Camunda 8 — form rendering, claim/complete actions, zero dependencies",
		npm: "https://www.npmjs.com/package/@bpmnkit/user-tasks",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/user-tasks",
	},
	{
		dir: "packages/worker-client",
		name: "@bpmnkit/worker-client",
		version: "0.0.6",
		description: "Thin Zeebe REST client for standalone workers — no BPMNKit SDK required at runtime",
		npm: "https://www.npmjs.com/package/@bpmnkit/worker-client",
		github: "https://github.com/bpmnkit/monorepo/tree/main/packages/worker-client",
	},
]
