#!/usr/bin/env node
/**
 * fix-packages.mjs
 *
 * One-time script to enforce required package.json fields across all published packages.
 * Safe to re-run — applies corrections idempotently.
 *
 * Adds/fixes:
 *   - license: "MIT"
 *   - homepage
 *   - bugs.url
 *   - publishConfig.access: "public"
 *   - README.md in files[]
 *   - description (stale brand refs)
 *   - keywords (missing)
 *   - repository.url (correct org)
 */

import { execSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "")
const GITHUB = "https://github.com/bpmnkit/monorepo"
const HOMEPAGE = "https://bpmnkit.com"
const BUGS_URL = `${GITHUB}/issues`

/** Published packages: [dir, overrides] */
const PACKAGES = [
	[
		"packages/core",
		{
			description:
				"TypeScript-first BPMN 2.0 SDK — parse, build, layout, and optimize diagrams",
			keywords: ["bpmn", "bpmn2", "camunda", "zeebe", "workflow", "dmn", "typescript", "sdk"],
		},
	],
	[
		"packages/canvas",
		{
			description: "Zero-dependency SVG BPMN viewer with pan/zoom, theming, and a plugin API",
			keywords: ["bpmn", "viewer", "svg", "canvas", "workflow", "typescript"],
		},
	],
	[
		"packages/editor",
		{
			description: "Full-featured interactive BPMN editor with undo/redo, HUD, and side-dock UI",
			keywords: ["bpmn", "editor", "workflow", "typescript", "canvas", "camunda"],
		},
	],
	[
		"packages/ui",
		{
			description:
				"Shared design tokens, theme management, and UI components for BPMN Kit packages",
			keywords: [
				"bpmn",
				"ui",
				"design-tokens",
				"theme",
				"components",
				"css-variables",
				"typescript",
			],
		},
	],
	[
		"packages/plugins",
		{
			description:
				"22 composable canvas plugins for BPMN editors and viewers — minimap, AI chat, process simulation, storage, and more",
			keywords: ["bpmn", "plugins", "canvas", "minimap", "workflow", "typescript", "camunda"],
		},
	],
	[
		"packages/engine",
		{
			description:
				"Lightweight BPMN 2.0 process execution engine for browsers and Node.js — zero dependencies",
			keywords: ["bpmn", "engine", "simulation", "workflow", "typescript", "dmn", "camunda"],
		},
	],
	[
		"packages/feel",
		{
			description:
				"Complete FEEL (Friendly Enough Expression Language) implementation — parser, evaluator, and highlighter",
			keywords: ["feel", "dmn", "expression", "camunda", "bpmn", "typescript", "evaluator"],
		},
	],
	[
		"packages/api",
		{
			description:
				"TypeScript client for the Camunda 8 REST API — 180 typed operations, OAuth2, retries, and caching",
			keywords: ["camunda", "zeebe", "bpmn", "api", "client", "rest", "typescript", "oauth2"],
		},
	],
	[
		"packages/ascii",
		{
			description:
				"Render BPMN diagrams as Unicode box-drawing ASCII art — perfect for terminals and docs",
			keywords: ["bpmn", "ascii", "terminal", "diagram", "typescript", "unicode"],
		},
	],
	[
		"packages/profiles",
		{
			description:
				"Shared auth, profile storage, and client factories for the BPMN Kit CLI and proxy server",
			keywords: [
				"bpmn",
				"camunda",
				"profiles",
				"authentication",
				"oauth2",
				"cli",
				"typescript",
			],
		},
	],
	[
		"packages/operate",
		{
			description:
				"Monitoring and operations frontend for Camunda 8 clusters — real-time SSE, zero dependencies",
			keywords: [
				"bpmn",
				"camunda",
				"operate",
				"monitoring",
				"workflow",
				"process-instances",
				"incidents",
				"typescript",
			],
		},
	],
	[
		"packages/astro-shared",
		{
			description:
				"Shared CSS design tokens, aurora background, and site metadata for BPMN Kit Astro apps",
			keywords: ["bpmn", "astro", "design-tokens", "shared", "css", "typescript"],
		},
	],
	[
		"packages/connector-gen",
		{
			description:
				"Generate Camunda REST connector element templates from OpenAPI/Swagger specs",
			keywords: [
				"camunda",
				"connector",
				"openapi",
				"swagger",
				"bpmn",
				"element-template",
				"typescript",
			],
		},
	],
	[
		"apps/cli",
		{
			description:
				"Command-line interface for Camunda 8 — deploy, manage, and monitor processes from the terminal",
			keywords: [
				"camunda",
				"bpmn",
				"cli",
				"terminal",
				"zeebe",
				"workflow",
				"typescript",
				"casen",
			],
		},
	],
	[
		"apps/proxy",
		{
			description:
				"Local proxy server for BPMN Kit — AI bridge (SSE/MCP) and Camunda API proxy using stored CLI profiles",
			keywords: [
				"bpmn",
				"camunda",
				"proxy",
				"ai",
				"mcp",
				"server-sent-events",
				"typescript",
				"zeebe",
			],
		},
	],
]

function fix(dir, overrides) {
	const pkgPath = resolve(ROOT, dir, "package.json")
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))

	// description
	if (overrides.description) pkg.description = overrides.description

	// keywords
	if (overrides.keywords) pkg.keywords = overrides.keywords

	// license
	pkg.license = "MIT"

	// homepage
	pkg.homepage = HOMEPAGE

	// bugs
	pkg.bugs = { url: BUGS_URL }

	// repository
	pkg.repository = { type: "git", url: GITHUB }

	// publishConfig
	pkg.publishConfig = { access: "public" }

	// README.md in files[]
	if (Array.isArray(pkg.files) && !pkg.files.includes("README.md")) {
		pkg.files = ["README.md", ...pkg.files]
	}

	writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`, "utf8")
	console.log(`✓  ${dir}/package.json`)
}

const paths = []
for (const [dir, overrides] of PACKAGES) {
	fix(dir, overrides)
	paths.push(resolve(ROOT, dir, "package.json"))
}

// Re-format with Biome so the output matches what `biome check` expects
execSync(`pnpm biome check --write ${paths.join(" ")}`, { cwd: ROOT, stdio: "inherit" })

console.log(`\nFixed ${PACKAGES.length} package.json files.`)
