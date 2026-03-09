#!/usr/bin/env node
// Usage: node scripts/fix-bpmn.mjs <input.bpmn> [output.bpmn]
// Runs optimize() on the input, applies all auto-fixable findings, writes the result.

import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { Bpmn, optimize } from "../packages/core/dist/index.js"

const inputPath = resolve(process.argv[2] ?? "kyc3.bpmn")
const outputPath = resolve(process.argv[3] ?? inputPath.replace(/\.bpmn$/, ".fixed.bpmn"))

const xml = readFileSync(inputPath, "utf8")
const defs = Bpmn.parse(xml)

// First pass: report
const report = optimize(defs)
console.log(`\nAnalyzed: ${inputPath}`)
console.log(
	`Found ${report.summary.total} findings (errors: ${report.summary.bySeverity.error}, warnings: ${report.summary.bySeverity.warning}, info: ${report.summary.bySeverity.info})\n`,
)

// Print all findings
for (const f of report.findings) {
	const els = f.elementIds.length > 0 ? ` [${f.elementIds.join(", ")}]` : ""
	console.log(`  [${f.severity.toUpperCase()}] ${f.id}${els}`)
	console.log(`    ${f.message}`)
	console.log(`    → ${f.suggestion}`)
	if (f.applyFix) console.log("    ✓ auto-fixable")
	console.log()
}

// Apply all fixes (errors first, then warnings, then info)
const order = { error: 0, warning: 1, info: 2 }
const fixable = report.findings
	.filter((f) => f.applyFix)
	.sort((a, b) => order[a.severity] - order[b.severity])

let applied = 0
for (const f of fixable) {
	const result = f.applyFix(defs)
	console.log(`Applied fix [${f.id}]: ${result.description}`)
	applied++
}

// Re-run to confirm remaining issues
if (applied > 0) {
	const after = optimize(defs)
	console.log(`\nAfter fixes: ${after.summary.total} findings remaining`)
	for (const f of after.findings) {
		const els = f.elementIds.length > 0 ? ` [${f.elementIds.join(", ")}]` : ""
		console.log(`  [${f.severity.toUpperCase()}] ${f.id}${els}: ${f.message}`)
	}
}

const outXml = Bpmn.export(defs)
writeFileSync(outputPath, outXml, "utf8")
console.log(`\nWrote: ${outputPath}`)
