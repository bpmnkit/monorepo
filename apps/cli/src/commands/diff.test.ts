import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import type { RunContext } from "../types.js"
import { diffGroup } from "./diff.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * A model with a collapsed sub-process, so the plane behaviour is exercised on
 * the shape a viewer actually shows one at a time.
 */
function makeXml(
	options: {
		chargeName?: string
		startX?: number
		withLegacy?: boolean
		withPack?: boolean
	} = {},
): string {
	const { chargeName = "Charge card", startX = 100, withLegacy = true, withPack = false } = options
	return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Order received"/>
    <bpmn:serviceTask id="charge" name="${chargeName}"/>
    ${withLegacy ? '<bpmn:serviceTask id="legacy" name="Legacy fraud check"/>' : ""}
    <bpmn:subProcess id="sub" name="Fulfilment">
      <bpmn:task id="pick" name="Pick items"/>
      ${withPack ? '<bpmn:task id="pack" name="Pack box"/>' : ""}
    </bpmn:subProcess>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1">
    <bpmndi:BPMNPlane id="p1" bpmnElement="proc">
      <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="${startX}" y="100" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="s2" bpmnElement="charge"><dc:Bounds x="200" y="80" width="100" height="80"/></bpmndi:BPMNShape>
      ${withLegacy ? '<bpmndi:BPMNShape id="s3" bpmnElement="legacy"><dc:Bounds x="340" y="80" width="100" height="80"/></bpmndi:BPMNShape>' : ""}
      <bpmndi:BPMNShape id="s4" bpmnElement="sub" isExpanded="false"><dc:Bounds x="480" y="80" width="100" height="80"/></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
  <bpmndi:BPMNDiagram id="d2">
    <bpmndi:BPMNPlane id="p2" bpmnElement="sub">
      <bpmndi:BPMNShape id="s5" bpmnElement="pick"><dc:Bounds x="160" y="80" width="100" height="80"/></bpmndi:BPMNShape>
      ${withPack ? '<bpmndi:BPMNShape id="s6" bpmnElement="pack"><dc:Bounds x="320" y="80" width="100" height="80"/></bpmndi:BPMNShape>' : ""}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
}

// ── Harness ───────────────────────────────────────────────────────────────────

let dir: string

function fixture(name: string, xml: string): string {
	const path = join(dir, name)
	writeFileSync(path, xml, "utf-8")
	return path
}

interface Captured {
	printed: unknown[]
	ok: string[]
}

const diffBpmn = diffGroup.commands.find((c) => c.name === "bpmn")

async function run(
	positional: string[],
	flags: Record<string, string | boolean> = {},
): Promise<Captured> {
	const captured: Captured = { printed: [], ok: [] }
	const ctx = {
		positional,
		flags,
		output: {
			print: (data: unknown) => captured.printed.push(data),
			ok: (msg: string) => captured.ok.push(msg),
			info: () => {},
		},
	} as unknown as RunContext
	if (diffBpmn === undefined) throw new Error("diff bpmn command not registered")
	await diffBpmn.run(ctx)
	return captured
}

/** The single text block the command prints when there are differences. */
function text(captured: Captured): string {
	return captured.printed.map(String).join("\n")
}

beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), "casen-diff-"))
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("casen diff bpmn", () => {
	it("is registered under the diff group", () => {
		expect(diffGroup.name).toBe("diff")
		expect(diffBpmn).toBeDefined()
	})

	it("reports no differences between a file and itself", async () => {
		const path = fixture("same.bpmn", makeXml())
		const captured = await run([path, path])
		expect(captured.ok).toEqual(["No differences."])
		expect(captured.printed).toEqual([])
	})

	it("names each element rather than printing bare ids", async () => {
		const before = fixture("n-before.bpmn", makeXml())
		const after = fixture("n-after.bpmn", makeXml({ chargeName: "Charge payment method" }))
		expect(text(await run([before, after]))).toContain("~ Charge payment method (charge)")
	})

	it("finds names of elements inside a sub-process", async () => {
		const before = fixture("s-before.bpmn", makeXml())
		const after = fixture("s-after.bpmn", makeXml({ withPack: true }))
		expect(text(await run([before, after]))).toContain("+ Pack box (pack)")
	})

	it("marks each category with its own symbol", async () => {
		const before = fixture("c-before.bpmn", makeXml())
		const after = fixture(
			"c-after.bpmn",
			makeXml({ chargeName: "Renamed", startX: 140, withLegacy: false, withPack: true }),
		)
		const out = text(await run([before, after]))
		expect(out).toContain("+ Pack box (pack)")
		expect(out).toContain("− Legacy fraud check (legacy)")
		expect(out).toContain("~ Renamed (charge)")
		expect(out).toContain("⇄ Order received (start)")
	})

	it("summarises with counts, omitting empty categories", async () => {
		const before = fixture("sum-before.bpmn", makeXml())
		const after = fixture("sum-after.bpmn", makeXml({ chargeName: "Renamed" }))
		const out = text(await run([before, after]))
		expect(out).toContain("1 difference: 1 changed")
		expect(out).not.toContain("added")
	})

	it("names the planes when a change is not all on one surface", async () => {
		const before = fixture("p-before.bpmn", makeXml())
		const after = fixture("p-after.bpmn", makeXml({ chargeName: "Renamed", withPack: true }))
		const out = text(await run([before, after]))
		// `sub` gained a child, so it changed on the root plane; `pack` is added on
		// the plane `sub` opens — the reviewer has to drill in to see it.
		expect(out).toContain("Across 2 planes:")
		expect(out).toContain("Fulfilment (sub): 1")
	})

	it("stays quiet about planes when everything is on one surface", async () => {
		const before = fixture("p1-before.bpmn", makeXml())
		const after = fixture("p1-after.bpmn", makeXml({ chargeName: "Renamed" }))
		expect(text(await run([before, after]))).not.toContain("planes")
	})

	it("prints the result object under --format json", async () => {
		const before = fixture("j-before.bpmn", makeXml())
		const after = fixture("j-after.bpmn", makeXml({ chargeName: "Renamed" }))
		const captured = await run([before, after], { format: "json" })
		expect(captured.printed).toHaveLength(1)
		expect(captured.printed[0]).toMatchObject({ changed: ["charge"], total: 1 })
	})

	it("fails under --exit-code when the diagrams differ", async () => {
		const before = fixture("e-before.bpmn", makeXml())
		const after = fixture("e-after.bpmn", makeXml({ chargeName: "Renamed" }))
		await expect(run([before, after], { "exit-code": true })).rejects.toThrow(/1 difference/)
	})

	it("succeeds under --exit-code when they match", async () => {
		const path = fixture("e-same.bpmn", makeXml())
		await expect(run([path, path], { "exit-code": true })).resolves.toBeDefined()
	})

	it("fails under --exit-code with --format json too", async () => {
		const before = fixture("ej-before.bpmn", makeXml())
		const after = fixture("ej-after.bpmn", makeXml({ chargeName: "Renamed" }))
		await expect(run([before, after], { "exit-code": true, format: "json" })).rejects.toThrow(
			/1 difference/,
		)
	})

	it("requires both paths", async () => {
		const path = fixture("only.bpmn", makeXml())
		await expect(run([path])).rejects.toThrow(/Missing required argument: <after>/)
		await expect(run([])).rejects.toThrow(/Missing required argument: <before>/)
	})
})
