import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Bpmn, lintDiagram } from "@bpmnkit/core"
import { beforeEach, describe, expect, it } from "vitest"
import type { RunContext } from "../types.js"
import { commandGroups } from "./index.js"
import { migrateGroup, migratedPath } from "./migrate.js"

const FIXTURES = join(import.meta.dirname, "../../../../packages/core/tests/fixtures/camunda7")

let dir: string

function fixture(name: string): string {
	const path = join(dir, name)
	copyFileSync(join(FIXTURES, name), path)
	return path
}

const c7 = migrateGroup.commands.find((c) => c.name === "c7")

async function run(
	positional: string[],
	flags: Record<string, string | boolean> = {},
): Promise<{ printed: unknown[]; error?: Error }> {
	const printed: unknown[] = []
	const ctx = {
		positional,
		flags,
		output: { print: (data: unknown) => printed.push(data), ok: () => {}, info: () => {} },
	} as unknown as RunContext
	if (c7 === undefined) throw new Error("migrate c7 not registered")
	try {
		await c7.run(ctx)
		return { printed }
	} catch (error) {
		return { printed, error: error as Error }
	}
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "casen-migrate-"))
})

describe("casen migrate c7", () => {
	it("is registered", () => {
		expect(commandGroups.some((g) => g.name === "migrate")).toBe(true)
		expect(c7).toBeDefined()
	})

	it("names outputs beside the input or inside --out", () => {
		expect(migratedPath("models/order.bpmn", undefined)).toBe("models/order.c8.bpmn")
		expect(migratedPath("models/order.xml", undefined)).toBe("models/order.xml.c8.bpmn")
		expect(migratedPath("models/order.bpmn", "out")).toBe(join("out", "order.bpmn"))
	})

	it("writes a deployable Camunda 8 model and prints the report grouped by severity", async () => {
		const input = fixture("invoice-approval.bpmn")
		const { printed, error } = await run([input])
		expect(error).toBeUndefined()
		const output = join(dir, "invoice-approval.c8.bpmn")
		const converted = Bpmn.parse(readFileSync(output, "utf-8"))
		expect(converted.unknownAttributes["modeler:executionPlatform"]).toBe("Camunda Cloud")
		expect(lintDiagram(converted, { categories: ["deploy"] }).counts.error).toBe(0)
		const text = String(printed[0])
		expect(text).toContain("17 convertible · 0 manual · 0 unsupported")
		expect(text).toContain("CONVERTIBLE")
		expect(text).not.toContain("MANUAL")
	})

	it("orders groups unsupported, manual, convertible", async () => {
		const { printed } = await run([fixture("order-fulfillment.bpmn")])
		const text = String(printed[0])
		expect(text.indexOf("UNSUPPORTED")).toBeLessThan(text.indexOf("MANUAL"))
		expect(text.indexOf("MANUAL")).toBeLessThan(text.indexOf("CONVERTIBLE"))
	})

	it("writes into --out, creating it", async () => {
		const input = fixture("claim-handling.bpmn")
		const out = join(dir, "c8")
		expect((await run([input], { out })).error).toBeUndefined()
		expect(existsSync(join(out, "claim-handling.bpmn"))).toBe(true)
	})

	it("never overwrites without --force", async () => {
		const input = fixture("invoice-approval.bpmn")
		const output = join(dir, "invoice-approval.c8.bpmn")
		writeFileSync(output, "keep me")
		const refused = await run([input])
		expect(refused.error?.message).toMatch(/could not be migrated/)
		expect(String(refused.printed[0])).toMatch(/already exists — pass --force/)
		expect(readFileSync(output, "utf-8")).toBe("keep me")
		expect((await run([input], { force: true })).error).toBeUndefined()
		expect(readFileSync(output, "utf-8")).toContain("zeebe:taskDefinition")
	})

	it("--check writes nothing and fails only when manual work remains", async () => {
		const clean = fixture("invoice-approval.bpmn")
		expect((await run([clean], { check: true })).error).toBeUndefined()
		expect(existsSync(join(dir, "invoice-approval.c8.bpmn"))).toBe(false)

		const open = fixture("order-fulfillment.bpmn")
		const result = await run([open], { check: true })
		expect(result.error?.message).toBe("Migration check failed: 10 manual or unsupported findings")
		expect(existsSync(join(dir, "order-fulfillment.c8.bpmn"))).toBe(false)
	})

	it("takes back a file the parser gave to a boolean flag", async () => {
		const a = fixture("invoice-approval.bpmn")
		const b = fixture("claim-handling.bpmn")
		const { printed } = await run([b], { check: a, format: "json" })
		const results = printed[0] as Array<{ file: string }>
		expect(results.map((r) => r.file)).toEqual([a, b])
	})

	it("prints JSON with counts and findings", async () => {
		const { printed } = await run([fixture("claim-handling.bpmn")], { format: "json" })
		const [result] = printed[0] as Array<{
			output: string
			counts: Record<string, number>
			findings: Array<{ severity: string }>
		}>
		expect(result?.output).toBe(join(dir, "claim-handling.c8.bpmn"))
		expect(result?.counts.manual).toBeGreaterThan(0)
		expect(result?.findings.length).toBe(
			(result?.counts.convertible ?? 0) +
				(result?.counts.manual ?? 0) +
				(result?.counts.unsupported ?? 0),
		)
	})

	it("refuses a model that already targets Camunda 8", async () => {
		const input = join(dir, "c8.bpmn")
		writeFileSync(
			input,
			readFileSync(join(FIXTURES, "invoice-approval.bpmn"), "utf-8").replace(
				'modeler:executionPlatform="Camunda Platform"',
				'modeler:executionPlatform="Camunda Cloud"',
			),
		)
		const { printed, error } = await run([input])
		expect(error).toBeDefined()
		expect(String(printed[0])).toMatch(/already targets Camunda 8/)
	})

	it("rejects an unknown format", async () => {
		expect(
			(await run([fixture("invoice-approval.bpmn")], { format: "xml" })).error?.message,
		).toMatch(/Unknown --format/)
	})
})
