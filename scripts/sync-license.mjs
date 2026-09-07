#!/usr/bin/env node
/**
 * sync-license.mjs
 *
 * Copies the root LICENSE file into every published package directory.
 * Run automatically as part of the build script.
 */

import { copyFileSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { PUBLISHED } from "./published-packages.mjs"

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "")

const src = resolve(ROOT, "LICENSE")

// Verify source exists
readFileSync(src) // throws if missing

for (const dir of PUBLISHED) {
	const dest = resolve(ROOT, dir, "LICENSE")
	copyFileSync(src, dest)
	console.log(`✓  ${dir}/LICENSE`)
}

console.log(`\nSynced LICENSE to ${PUBLISHED.length} packages.`)
