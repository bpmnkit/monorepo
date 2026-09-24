import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Bpmn } from "@bpmnkit/core"
import { beforeEach, describe, expect, it } from "vitest"
import type { RunContext } from "../types.js"
import { templateGroup } from "./template.js"

interface Captured {
	listed: unknown[]
	ok: string[]
	info: string[]
}

async function run(
	command: "list" | "use",
	positional: string[],
	flags: Record<string, string | boolean> = {},
): Promise<Captured> {
	const captured: Captured = { listed: [], ok: [], info: [] }
	const ctx = {
		positional,
		flags,
		output: {
			printList: (data: unknown) => captured.listed.push(data),
			ok: (msg: string) => captured.ok.push(msg),
			info: (msg: string) => captured.info.push(msg),
		},
	} as unknown as RunContext
	const cmd = templateGroup.commands.find((c) => c.name === command)
	if (cmd === undefined) throw new Error(`template ${command} is not registered`)
	await cmd.run(ctx)
	return captured
}

let dir: string

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "casen-template-"))
})

describe("casen template", () => {
	it("lists every template, or one category", async () => {
		const all = (await run("list", [])).listed[0] as Array<{ id: string }>
		expect(all.length).toBeGreaterThanOrEqual(20)
		const ai = (await run("list", [], { category: "ai-agents" })).listed[0] as Array<{
			category: string
		}>
		expect(ai.length).toBe(7)
		expect(ai.every((t) => t.category === "ai-agents")).toBe(true)
		await expect(run("list", [], { category: "nope" })).rejects.toThrow(/Unknown category "nope"/)
	})

	it("writes the BPMN, its scenarios and its DMN into the target directory", async () => {
		const target = join(dir, "processes")
		const out = await run("use", ["purchase-request-approval", target])
		expect(readdirSync(target).sort()).toEqual([
			"approval-matrix.dmn",
			"purchase-request-approval.bpmn",
			"purchase-request-approval.bpmn.tests.json",
		])
		expect(out.ok).toHaveLength(3)
		const defs = Bpmn.parse(readFileSync(join(target, "purchase-request-approval.bpmn"), "utf-8"))
		expect(defs.processes[0]?.id).toBe("purchase-request-approval")
		const scenarios = JSON.parse(
			readFileSync(join(target, "purchase-request-approval.bpmn.tests.json"), "utf-8"),
		) as unknown[]
		expect(scenarios.length).toBeGreaterThanOrEqual(2)
	})

	it("writes forms next to the process", async () => {
		await run("use", ["content-review", dir])
		expect(readdirSync(dir)).toContain("editorial-review.form")
	})

	it("refuses to overwrite without --force", async () => {
		writeFileSync(join(dir, "order-to-cash.bpmn"), "mine", "utf-8")
		await expect(run("use", ["order-to-cash", dir])).rejects.toThrow(
			/order-to-cash.bpmn already exist/,
		)
		expect(readFileSync(join(dir, "order-to-cash.bpmn"), "utf-8")).toBe("mine")
		await run("use", ["order-to-cash", dir], { force: true })
		expect(readFileSync(join(dir, "order-to-cash.bpmn"), "utf-8")).toContain("<bpmn:process")
	})

	it("names the list command when the id is unknown", async () => {
		await expect(run("use", ["no-such-template", dir])).rejects.toThrow(/casen template list/)
	})
})
