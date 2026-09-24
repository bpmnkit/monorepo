import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import "@bpmnkit/engine/testing/vitest"
import { createProcessTest, formatCoverage } from "@bpmnkit/engine/testing"
import type { ProcessTest } from "@bpmnkit/engine/testing"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

/**
 * Unit tests for the process example 02 builds, written with
 * `@bpmnkit/engine/testing` — the way a team would test its own diagrams.
 *
 * Job types that are mocked complete on their own; the rest (the user tasks
 * here) wait until the test completes them, as they would wait for a person.
 */

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src")

let t: ProcessTest

beforeAll(async () => {
	// The example writes its diagram to ./output — build it somewhere harmless.
	const cwd = process.cwd()
	const workDir = mkdtempSync(join(tmpdir(), "bpmnkit-process-test-"))
	process.chdir(workDir)
	try {
		await import(join(SRC, "02-incident-response.ts"))
		t = await createProcessTest({
			bpmn: readFileSync(join(workDir, "output", "02-incident-response.bpmn"), "utf-8"),
		})
	} finally {
		process.chdir(cwd)
		rmSync(workDir, { recursive: true, force: true })
	}

	t.mockJob("pagerduty-alert", { result: {} })
	t.mockJob("ticketing-system", { result: { ticketId: "INC-42" } })
	t.mockJob("diagnostic-runner", { result: { diagnosis: "disk full" } })
	t.mockJob("incident-close", { result: {} })
	t.mockJob("escalation-notifier", { result: {} })
})

afterAll(() => {
	console.log(formatCoverage(t.coverage()))
	t.dispose()
})

/** Start an incident whose classifier reports `severity` and whose health check reports `healthy`. */
async function reportIncident(severity: string, healthy: boolean) {
	t.mockJob("incident-classifier", { result: { severity } })
	t.mockJob("health-check", { result: { healthy } })
	// The simulator keeps a variable first written inside an embedded sub-process
	// local to it, so the flag the sub-process sets is declared up front.
	return t.start("IncidentResponse", {
		incident: { description: "API returns 500" },
		systemHealthy: false,
	})
}

describe("IT incident response", () => {
	it("pages on-call for a critical incident and waits for the war room", async () => {
		const run = await reportIncident("critical", true)

		expect(run).toHavePassedInOrder(["classify", "severityGateway", "pageOncall"])
		expect(run).toBeWaitingAt("warRoom")

		await run.completeJob("warRoom")
		expect(run).toBeWaitingAt("applyFix")

		await run.completeJob("applyFix", { fixApplied: true })
		expect(run).toHaveCompleted()
		expect(run).toHavePassed(["diagnose", "verify", "closeIncident", "endResolved"])
		expect(run).toHaveNotPassed(["escalate"])
	})

	it("sends a standard incident to the ticket queue", async () => {
		const run = await reportIncident("low", true)

		expect(run).toHaveVariables({ ticketId: "INC-42" })
		expect(run).toHaveNotPassed(["pageOncall", "assignSenior"])
		await run.completeJob("applyFix")
		expect(run).toHaveCompleted()
	})

	it("escalates when the fix does not make the system healthy", async () => {
		const run = await reportIncident("high", false)

		await run.completeJob("assignSenior")
		await run.completeJob("applyFix")

		expect(run).toHaveCompleted()
		expect(run).toHavePassed(["escalate", "endEscalated"])
		expect(run).toHaveVariables({ systemHealthy: false })
	})

	it("reaches every element and flow across the three runs", () => {
		const coverage = t.coverage()
		expect(coverage.elements.uncovered).toEqual([])
		expect(coverage.flows.uncovered).toEqual([])
	})
})
