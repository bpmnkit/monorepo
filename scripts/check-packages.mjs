#!/usr/bin/env node
/**
 * check-packages.mjs
 *
 * Validates required package.json fields for all published packages.
 * Exits with code 1 if any errors are found.
 *
 * Usage:
 *   node scripts/check-packages.mjs
 */

import { readFileSync } from "node:fs"
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
	"packages/profiles",
	"packages/operate",
	"packages/astro-shared",
	"packages/connector-gen",
	"apps/cli",
	"apps/proxy",
]

const STALE_BRAND_PATTERNS = [
	/@bpmn-sdk\//,
	/bpmn-sdk frontends/,
	/bpmn-sdk CLI/,
	/for @bpmn-sdk/,
]

let errors = 0

function error(pkg, msg) {
	console.error(`  ✗  ${msg}`)
	errors++
}

function check(dir) {
	const pkgPath = resolve(ROOT, dir, "package.json")
	let pkg
	try {
		pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
	} catch {
		console.error(`\n[${dir}]`)
		error(dir, `Cannot read package.json`)
		return
	}

	const label = pkg.name ?? dir
	const issues = []

	// name
	if (!pkg.name?.startsWith("@bpmnkit/")) {
		issues.push(`name must start with "@bpmnkit/" (got: "${pkg.name}")`)
	}

	// description
	if (!pkg.description || pkg.description.trim() === "") {
		issues.push('missing "description"')
	} else {
		for (const pat of STALE_BRAND_PATTERNS) {
			if (pat.test(pkg.description)) {
				issues.push(`stale brand ref in description: "${pkg.description}"`)
				break
			}
		}
	}

	// keywords
	if (!Array.isArray(pkg.keywords) || pkg.keywords.length < 3) {
		issues.push(`"keywords" must be an array with at least 3 entries (got: ${JSON.stringify(pkg.keywords)})`)
	}

	// license
	if (pkg.license !== "MIT") {
		issues.push(`"license" must be "MIT" (got: ${JSON.stringify(pkg.license)})`)
	}

	// homepage
	if (!pkg.homepage) {
		issues.push('missing "homepage"')
	}

	// bugs
	if (!pkg.bugs?.url) {
		issues.push('missing "bugs.url"')
	}

	// repository
	if (!pkg.repository?.url?.includes("github.com/bpmnkit/monorepo")) {
		issues.push(`"repository.url" must reference github.com/bpmnkit/monorepo (got: ${JSON.stringify(pkg.repository?.url)})`)
	}

	// publishConfig.access
	if (pkg.publishConfig?.access !== "public") {
		issues.push(`"publishConfig.access" must be "public" (got: ${JSON.stringify(pkg.publishConfig?.access)})`)
	}

	// README.md in files[]
	if (Array.isArray(pkg.files) && !pkg.files.includes("README.md")) {
		issues.push('"README.md" not listed in "files[]" — it won\'t be included in the npm publish')
	}

	if (issues.length > 0) {
		console.error(`\n[${label}]`)
		for (const msg of issues) error(label, msg)
	}
}

console.log("Checking published package.json fields...\n")
for (const dir of PUBLISHED) check(dir)

if (errors === 0) {
	console.log(`✓  All ${PUBLISHED.length} packages pass.\n`)
} else {
	console.error(`\n${errors} error(s) found across ${PUBLISHED.length} packages.\n`)
	process.exit(1)
}
