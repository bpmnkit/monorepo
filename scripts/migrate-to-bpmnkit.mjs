#!/usr/bin/env node
/**
 * migrate-to-bpmnkit.mjs
 *
 * Renames all @bpmn-sdk/ package references to @bpmnkit/ across the monorepo.
 * Also updates the GitHub org URL in repository fields and the changeset config.
 *
 * Safe to re-run — idempotent.
 *
 * Usage:
 *   node scripts/migrate-to-bpmnkit.mjs [--dry-run]
 */

import { execSync } from "node:child_process"
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { extname, join, relative } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "")
const DRY_RUN = process.argv.includes("--dry-run")

// ─── Config ────────────────────────────────────────────────────────────────

const REPLACEMENTS = [
	// npm scope — the primary rename
	{ from: "@bpmn-sdk/", to: "@bpmnkit/" },
	// GitHub org in repository URLs
	{ from: "github.com/bpmn-sdk/monorepo", to: "github.com/bpmnkit/monorepo" },
	// Changeset repo reference
	{ from: '"repo": "bpmn-sdk/monorepo"', to: '"repo": "bpmnkit/monorepo"' },
]

const INCLUDE_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".mjs",
	".cjs",
	".astro",
	".css",
	".json",
	".yml",
	".yaml",
	".md",
	".txt",
])

const EXCLUDE_DIRS = new Set([
	"node_modules",
	"dist",
	"build",
	"target",
	".git",
	".turbo",
	".changeset", // handled explicitly below
])

const EXCLUDE_FILES = new Set([
	// Self — don't rename references in this script
	"scripts/migrate-to-bpmnkit.mjs",
	// The deprecation script references old names intentionally
	"scripts/deprecate-old-packages.mjs",
	// This doc file references both names
	"doc/migration-bpmnkit.md",
	// Rust Cargo files don't reference @bpmn-sdk/ but just in case
	"Cargo.toml",
	"Cargo.lock",
])

// ─── File walker ───────────────────────────────────────────────────────────

function* walk(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name)
		if (entry.isDirectory()) {
			if (!EXCLUDE_DIRS.has(entry.name)) yield* walk(full)
		} else {
			yield full
		}
	}
}

// ─── Apply replacements ────────────────────────────────────────────────────

function applyReplacements(content) {
	let result = content
	for (const { from, to } of REPLACEMENTS) {
		result = result.replaceAll(from, to)
	}
	return result
}

// ─── Process a file ────────────────────────────────────────────────────────

function processFile(filePath) {
	const rel = relative(ROOT, filePath)

	if (EXCLUDE_FILES.has(rel)) return false
	if (!INCLUDE_EXTENSIONS.has(extname(filePath))) return false

	const original = readFileSync(filePath, "utf8")
	const updated = applyReplacements(original)

	if (updated === original) return false

	if (DRY_RUN) {
		console.log(`  [dry-run] would update: ${rel}`)
		return true
	}

	writeFileSync(filePath, updated, "utf8")
	console.log(`  updated: ${rel}`)
	return true
}

// ─── Special: .changeset/config.json ──────────────────────────────────────

function processChangeset() {
	const p = join(ROOT, ".changeset", "config.json")
	try {
		const original = readFileSync(p, "utf8")
		const updated = applyReplacements(original)
		if (updated === original) return
		if (DRY_RUN) {
			console.log("  [dry-run] would update: .changeset/config.json")
			return
		}
		writeFileSync(p, updated, "utf8")
		console.log("  updated: .changeset/config.json")
	} catch {
		// file may not exist
	}
}

// ─── Run shell command ─────────────────────────────────────────────────────

function run(cmd, label) {
	console.log(`\n→ ${label}`)
	if (DRY_RUN) {
		console.log(`  [dry-run] would run: ${cmd}`)
		return
	}
	try {
		execSync(cmd, { cwd: ROOT, stdio: "inherit" })
	} catch (err) {
		console.error(`  FAILED: ${cmd}`)
		process.exit(1)
	}
}

// ─── Main ──────────────────────────────────────────────────────────────────

console.log("\nBPMN Kit — package rename migration")
console.log("  @bpmn-sdk/* → @bpmnkit/*")
if (DRY_RUN) console.log("  MODE: dry-run (no files will be written)\n")
else console.log()

let count = 0
for (const filePath of walk(ROOT)) {
	if (processFile(filePath)) count++
}
processChangeset()

console.log(`\n✓ ${count} file(s) updated`)

if (!DRY_RUN) {
	run("pnpm install", "Regenerating lockfile (pnpm install)")
	run("pnpm biome check --write .", "Fixing formatting (biome check --write)")
	run("pnpm run verify", "Verifying build, types, lint, and tests")
	console.log("\n✓ Migration complete. Review changes, then commit and push.\n")
} else {
	console.log("\nRe-run without --dry-run to apply changes.\n")
}
