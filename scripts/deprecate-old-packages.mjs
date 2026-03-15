#!/usr/bin/env node
/**
 * deprecate-old-packages.mjs
 *
 * Adds an npm deprecation warning to all versions of every @bpmn-sdk/* package,
 * pointing users to the renamed @bpmnkit/* equivalents.
 *
 * Run AFTER @bpmnkit/* packages are live on npm.
 * Requires npm CLI to be authenticated with an account that has write access to @bpmn-sdk.
 *
 * Usage:
 *   node scripts/deprecate-old-packages.mjs [--dry-run]
 */

import { execSync } from "node:child_process"

const DRY_RUN = process.argv.includes("--dry-run")

// All published packages being renamed (old → new)
const PACKAGES = [
	["@bpmn-sdk/core", "@bpmnkit/core"],
	["@bpmn-sdk/canvas", "@bpmnkit/canvas"],
	["@bpmn-sdk/editor", "@bpmnkit/editor"],
	["@bpmn-sdk/ui", "@bpmnkit/ui"],
	["@bpmn-sdk/plugins", "@bpmnkit/plugins"],
	["@bpmn-sdk/engine", "@bpmnkit/engine"],
	["@bpmn-sdk/feel", "@bpmnkit/feel"],
	["@bpmn-sdk/api", "@bpmnkit/api"],
	["@bpmn-sdk/ascii", "@bpmnkit/ascii"],
	["@bpmn-sdk/profiles", "@bpmnkit/profiles"],
	["@bpmn-sdk/operate", "@bpmnkit/operate"],
	["@bpmn-sdk/astro-shared", "@bpmnkit/astro-shared"],
	["@bpmn-sdk/connector-gen", "@bpmnkit/connector-gen"],
	["@bpmn-sdk/cli", "@bpmnkit/cli"],
	["@bpmn-sdk/proxy", "@bpmnkit/proxy"],
]

console.log("\nBPMN Kit — deprecate old @bpmn-sdk/* packages")
if (DRY_RUN) console.log("MODE: dry-run (no npm commands will run)\n")
else console.log()

for (const [oldPkg, newPkg] of PACKAGES) {
	const message = `Package renamed to ${newPkg}. Please update your dependencies. See https://bpmnkit.com`
	const cmd = `npm deprecate "${oldPkg}@*" "${message}"`

	if (DRY_RUN) {
		console.log(`  [dry-run] ${cmd}`)
		continue
	}

	console.log(`  deprecating ${oldPkg} ...`)
	try {
		execSync(cmd, { stdio: "inherit" })
	} catch {
		console.error(`  FAILED: ${cmd}`)
		console.error("  (Package may not exist on npm yet, or auth is missing — skipping)")
	}
}

console.log("\n✓ Done.\n")
