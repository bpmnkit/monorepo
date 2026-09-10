import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import type { RunContext } from "../types.js"
import { lintGroup } from "./lint.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * A service task with no `zeebe:taskDefinition`. Against Camunda 8 that is a
 * deploy error; on a model naming no engine it is a demand its author never
 * signed up for.
 */
function makeXml(platform?: string): string {
	const modelerNs =
		platform === undefined
			? ""
			: ` xmlns:modeler="http://camunda.org/schema/modeler/1.0" modeler:executionPlatform="${platform}" modeler:executionPlatformVersion="8.6.0"`
	return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"${modelerNs}
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Order received"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="charge" name="Charge card"><bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:endEvent id="end" name="Done"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="charge" />
    <bpmn:sequenceFlow id="f2" sourceRef="charge" targetRef="end" />
  </bpmn:process>
</bpmn:definitions>`
}

// ── Harness ───────────────────────────────────────────────────────────────────

interface Captured {
	printed: unknown[]
	ok: string[]
	info: string[]
	error?: Error
}

const lintCmd = lintGroup.commands.find((c) => c.name === "lint")

let dir: string

function fixture(name: string, xml: string): string {
	const path = join(dir, name)
	writeFileSync(path, xml, "utf-8")
	return path
}

async function run(file: string, flags: Record<string, string | boolean> = {}): Promise<Captured> {
	const captured: Captured = { printed: [], ok: [], info: [] }
	const ctx = {
		positional: [file],
		flags,
		output: {
			print: (data: unknown) => captured.printed.push(data),
			ok: (msg: string) => captured.ok.push(msg),
			info: (msg: string) => captured.info.push(msg),
		},
	} as unknown as RunContext
	if (lintCmd === undefined) throw new Error("lint command is not registered")
	try {
		await lintCmd.run(ctx)
	} catch (err) {
		captured.error = err instanceof Error ? err : new Error(String(err))
	}
	return captured
}

function lines(captured: Captured): string {
	return [...captured.info, ...captured.ok].join("\n")
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "casen-lint-engine-"))
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("casen lint — engine layer", () => {
	it("reports the deploy error on a Camunda Cloud model", async () => {
		const file = fixture("c8.bpmn", makeXml("Camunda Cloud"))
		const result = await run(file)
		expect(lines(result)).toContain("zeebe:taskDefinition")
		expect(result.error?.message).toMatch(/Lint failed with 1 error/)
	})

	it("does not report it on a model that names no engine", async () => {
		const file = fixture("neutral.bpmn", makeXml())
		const result = await run(file)
		expect(lines(result)).not.toContain("zeebe:taskDefinition")
		expect(result.error).toBeUndefined()
	})

	it("says why the deployability rules were skipped", async () => {
		const file = fixture("neutral.bpmn", makeXml())
		// Silently running fewer rules would look like the analysis was broken.
		expect(lines(await run(file))).toContain("deployability rules were skipped")
	})

	it("still reports structural findings on a neutral model", async () => {
		const file = fixture("neutral.bpmn", makeXml())
		const result = await run(file)
		expect(lines(result)).toMatch(/1 finding/)
	})

	it("--profile deploy runs the engine rules anyway", async () => {
		// Asking for the deploy gate is asking for those rules.
		const file = fixture("neutral.bpmn", makeXml())
		const result = await run(file, { profile: "deploy" })
		expect(lines(result)).toContain("zeebe:taskDefinition")
		expect(result.error?.message).toMatch(/Lint failed/)
	})

	it("--profile deploy does not add the skipped-rules note", async () => {
		const file = fixture("neutral.bpmn", makeXml())
		expect(lines(await run(file, { profile: "deploy" }))).not.toContain(
			"deployability rules were skipped",
		)
	})

	it("keeps an explicit --categories request, minus the engine layer", async () => {
		const file = fixture("neutral.bpmn", makeXml())
		const result = await run(file, { categories: "deploy,pattern" })
		expect(lines(result)).not.toContain("zeebe:taskDefinition")
	})

	it("says nothing about engines when the model names one", async () => {
		const file = fixture("c8.bpmn", makeXml("Camunda Cloud"))
		expect(lines(await run(file))).not.toContain("deployability rules were skipped")
	})
})
