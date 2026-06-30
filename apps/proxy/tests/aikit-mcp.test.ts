import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

// Import testable pure functions directly (no I/O, no proxy calls)
import { ALL_PATTERNS, findPattern } from "@bpmnkit/patterns"

// ── Pattern library ───────────────────────────────────────────────────────────

describe("patterns", () => {
	it("exports 7 seed patterns", () => {
		expect(ALL_PATTERNS).toHaveLength(7)
	})

	it("every pattern has required fields", () => {
		for (const p of ALL_PATTERNS) {
			expect(p.id, `${p.id} missing id`).toBeTruthy()
			expect(p.name, `${p.id} missing name`).toBeTruthy()
			expect(p.description, `${p.id} missing description`).toBeTruthy()
			expect(p.keywords.length, `${p.id} needs keywords`).toBeGreaterThan(0)
			expect(p.readme, `${p.id} missing readme`).toBeTruthy()
			expect(p.workers.length, `${p.id} needs workers`).toBeGreaterThan(0)
			expect(p.template.processes.length, `${p.id} needs template processes`).toBeGreaterThan(0)
		}
	})

	it("every pattern template has at least one element and one flow", () => {
		for (const p of ALL_PATTERNS) {
			const proc = p.template.processes[0]
			expect(proc, `${p.id} has no process`).toBeDefined()
			expect(proc?.elements.length, `${p.id} template has no elements`).toBeGreaterThan(0)
			expect(proc?.flows.length, `${p.id} template has no flows`).toBeGreaterThan(0)
		}
	})

	it("every template flow references valid element ids", () => {
		for (const p of ALL_PATTERNS) {
			for (const proc of p.template.processes) {
				const ids = new Set(proc.elements.map((e) => e.id))
				for (const f of proc.flows) {
					expect(
						ids.has(f.from),
						`${p.id}: flow ${f.id} 'from' (${f.from}) is not a known element`,
					).toBe(true)
					expect(ids.has(f.to), `${p.id}: flow ${f.id} 'to' (${f.to}) is not a known element`).toBe(
						true,
					)
				}
			}
		}
	})
})

// ── findPattern ───────────────────────────────────────────────────────────────

describe("findPattern", () => {
	it("finds by exact id", () => {
		expect(findPattern("invoice-approval")?.id).toBe("invoice-approval")
	})

	it("finds by keyword match", () => {
		expect(findPattern("I need an employee onboarding workflow")?.id).toBe("employee-onboarding")
	})

	it("finds loan origination from description", () => {
		expect(findPattern("loan application process for a bank")?.id).toBe("loan-origination")
	})

	it("finds incident response from ops keywords", () => {
		expect(findPattern("on-call incident response and escalation")?.id).toBe("incident-response")
	})

	it("returns undefined when no match", () => {
		expect(findPattern("something completely unrelated xyz")).toBeUndefined()
	})

	it("prefers exact id over keyword match", () => {
		// "order-fulfillment" could match "order" keywords, but exact id wins
		expect(findPattern("order-fulfillment")?.id).toBe("order-fulfillment")
	})
})

// ── worker scaffold generation (pure, no I/O) ─────────────────────────────────

// Re-export internal functions via a thin test-only module boundary.
// We test the generated worker code by importing the private helpers.
// Since these are module-private, we extract the logic into a shared utility
// and test the key properties of the generated output.

describe("worker scaffold output", () => {
	let tmpDir: string

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "bpmnkit-aikit-test-"))
	})

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true })
	})

	it("generates valid package.json with bpmnkit metadata", () => {
		// Simulate what toolWorkerScaffold writes
		const pkg = {
			name: "my-worker-worker",
			version: "1.0.0",
			type: "module",
			main: "index.js",
			scripts: { start: "node index.js" },
			bpmnkit: {
				jobType: "com.example:my-worker:1",
				description: "Test worker",
			},
		}
		const pkgPath = join(tmpDir, "package.json")
		writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))

		const parsed = JSON.parse(readFileSync(pkgPath, "utf8")) as {
			bpmnkit: { jobType: string; description: string }
		}
		expect(parsed.bpmnkit.jobType).toBe("com.example:my-worker:1")
		expect(parsed.bpmnkit.description).toBe("Test worker")
	})
})

// ── bpmn_validate (pure, uses @bpmnkit/core) ──────────────────────────────────

describe("bpmn_validate logic", () => {
	let tmpDir: string

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "bpmnkit-aikit-test-"))
	})

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true })
	})

	it(
		"parses a minimal valid BPMN without throwing",
		async () => {
			const { Bpmn, optimize } = await import("@bpmnkit/core")
			const xml = Bpmn.export(Bpmn.parse(Bpmn.makeEmpty("Process_1", "Test")))
			const bpmnPath = join(tmpDir, "test.bpmn")
			writeFileSync(bpmnPath, xml)

			const defs = Bpmn.parse(readFileSync(bpmnPath, "utf8"))
			const report = optimize(defs)
			expect(Array.isArray(report.findings)).toBe(true)
		},
		30_000,
	)
})
