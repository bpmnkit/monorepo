#!/usr/bin/env node
/**
 * bench-layout — BPMN / DMN / Form layout benchmark
 *
 * Usage:  node scripts/bench-layout.mjs [folder] [options]
 *
 * Arguments:
 *   folder      Directory containing .bpmn, .dmn, and .form files (default: ./bpmn-samples/)
 *
 * Options:
 *   --verbose   Print full element-by-element breakdown for each file
 *   --top N     Show top N deviating elements per file (default: 5)
 *
 * For each file the script:
 *   .bpmn — Parses XML, strips DI, runs auto-layout, compares positions.
 *   .dmn  — Parses XML, strips DMNDI, runs auto-layout, compares positions.
 *   .form — Parses JSON, round-trips through compact format, validates structure.
 */

import { readFileSync, readdirSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { benchmarkDmnLayout, benchmarkLayout } from "../packages/core/dist/index.js"
import { Dmn, Form } from "../packages/core/dist/index.js"
import { compactifyForm, expandForm } from "../packages/core/dist/index.js"

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const folderArg = args.find((a) => !a.startsWith("--"))
const verbose = args.includes("--verbose")
const topArg = args.indexOf("--top")
const topN = topArg !== -1 ? Number(args[topArg + 1] ?? 5) : 5

const folder = resolve(folderArg ?? "./bpmn-samples")

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEP = "═".repeat(72)
const sep = "─".repeat(72)

function printSep() {
	console.log(SEP)
}

function printLine() {
	console.log(sep)
}

function badge(condition) {
	return condition ? "✓" : "✗"
}

function fmtRatio(r) {
	const pct = Math.round((r - 1) * 100)
	if (pct === 0) return "same"
	return pct > 0 ? `+${pct}% larger` : `${pct}% smaller`
}

// ── File discovery ────────────────────────────────────────────────────────────

let files
try {
	files = readdirSync(folder)
		.filter((f) => f.endsWith(".bpmn") || f.endsWith(".dmn") || f.endsWith(".form"))
		.sort()
} catch {
	console.error(`Error: cannot read folder "${folder}"`)
	console.error("Create the folder and add .bpmn, .dmn, or .form files, then re-run.")
	process.exit(1)
}

if (files.length === 0) {
	console.error(`No .bpmn, .dmn, or .form files found in "${folder}"`)
	process.exit(1)
}

// ── Benchmark ─────────────────────────────────────────────────────────────────

printSep()
console.log("  bench-layout — BPMN/DMN/Form Layout Benchmark")
console.log(`  Folder: ${folder}`)
console.log(`  Files:  ${files.length}`)
printSep()
console.log()

const bpmnResults = []
const dmnResults = []
const formResults = []
let fileIndex = 0

for (const file of files) {
	fileIndex++
	const filePath = join(folder, file)
	const fileName = basename(file)
	const ext = file.split(".").pop()

	console.log(`[${fileIndex}/${files.length}] ${fileName}`)

	let content
	try {
		content = readFileSync(filePath, "utf8")
	} catch (err) {
		console.log(`  ERROR reading file: ${err.message}`)
		console.log()
		continue
	}

	// ── BPMN ────────────────────────────────────────────────────────────────
	if (ext === "bpmn") {
		let result
		try {
			result = benchmarkLayout(content, fileName)
		} catch (err) {
			console.log(`  ERROR during benchmark: ${err.message}`)
			if (verbose) console.error(err)
			console.log()
			continue
		}

		bpmnResults.push(result)

		console.log(
			`  Elements: ${result.elementCount}  Flows: ${result.flowCount}  Matched: ${result.matchedCount}/${result.elementCount}`,
		)
		console.log(
			`  Distance — avg: ${result.avgDistance.toFixed(1)}px  ` +
				`p90: ${result.p90Distance.toFixed(1)}px  max: ${result.maxDistance.toFixed(1)}px`,
		)
		console.log(
			`  Size — ref ${Math.round(result.ref.width)}×${Math.round(result.ref.height)}  ` +
				`auto ${Math.round(result.auto.width)}×${Math.round(result.auto.height)}  ` +
				`width ${fmtRatio(result.widthRatio)}  height ${fmtRatio(result.heightRatio)}`,
		)

		if (result.orderViolations.length > 0) {
			console.log(`  Order violations: ${result.orderViolations.length} ✗`)
			for (const v of result.orderViolations) {
				console.log(`    ✗ ${v.description}`)
			}
		} else {
			console.log("  Order violations: 0 ✓")
		}

		const top = result.elements.slice(0, topN)
		if (top.length > 0) {
			console.log(`  Top ${top.length} deviations (by Euclidean distance):`)
			for (const el of top) {
				const label = el.name ? `"${el.name}"` : el.id
				const sign = (n) => (n >= 0 ? `+${Math.round(n)}` : String(Math.round(n)))
				const typeStr = `[${el.type}]`.padEnd(26)
				console.log(
					`    ${typeStr} ${label.slice(0, 28).padEnd(30)} ` +
						`Δx=${sign(el.delta.dx).padStart(6)} Δy=${sign(el.delta.dy).padStart(6)}  ` +
						`dist=${el.distance.toFixed(1)}px`,
				)
			}
		}

		if (verbose && result.elements.length > topN) {
			console.log(`  Full element list (${result.elements.length} elements):`)
			for (const el of result.elements) {
				const label = el.name ? `"${el.name}"` : el.id
				const sign = (n) => (n >= 0 ? `+${Math.round(n)}` : String(Math.round(n)))
				console.log(
					`    [${el.type.padEnd(24)}] ${label.slice(0, 28).padEnd(30)} ` +
						`ref(${Math.round(el.ref.cx)},${Math.round(el.ref.cy)}) ` +
						`auto(${Math.round(el.auto.cx)},${Math.round(el.auto.cy)}) ` +
						`dist=${el.distance.toFixed(1)}px`,
				)
			}
		}
	}

	// ── DMN ─────────────────────────────────────────────────────────────────
	else if (ext === "dmn") {
		let result
		try {
			result = benchmarkDmnLayout(content, fileName)
		} catch (err) {
			console.log(`  ERROR during DMN benchmark: ${err.message}`)
			if (verbose) console.error(err)
			console.log()
			continue
		}

		dmnResults.push(result)

		console.log(
			`  [DMN] Elements: ${result.elementCount}  Matched: ${result.matchedCount}/${result.elementCount}`,
		)
		console.log(
			`  Distance — avg: ${result.avgDistance.toFixed(1)}px  ` +
				`p90: ${result.p90Distance.toFixed(1)}px  max: ${result.maxDistance.toFixed(1)}px`,
		)

		const top = result.elements.slice(0, topN)
		if (top.length > 0) {
			console.log(`  Top ${top.length} deviations:`)
			for (const el of top) {
				const label = el.name ? `"${el.name}"` : el.id
				const sign = (n) => (n >= 0 ? `+${Math.round(n)}` : String(Math.round(n)))
				const kindStr = `[${el.kind}]`.padEnd(26)
				console.log(
					`    ${kindStr} ${label.slice(0, 28).padEnd(30)} ` +
						`Δx=${sign(el.delta.dx).padStart(6)} Δy=${sign(el.delta.dy).padStart(6)}  ` +
						`dist=${el.distance.toFixed(1)}px`,
				)
			}
		}

		if (verbose && result.elements.length > topN) {
			console.log(`  Full element list (${result.elements.length} elements):`)
			for (const el of result.elements) {
				const label = el.name ? `"${el.name}"` : el.id
				const sign = (n) => (n >= 0 ? `+${Math.round(n)}` : String(Math.round(n)))
				console.log(
					`    [${el.kind.padEnd(24)}] ${label.slice(0, 28).padEnd(30)} ` +
						`ref(${Math.round(el.ref.cx)},${Math.round(el.ref.cy)}) ` +
						`auto(${Math.round(el.auto.cx)},${Math.round(el.auto.cy)}) ` +
						`dist=${el.distance.toFixed(1)}px`,
				)
			}
		}
	}

	// ── Form ─────────────────────────────────────────────────────────────────
	else if (ext === "form") {
		let parseOk = false
		let compactOk = false
		let roundtripOk = false
		let fieldCount = 0
		let error = null

		try {
			const parsed = Form.parse(content)
			parseOk = true
			fieldCount = parsed.components.length

			const compact = compactifyForm(parsed)
			compactOk = true

			const restored = expandForm(compact)
			roundtripOk = restored.components.length === parsed.components.length
		} catch (err) {
			error = err.message
		}

		const formResult = { fileName, parseOk, compactOk, roundtripOk, fieldCount, error }
		formResults.push(formResult)

		if (error) {
			console.log(`  [Form] ERROR: ${error}`)
		} else {
			console.log(
				`  [Form] Fields: ${fieldCount}  ` +
					`parse ${badge(parseOk)}  compact ${badge(compactOk)}  roundtrip ${badge(roundtripOk)}`,
			)
		}
	}

	console.log()
}

// ── Summary ────────────────────────────────────────────────────────────────────

printSep()
console.log("  SUMMARY")
printSep()

// BPMN summary
if (bpmnResults.length > 0) {
	const totalElements = bpmnResults.reduce((s, r) => s + r.elementCount, 0)
	const totalFlows = bpmnResults.reduce((s, r) => s + r.flowCount, 0)
	const totalViolations = bpmnResults.reduce((s, r) => s + r.orderViolations.length, 0)
	const globalAvgDist = bpmnResults.reduce((s, r) => s + r.avgDistance, 0) / bpmnResults.length
	const globalP90 = bpmnResults.reduce((s, r) => s + r.p90Distance, 0) / bpmnResults.length

	console.log(
		`  BPMN files:          ${bpmnResults.length} / ${files.filter((f) => f.endsWith(".bpmn")).length}`,
	)
	console.log(`  Total BPMN elements: ${totalElements}  flows: ${totalFlows}`)
	console.log(`  Order violations:    ${totalViolations} ${badge(totalViolations === 0)}`)
	console.log(`  Global avg dist:     ${globalAvgDist.toFixed(1)}px`)
	console.log(`  Global P90 dist:     ${globalP90.toFixed(1)}px`)
	console.log()

	const sorted = [...bpmnResults].sort((a, b) => b.avgDistance - a.avgDistance)
	console.log("  BPMN files by avg deviation (worst first):")
	for (const r of sorted) {
		const violations =
			r.orderViolations.length > 0 ? `  ${r.orderViolations.length} order violations ✗` : ""
		console.log(
			`    ${r.fileName.padEnd(40)} avg ${r.avgDistance.toFixed(1).padStart(7)}px  ` +
				`p90 ${r.p90Distance.toFixed(1).padStart(7)}px${violations}`,
		)
	}
	console.log()
}

// DMN summary
if (dmnResults.length > 0) {
	const totalElements = dmnResults.reduce((s, r) => s + r.elementCount, 0)
	const globalAvgDist = dmnResults.reduce((s, r) => s + r.avgDistance, 0) / dmnResults.length
	const globalP90 = dmnResults.reduce((s, r) => s + r.p90Distance, 0) / dmnResults.length

	console.log(
		`  DMN files:           ${dmnResults.length} / ${files.filter((f) => f.endsWith(".dmn")).length}`,
	)
	console.log(`  Total DMN elements:  ${totalElements}`)
	console.log(`  Global avg dist:     ${globalAvgDist.toFixed(1)}px`)
	console.log(`  Global P90 dist:     ${globalP90.toFixed(1)}px`)
	console.log()

	const sorted = [...dmnResults].sort((a, b) => b.avgDistance - a.avgDistance)
	console.log("  DMN files by avg deviation (worst first):")
	for (const r of sorted) {
		console.log(
			`    ${r.fileName.padEnd(40)} avg ${r.avgDistance.toFixed(1).padStart(7)}px  ` +
				`p90 ${r.p90Distance.toFixed(1).padStart(7)}px`,
		)
	}
	console.log()
}

// Form summary
if (formResults.length > 0) {
	const ok = formResults.filter((r) => r.roundtripOk).length
	const fail = formResults.length - ok

	console.log(
		`  Form files:          ${formResults.length} / ${files.filter((f) => f.endsWith(".form")).length}`,
	)
	console.log(`  Roundtrip pass:      ${ok} ${badge(fail === 0)}`)
	if (fail > 0) {
		console.log(`  Roundtrip fail:      ${fail} ✗`)
		for (const r of formResults.filter((f) => !f.roundtripOk)) {
			console.log(`    ✗ ${r.fileName}${r.error ? `: ${r.error}` : ""}`)
		}
	}
	console.log()
}

if (bpmnResults.length === 0 && dmnResults.length === 0 && formResults.length === 0) {
	console.log("No results to summarize.")
}

// ── Guidance ──────────────────────────────────────────────────────────────────

printSep()
console.log("  INTERPRETATION GUIDE")
printSep()
console.log(`
  BPMN avg dist < 50px   Good match — minor positioning differences only.
  BPMN avg dist 50-150px  Moderate — spacing/alignment differences visible.
  BPMN avg dist > 150px   Large — structural layout differences, investigate.

  Order violations   Flow A→B where auto-layout reverses the X order.

  DMN avg dist < 80px    Good match for DRD layout.
  DMN avg dist > 150px   Layer/spacing differences — investigate.

  Form roundtrip ✓       Compact format preserves all field structure.
  Form roundtrip ✗       Compact format lost fields — investigate expandForm().
`)
