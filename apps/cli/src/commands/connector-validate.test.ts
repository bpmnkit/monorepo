import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import type { RunContext } from "../types.js"
import { connectorGroup } from "./connector.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

function template(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id,
		name: `Template ${id}`,
		appliesTo: ["bpmn:ServiceTask"],
		properties: [
			{
				type: "Hidden",
				value: `${id}:1`,
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
		],
		...overrides,
	}
}

let root: string

function writeTemplate(dir: string, file: string, content: unknown): string {
	const target = join(root, dir, ".camunda", "element-templates")
	mkdirSync(target, { recursive: true })
	const path = join(target, file)
	writeFileSync(
		path,
		typeof content === "string" ? content : JSON.stringify(content, null, 2),
		"utf-8",
	)
	return path
}

// ── Harness ───────────────────────────────────────────────────────────────────

interface Captured {
	printed: unknown[]
	ok: string[]
	info: string[]
}

const validate = connectorGroup.commands.find((c) => c.name === "validate")

/**
 * Runs the command and returns what it wrote *and* how it ended.
 *
 * The failure path is the interesting one — it still prints the findings a
 * human reads before throwing the exit signal a pipeline reads — so the output
 * has to survive the throw.
 */
async function run(
	positional: string[] = [],
	flags: Record<string, string | boolean> = {},
): Promise<Captured & { error?: Error }> {
	const captured: Captured = { printed: [], ok: [], info: [] }
	const ctx = {
		positional,
		flags,
		output: {
			print: (data: unknown) => captured.printed.push(data),
			ok: (msg: string) => captured.ok.push(msg),
			info: (msg: string) => captured.info.push(msg),
			printList: () => {},
		},
	} as unknown as RunContext
	if (validate === undefined) throw new Error("connector validate is not registered")
	try {
		await validate.run(ctx)
		return captured
	} catch (err) {
		return { ...captured, error: err instanceof Error ? err : new Error(String(err)) }
	}
}

function text(captured: Captured): string {
	return captured.printed.map(String).join("\n")
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "casen-connector-validate-"))
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("casen connector validate", () => {
	it("is registered in the connector group", () => {
		expect(validate).toBeDefined()
	})

	it("passes a project whose templates are all valid", async () => {
		writeTemplate(".", "a.json", template("com.example.A"))
		const captured = await run([root])
		expect(captured.ok[0]).toContain("1 template valid")
	})

	it("says so when a project has no templates at all", async () => {
		const captured = await run([root])
		expect(captured.info[0]).toContain("No element-template folders found")
		expect(captured.ok).toEqual([])
	})

	it("fails, naming the file and the path, when a template is invalid", async () => {
		const file = writeTemplate(
			".",
			"bad.json",
			template("com.example.Bad", { appliesTo: ["ServiceTask"] }),
		)
		const result = await run([root])
		expect(result.error?.message).toMatch(/1 problem/)
		expect(text(result)).toContain(file)
		expect(text(result)).toContain("appliesTo[0]")
		expect(text(result)).toContain('expected a "bpmn:" type')
	})

	it("finds a template nested below the root, not just the root's own", async () => {
		// The reason validate scans downward: a CI check that only read the root
		// would pass this project.
		writeTemplate(".", "good.json", template("com.example.Good"))
		const nested = writeTemplate(
			"processes/orders",
			"bad.json",
			template("com.example.Bad", { properties: "no" }),
		)
		const result = await run([root])
		expect(result.error).toBeDefined()
		expect(text(result)).toContain(nested)
	})

	it("reports a file that is not valid JSON", async () => {
		writeTemplate(".", "broken.json", "{ not json")
		const result = await run([root])
		expect(result.error).toBeDefined()
		expect(text(result)).toContain("not valid JSON")
	})

	it("keeps the good templates beside a bad one, and still fails", async () => {
		writeTemplate(".", "good.json", template("com.example.Good"))
		writeTemplate(".", "bad.json", template("com.example.Bad", { appliesTo: [] }))
		const result = await run([root], { format: "json" })
		expect(result.error).toBeDefined()
		expect(result.printed[0]).toMatchObject({ templateCount: 1, problemCount: 1 })
	})

	it("validates a single .json file when given one", async () => {
		const file = writeTemplate(".", "a.json", template("com.example.A"))
		const captured = await run([file])
		expect(captured.ok[0]).toContain("1 template valid")
	})

	it("fails on a single invalid .json file", async () => {
		const file = writeTemplate(".", "bad.json", template("com.example.Bad", { properties: 7 }))
		const result = await run([file])
		expect(result.error?.message).toMatch(/problem/)
		expect(text(result)).toContain("properties")
	})

	it("accepts a template with no properties at all", async () => {
		const file = writeTemplate(".", "empty.json", template("com.example.Empty", { properties: [] }))
		const result = await run([file])
		expect(result.error).toBeUndefined()
	})

	it("rejects a single file that is not JSON at all", async () => {
		const file = writeTemplate(".", "broken.json", "{ not json")
		const result = await run([file])
		expect(result.error?.message).toMatch(/not valid JSON/)
	})

	it("emits a machine-readable report under --format json", async () => {
		writeTemplate(".", "a.json", template("com.example.A"))
		const captured = await run([root], { format: "json" })
		expect(captured.printed).toHaveLength(1)
		expect(captured.printed[0]).toMatchObject({ problemCount: 0, templateCount: 1 })
	})

	it("still fails under --format json when a template is invalid", async () => {
		writeTemplate(".", "bad.json", template("com.example.Bad", { appliesTo: [] }))
		const result = await run([root], { format: "json" })
		expect(result.error?.message).toMatch(/problem/)
	})

	it("honours a custom config folder", async () => {
		const target = join(root, ".bpmnkit", "element-templates")
		mkdirSync(target, { recursive: true })
		writeFileSync(join(target, "a.json"), JSON.stringify(template("com.example.A")), "utf-8")

		const withDefault = await run([root])
		expect(withDefault.info[0]).toContain("No element-template folders found")

		const withCustom = await run([root], { "config-folder": ".bpmnkit" })
		expect(withCustom.ok[0]).toContain("1 template valid")
	})

	it("counts a warning without failing", async () => {
		writeTemplate(
			".",
			"inbound.json",
			template("com.example.Inbound", {
				properties: [{ binding: { type: "bpmn:Message#property", name: "name" } }],
			}),
		)
		const captured = await run([root])
		expect(captured.ok[0]).toContain("1 warning")
		expect(text(captured)).toContain("not applied by this toolkit yet")
	})
})
