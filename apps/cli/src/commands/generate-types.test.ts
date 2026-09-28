import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { RunContext } from "../types.js"
import {
	compareWorkerContract,
	expandPatterns,
	findWorkerRegistrations,
	globToRegExp,
} from "./generate-types.js"
import { generateGroup } from "./generate.js"

const BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="D" targetNamespace="x">
  <bpmn:process id="order" isExecutable="true">
    <bpmn:serviceTask id="Ship"><bpmn:extensionElements>
      <zeebe:taskDefinition type="ship-order" />
      <zeebe:ioMapping><zeebe:input source="=order.id" target="orderId" /></zeebe:ioMapping>
    </bpmn:extensionElements></bpmn:serviceTask>
    <bpmn:serviceTask id="Bill"><bpmn:extensionElements>
      <zeebe:taskDefinition type="bill-customer" />
    </bpmn:extensionElements></bpmn:serviceTask>
    <bpmn:serviceTask id="Mail"><bpmn:extensionElements>
      <zeebe:taskDefinition type="io.camunda:sendgrid:1" />
    </bpmn:extensionElements></bpmn:serviceTask>
  </bpmn:process>
</bpmn:definitions>`

describe("globToRegExp", () => {
	it("matches *, ** and ? over path segments", () => {
		expect(globToRegExp("*.bpmn").test("a.bpmn")).toBe(true)
		expect(globToRegExp("*.bpmn").test("sub/a.bpmn")).toBe(false)
		expect(globToRegExp("**/*.bpmn").test("a.bpmn")).toBe(true)
		expect(globToRegExp("**/*.bpmn").test("x/y/a.bpmn")).toBe(true)
		expect(globToRegExp("v?.bpmn").test("v1.bpmn")).toBe(true)
		expect(globToRegExp("a.b").test("axb")).toBe(false)
	})
})

describe("findWorkerRegistrations", () => {
	it("finds the job type literal in each registration style", () => {
		const source = [
			`zbc.createWorker("legacy-type", handler)`,
			`zbc.createWorker({ taskType: 'zeebe-node-type', taskHandler })`,
			"client.createJobWorker({",
			"  jobTimeoutMs: 1000,",
			`  type: "ocapi-type",`,
			"})",
			"registerJobWorker(`registered-type`, fn)",
			'camunda.createJobWorker({ jobType: "ocapi-job-type", jobHandler })',
			`for await (const job of client.poll("bpmnkit-type")) {}`,
			"createWorker(`dynamic-${kind}`, fn)",
		].join("\n")
		expect(findWorkerRegistrations(source, "w.ts")).toEqual([
			{ type: "legacy-type", file: "w.ts", line: 1 },
			{ type: "zeebe-node-type", file: "w.ts", line: 2 },
			{ type: "ocapi-type", file: "w.ts", line: 5 },
			{ type: "registered-type", file: "w.ts", line: 7 },
			{ type: "ocapi-job-type", file: "w.ts", line: 8 },
			{ type: "bpmnkit-type", file: "w.ts", line: 9 },
		])
	})
})

describe("compareWorkerContract", () => {
	it("reports both directions and leaves connector types to the runtime", () => {
		const report = compareWorkerContract(
			[
				{ type: "a", elements: ["p#A"] },
				{ type: "b", elements: ["p#B"] },
				{ type: "io.camunda:http-json:1", elements: ["p#H"] },
			],
			[
				{ type: "a", file: "w.ts", line: 1 },
				{ type: "c", file: "w.ts", line: 2 },
			],
		)
		expect(report.matched).toEqual(["a"])
		expect(report.missingWorkers).toEqual([{ type: "b", elements: ["p#B"] }])
		expect(report.unknownWorkers).toEqual([{ type: "c", file: "w.ts", line: 2 }])
		expect(report.connectorTypes).toEqual(["io.camunda:http-json:1"])
	})
})

describe("casen gen types", () => {
	let dir: string
	let cwd: string
	const infos: string[] = []

	function run(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
		const cmd = generateGroup.commands.find((c) => c.name === "types")
		if (!cmd) throw new Error("generate types command not registered")
		const ctx = {
			positional,
			flags,
			output: {
				ok: (m: string) => infos.push(m),
				info: (m: string) => infos.push(m),
				print: (d: unknown) => infos.push(JSON.stringify(d)),
			},
		} as unknown as RunContext
		return cmd.run(ctx)
	}

	beforeAll(() => {
		cwd = process.cwd()
		dir = mkdtempSync(join(tmpdir(), "casen-gen-types-"))
		mkdirSync(join(dir, "processes", "nested"), { recursive: true })
		mkdirSync(join(dir, "src"))
		writeFileSync(join(dir, "processes", "nested", "order.bpmn"), BPMN)
		writeFileSync(join(dir, "processes", "notes.txt"), "not bpmn")
		writeFileSync(
			join(dir, "src", "workers.ts"),
			`client.poll("ship-order")\nclient.poll("refund-order")\n`,
		)
		process.chdir(dir)
	})

	afterAll(() => {
		process.chdir(cwd)
		rmSync(dir, { force: true, recursive: true })
	})

	it("expands directories and globs to BPMN files only", async () => {
		const expected = [join(dir, "processes", "nested", "order.bpmn")]
		expect(await expandPatterns(["processes"], [".bpmn"])).toEqual(expected)
		expect(await expandPatterns(["processes/**/*.bpmn"], [".bpmn"])).toEqual(expected)
		await expect(expandPatterns(["missing.bpmn"], [".bpmn"])).rejects.toThrow(/No such file/)
	})

	it("writes the types file, creating its directory", async () => {
		await run(["processes/**/*.bpmn"], { out: "src/generated/bpmn-types.ts" })
		const source = readFileSync(join(dir, "src/generated/bpmn-types.ts"), "utf-8")
		expect(source).toMatch(/^\/\/ generated by casen gen types — do not edit/)
		expect(source).toContain('"ship-order": {')
		expect(source).toContain("export interface ShipOrderVariables {\n\torderId: unknown\n}")
	})

	it("--check passes when the file is current", async () => {
		await expect(
			run(["processes"], { out: "src/generated/bpmn-types.ts", check: true }),
		).resolves.toBeUndefined()
	})

	it("--check fails when the file is stale, and does not rewrite it", async () => {
		const path = join(dir, "src/generated/bpmn-types.ts")
		writeFileSync(path, "// stale\n")
		await expect(
			run(["processes"], { out: "src/generated/bpmn-types.ts", check: true }),
		).rejects.toThrow(/out of date/)
		expect(readFileSync(path, "utf-8")).toBe("// stale\n")
	})

	it("--check takes back a file the parser handed it as its value", async () => {
		// `casen gen types --check processes --out f` parses as check="processes".
		await run(["processes"], { out: "src/generated/bpmn-types.ts" })
		await expect(
			run([], { check: "processes", out: "src/generated/bpmn-types.ts" }),
		).resolves.toBeUndefined()
	})

	it("--check without --out is refused", async () => {
		await expect(run(["processes"], { check: true })).rejects.toThrow(/--check needs --out/)
	})

	it("--check-workers reports mismatches, and --strict fails on them", async () => {
		infos.length = 0
		await run(["processes"], { "check-workers": "src/**/*.ts" })
		expect(infos.join("\n")).toContain('no worker for job type "bill-customer" (order#Bill)')
		expect(infos.join("\n")).toContain('worker for "refund-order" at src/workers.ts:2')
		expect(infos.join("\n")).toContain("1 Camunda connector job type(s)")
		expect(infos.join("\n")).not.toContain("sendgrid")

		await expect(run(["processes"], { "check-workers": "src", strict: true })).rejects.toThrow(
			/2 mismatch/,
		)
	})

	it("--check-workers --format json prints the report", async () => {
		infos.length = 0
		await run(["processes"], { "check-workers": "src", format: "json" })
		const report = JSON.parse(infos[0] as string)
		expect(report.matched).toEqual(["ship-order"])
	})
})
