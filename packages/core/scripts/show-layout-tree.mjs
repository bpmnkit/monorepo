#!/usr/bin/env node
/**
 * Show the gateway-pair tree for a BPMN file.
 *
 * Usage:
 *   node packages/core/scripts/show-layout-tree.mjs <file.bpmn>
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { Bpmn } from "../dist/index.js"
import { layoutV2WithTree } from "../dist/layout/v2/engine.js"

const [, , inputArg] = process.argv
if (!inputArg) {
	console.error("Usage: node show-layout-tree.mjs <file.bpmn>")
	process.exit(1)
}

const xml = readFileSync(resolve(process.cwd(), inputArg), "utf8")
const defs = Bpmn.parse(xml)
const proc = defs.processes[0]
if (!proc) {
	console.error("No process found in BPMN file.")
	process.exit(1)
}

const { tree } = layoutV2WithTree(
	proc.flowElements,
	proc.sequenceFlows,
	proc.textAnnotations ?? [],
	proc.associations ?? [],
)

if (tree.length === 0) {
	console.log("No gateway split-join pairs found.")
	process.exit(0)
}

const nestedSplitIds = new Set(tree.flatMap((p) => p.nestedPairSplitIds))

function label(id, text) {
	return text && text !== id ? `"${text}" (${id})` : id
}

// find the branch index closest to gatewayY
function mainBranchIdx(pair) {
	return pair.branches.reduce(
		(best, b, i) =>
			Math.abs(b.centerY - pair.gatewayY) <
			Math.abs(pair.branches[best].centerY - pair.gatewayY)
				? i
				: best,
		0,
	)
}

for (const pair of tree) {
	const isNested = nestedSplitIds.has(pair.splitId)
	const pfx = isNested ? "  │  " : ""
	const { x, y, width, height } = pair.bounds
	const main = mainBranchIdx(pair)

	console.log(
		`\n${pfx}┌── SPLIT ${label(pair.splitId, pair.splitLabel)}` +
			`  [layer ${pair.layer}, Y=${Math.round(pair.gatewayY)}]` +
			`  ${width}×${height} @ (${x},${y})`,
	)

	for (let i = 0; i < pair.branches.length; i++) {
		const b = pair.branches[i]
		const delta = Math.round(b.centerY - pair.gatewayY)
		const sign = delta > 0 ? "+" : ""
		const marker = i === main ? "▶" : " "
		const nodeList = b.labels.join(" → ") || "(empty)"
		console.log(
			`${pfx}│  ${marker} branch [Y${sign}${delta}]  h=${Math.round(b.height)}px  nodes=${b.nodeIds.length}`,
		)
		console.log(`${pfx}│      ${nodeList}`)
	}

	console.log(`${pfx}└── JOIN  ${label(pair.joinId, pair.joinLabel)}`)

	if (pair.nestedPairSplitIds.length > 0) {
		console.log(`${pfx}     ↳ nested: ${pair.nestedPairSplitIds.join(", ")}`)
	}
}
