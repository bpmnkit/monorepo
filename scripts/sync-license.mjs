#!/usr/bin/env node
/**
 * sync-license.mjs
 *
 * Copies the root LICENSE file into every published package directory.
 * Run automatically as part of the build script.
 */

import { copyFileSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "")

const PUBLISHED = [
	"packages/core",
	"packages/canvas",
	"packages/editor",
	"packages/ui",
	"packages/plugins",
	"packages/engine",
	"packages/feel",
	"packages/api",
	"packages/ascii",
	"packages/docspack",
	"packages/profiles",
	"packages/operate",
	"packages/astro-shared",
	"packages/connector-gen",
	"packages/connectors",
	"packages/patterns",
	"packages/worker-client",
	"apps/cli",
	"apps/proxy",
	"apps/reebe-wasm",
	"plugins-cli/casen-report",
	"plugins-cli/casen-worker-http",
	"plugins-cli/casen-worker-ai",
]

const src = resolve(ROOT, "LICENSE")

// Verify source exists
readFileSync(src) // throws if missing

for (const dir of PUBLISHED) {
	const dest = resolve(ROOT, dir, "LICENSE")
	copyFileSync(src, dest)
	console.log(`✓  ${dir}/LICENSE`)
}

console.log(`\nSynced LICENSE to ${PUBLISHED.length} packages.`)
