#!/usr/bin/env node
/**
 * `camunda-docspack-build` — regenerate this package's `.llms/` payload.
 *
 * It needs a camunda-docs checkout, which it does not clone itself: the weekly workflow
 * already does that and records the commit it used, and a build that fetched its own source
 * could not be asked to produce the same bytes twice.
 */

import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "./build.js"

const USAGE = `camunda-docspack-build — build the Camunda 8 docspack payload

Usage:
  camunda-docspack-build [--camunda-docs <dir>]

Options:
  --camunda-docs <dir>   Path to a camunda-docs checkout.
                         Defaults to $CAMUNDA_DOCS, then ../camunda-docs.
`

function main(argv: string[]): number {
	if (argv.includes("--help") || argv.includes("-h")) {
		process.stdout.write(USAGE)
		return 0
	}

	const flag = argv.indexOf("--camunda-docs")
	const packDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
	const camundaDocs = resolve(
		(flag === -1 ? undefined : argv[flag + 1]) ??
			process.env.CAMUNDA_DOCS ??
			resolve(packDir, "../../../camunda-docs"),
	)

	if (!existsSync(camundaDocs)) {
		process.stderr.write(
			`No camunda-docs checkout at ${camundaDocs}.\nClone it, then pass --camunda-docs <dir> or set CAMUNDA_DOCS.\n`,
		)
		return 1
	}

	const report = build({ camundaDocs, packDir, commit: headCommit(camundaDocs) })
	process.stdout.write(
		`Built ${report.chunks} chunks from ${report.documents} documents ` +
			`(${report.tokens.toLocaleString("en-US")} tokens), ` +
			`${report.diagrams} diagrams, ${report.partials} partials, ` +
			`${report.operations} API operations.\n`,
	)
	for (const missing of report.missingDiagrams) {
		process.stderr.write(`warning: diagram not found in static/bpmn: ${missing}\n`)
	}
	if (report.unresolvedLinks.length > 0) {
		process.stderr.write(
			`warning: ${report.unresolvedLinks.length} link(s) name a page missing upstream:\n`,
		)
		for (const link of report.unresolvedLinks) process.stderr.write(`  ${link}\n`)
	}
	return 0
}

/** The upstream revision, for the NOTICE. Unknown is recorded, never guessed. */
function headCommit(dir: string): string {
	try {
		return execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
	} catch {
		return "unknown revision"
	}
}

process.exitCode = main(process.argv.slice(2))
