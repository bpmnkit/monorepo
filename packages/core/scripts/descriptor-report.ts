/**
 * Prints the descriptor coverage table.
 *
 * The gate in `tests/descriptor-coverage.test.ts` only asserts; this is the
 * report behind it — run it to see how each type in the vendored BPMN, DI and
 * Zeebe descriptors fares in a round trip, and which slot the probe used.
 *
 *   pnpm --filter @bpmnkit/core check:descriptors
 *   pnpm --filter @bpmnkit/core check:descriptors dropped preserved
 */
import { type Coverage, descriptorCoverage } from "../tests/support/descriptor-coverage.js"

const ORDER: Coverage[] = ["dropped", "unprobed", "preserved", "modelled"]

const wanted = new Set(process.argv.slice(2) as Coverage[])
const rows = descriptorCoverage()

for (const coverage of ORDER) {
	const group = rows.filter((row) => row.coverage === coverage)
	if (group.length === 0) continue
	console.log(`\n${coverage} (${group.length})`)
	if (wanted.size > 0 && !wanted.has(coverage)) continue
	for (const row of group.sort((left, right) => left.type.localeCompare(right.type))) {
		console.log(`  ${row.type.padEnd(42)} ${row.parent ?? row.reason ?? ""}`)
	}
}

console.log(`\n${rows.length} types across the vendored descriptors.`)
