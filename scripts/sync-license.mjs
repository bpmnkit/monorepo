#!/usr/bin/env node
/**
 * sync-license.mjs
 *
 * Copies the root LICENSE file into every published package directory.
 * Run automatically as part of the build script.
 */

import { copyFileSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { LICENSE_OVERRIDES, PUBLISHED } from "./published-packages.mjs"

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "")

const src = resolve(ROOT, "LICENSE")

// Verify source exists
readFileSync(src) // throws if missing

let synced = 0

for (const dir of PUBLISHED) {
	const dest = resolve(ROOT, dir, "LICENSE")
	const override = LICENSE_OVERRIDES[dir]

	// A package under a different licence ships its own LICENSE; copying the root MIT text over
	// it would misstate the terms the content is actually under.
	if (override) {
		readFileSync(dest) // throws if the package forgot to ship one
		console.log(`–  ${dir}/LICENSE (kept, ${override})`)
		continue
	}

	copyFileSync(src, dest)
	synced++
	console.log(`✓  ${dir}/LICENSE`)
}

console.log(`\nSynced LICENSE to ${synced} packages.`)
