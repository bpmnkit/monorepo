#!/usr/bin/env node
/**
 * Patches the wasm-pack generated apps/reebe-wasm/package.json with the
 * Changesets-managed version and required npm metadata.
 *
 * wasm-pack regenerates package.json from Cargo.toml on every build, losing
 * both the Changesets-bumped version and the npm metadata fields. This script
 * must run immediately after wasm-pack in CI.
 *
 * Usage:
 *   node scripts/patch-wasm-pkg.mjs <version>
 */

import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "")

const version = process.argv[2]
if (!version) {
	console.error("Usage: node scripts/patch-wasm-pkg.mjs <version>")
	process.exit(1)
}

const pkgPath = resolve(ROOT, "apps/reebe-wasm/package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))

pkg.name = "@bpmnkit/reebe-wasm"
pkg.version = version
pkg.description = "WebAssembly playground for the Reebe BPMN workflow engine"
pkg.keywords = ["bpmn", "wasm", "workflow", "engine", "webassembly"]
pkg.license = "MIT"
pkg.repository = { type: "git", url: "https://github.com/bpmnkit/bpmnkit" }
pkg.homepage = "https://bpmnkit.com"
pkg.bugs = { url: "https://github.com/bpmnkit/bpmnkit/issues" }
pkg.publishConfig = { access: "public" }

if (Array.isArray(pkg.files)) {
	if (!pkg.files.includes("README.md")) pkg.files.push("README.md")
	if (!pkg.files.includes("LICENSE")) pkg.files.push("LICENSE")
}

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`, "utf8")
console.log(`Patched apps/reebe-wasm/package.json → ${pkg.name}@${pkg.version}`)
