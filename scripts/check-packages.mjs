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

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { PUBLISHED, STABLE } from "./published-packages.mjs"

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "")

const STALE_BRAND_PATTERNS = [/@bpmn-sdk\//, /bpmn-sdk frontends/, /bpmn-sdk CLI/, /for @bpmn-sdk/]

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
		error(dir, "Cannot read package.json")
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
		issues.push(
			`"keywords" must be an array with at least 3 entries (got: ${JSON.stringify(pkg.keywords)})`,
		)
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
		issues.push(
			`"repository.url" must reference github.com/bpmnkit/monorepo (got: ${JSON.stringify(pkg.repository?.url)})`,
		)
	}

	// publishConfig.access
	if (pkg.publishConfig?.access !== "public") {
		issues.push(
			`"publishConfig.access" must be "public" (got: ${JSON.stringify(pkg.publishConfig?.access)})`,
		)
	}

	// README.md in files[]
	if (Array.isArray(pkg.files) && !pkg.files.includes("README.md")) {
		issues.push('"README.md" not listed in "files[]" — it won\'t be included in the npm publish')
	}

	// LICENSE file exists on disk
	if (!existsSync(resolve(ROOT, dir, "LICENSE"))) {
		issues.push('missing LICENSE file — run "node scripts/sync-license.mjs"')
	}

	if (issues.length > 0) {
		console.error(`\n[${label}]`)
		for (const msg of issues) error(label, msg)
	}
}

/**
 * The 1.0 promise, checked in both directions.
 *
 * `STABLE` says which packages carry it; https://bpmnkit.com/docs/getting-started/stability
 * says what it is. Two of the three conditions it sets are mechanical, so neither the list
 * nor a version number can drift away from them quietly:
 *
 *   - a package on the list must have a test script and a documentation page;
 *   - a package at 1.0.0 or above must be on the list.
 *
 * The second is what stops a 1.0 arriving by accident — a stray `major` changeset on a
 * package nobody decided to stabilise fails here rather than on npm.
 */
function checkStable() {
	const docsDir = resolve(ROOT, "apps/landing/src/content/docs")

	for (const dir of STABLE) {
		if (!PUBLISHED.includes(dir)) {
			console.error(`\n[${dir}]`)
			error(dir, "listed in STABLE but not in PUBLISHED")
			continue
		}

		const pkg = JSON.parse(readFileSync(resolve(ROOT, dir, "package.json"), "utf8"))
		const label = pkg.name ?? dir
		const short = String(pkg.name ?? "").replace("@bpmnkit/", "")
		const issues = []

		const test = pkg.scripts?.test
		if (!test || /no tests/.test(test)) {
			issues.push(
				"carries the 1.0 promise with no test script — see STABLE in published-packages.mjs",
			)
		}

		// A page under `packages/`, or a whole section of its own — `casen` has one.
		const documented =
			existsSync(resolve(docsDir, "packages", `${short}.md`)) || existsSync(resolve(docsDir, short))
		if (!documented) {
			issues.push(
				`carries the 1.0 promise with no documentation page (expected docs/packages/${short}.md or a docs/${short}/ section)`,
			)
		}

		if (issues.length > 0) {
			console.error(`\n[${label}]`)
			for (const msg of issues) error(label, msg)
		}
	}

	for (const dir of PUBLISHED) {
		const pkg = JSON.parse(readFileSync(resolve(ROOT, dir, "package.json"), "utf8"))
		const major = Number.parseInt(String(pkg.version ?? "0").split(".")[0], 10)
		if (major >= 1 && !STABLE.includes(dir)) {
			console.error(`\n[${pkg.name ?? dir}]`)
			error(
				dir,
				`is ${pkg.version} but not in STABLE — a package at 1.0 or above carries the stability promise, so say so there or do not ship the major`,
			)
		}
	}
}

console.log("Checking published package.json fields...\n")
for (const dir of PUBLISHED) check(dir)
checkStable()

if (errors === 0) {
	console.log(
		`✓  All ${PUBLISHED.length} packages pass (${STABLE.length} carry the 1.0 promise).\n`,
	)
} else {
	console.error(`\n${errors} error(s) found across ${PUBLISHED.length} packages.\n`)
	process.exit(1)
}
