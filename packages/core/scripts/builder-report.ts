/**
 * Prints the fluent-builder coverage table.
 *
 * The gate in `tests/builder-coverage.test.ts` only asserts; this is the report
 * behind it — run it to see which builder method covers each `BpmnElementType`,
 * and which types are deliberately not authorable through the chain.
 *
 *   pnpm --filter @bpmnkit/core check:builder
 */

import type { BpmnElementType } from "../src/bpmn/bpmn-model.js"
import {
	BUILDER_COVERAGE,
	type BuilderSupport,
	hasBuilderMethod,
} from "../src/bpmn/builder-coverage.js"

const rows = Object.entries(BUILDER_COVERAGE) as Array<[BpmnElementType, BuilderSupport]>

const covered = rows.filter(([, support]) => hasBuilderMethod(support))
const exempt = rows.filter(([, support]) => !hasBuilderMethod(support))

const width = Math.max(...rows.map(([type]) => type.length))

console.log(`\ncovered (${covered.length})`)
for (const [type, support] of covered.sort((l, r) => l[0].localeCompare(r[0]))) {
	if (!hasBuilderMethod(support)) continue
	const emits = support.emits ? `  → emits ${support.emits}` : ""
	console.log(`  ${type.padEnd(width)}  .${support.method}()${emits}`)
}

console.log(`\nexempt (${exempt.length})`)
for (const [type, support] of exempt.sort((l, r) => l[0].localeCompare(r[0]))) {
	if (hasBuilderMethod(support)) continue
	console.log(`  ${type.padEnd(width)}  ${support.exempt}`)
}

console.log(`\n${rows.length} element types; ${covered.length} reachable from a builder chain.`)
