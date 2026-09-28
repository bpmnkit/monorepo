import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Dmn } from "@bpmnkit/core"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { RunContext } from "../types.js"
import { docGroup } from "./doc.js"
import { commandGroups } from "./index.js"

const BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="D" targetNamespace="x">
  <bpmn:process id="order" name="Order" isExecutable="true">
    <bpmn:startEvent id="s" name="Order in"/>
    <bpmn:businessRuleTask id="score" name="Score"><bpmn:extensionElements>
      <zeebe:calledDecision decisionId="risk" resultVariable="r"/>
    </bpmn:extensionElements></bpmn:businessRuleTask>
    <bpmn:sequenceFlow id="f" sourceRef="s" targetRef="score"/>
  </bpmn:process>
</bpmn:definitions>`

const DMN = Dmn.export(
	Dmn.createDecisionTable("risk")
		.name("Risk")
		.input({ label: "Amount", expression: "amount" })
		.output({ label: "Level", name: "level" })
		.rule({ inputs: ["> 1"], outputs: ['"high"'] })
		.build(),
)

describe("casen doc export", () => {
	let dir: string
	const lines: string[] = []

	function run(positional: string[], flags: Record<string, string> = {}): Promise<void> {
		const cmd = docGroup.commands.find((c) => c.name === "export")
		if (!cmd) throw new Error("doc export command not registered")
		const ctx = {
			positional,
			flags,
			output: { ok: (m: string) => lines.push(m), info: (m: string) => lines.push(m) },
		} as unknown as RunContext
		return cmd.run(ctx)
	}

	beforeAll(() => {
		dir = mkdtempSync(join(tmpdir(), "casen-doc-"))
		writeFileSync(join(dir, "order.bpmn"), BPMN)
		writeFileSync(join(dir, "risk.dmn"), DMN)
	})
	afterAll(() => rmSync(dir, { recursive: true, force: true }))

	it("is routed as its own group without clashing with the document API group", () => {
		const names = commandGroups.map((g) => g.name)
		expect(names.filter((n) => n === "doc")).toHaveLength(1)
		expect(names).toContain("document")
	})

	it("writes print-ready HTML next to the file by default, with linked decisions", async () => {
		await run([join(dir, "order.bpmn"), join(dir, "risk.dmn")])
		const html = readFileSync(join(dir, "order.html"), "utf-8")
		expect(html).toContain("@media print")
		expect(html).toContain('id="decision-risk"')
		expect(lines.at(-1)).toBe(`Documentation written to ${join(dir, "order.html")}`)
	})

	it("writes Markdown and Word to --out", async () => {
		await run([join(dir, "order.bpmn")], {
			format: "md",
			out: join(dir, "doc.md"),
			title: "Orders",
		})
		expect(readFileSync(join(dir, "doc.md"), "utf-8").startsWith("# Orders\n")).toBe(true)
		await run([join(dir, "order.bpmn")], {
			format: "docx",
			out: join(dir, "doc.docx"),
			paper: "letter",
		})
		expect([...readFileSync(join(dir, "doc.docx")).subarray(0, 2)]).toEqual([0x50, 0x4b])
	})

	it("rejects unknown formats and unrelated linked files", async () => {
		await expect(run([join(dir, "order.bpmn")], { format: "pdf" })).rejects.toThrow(
			'Unknown --format "pdf"',
		)
		await expect(run([join(dir, "order.bpmn"), join(dir, "order.bpmn")])).rejects.toThrow(
			"only .dmn and .form files",
		)
	})
})
