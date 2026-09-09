import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
	clearRegisteredTemplates,
	getTemplate,
	listConnectors,
	registerElementTemplates,
	searchConnectors,
} from "../src/index.js"
import { discoverElementTemplates } from "../src/node/discover.js"
import type { ElementTemplate } from "../src/template-types.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

function template(id: string, name = "Workspace connector"): Record<string, unknown> {
	return {
		id,
		name,
		appliesTo: ["bpmn:ServiceTask"],
		properties: [
			{
				type: "Hidden",
				value: `${id}:1`,
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
		],
	}
}

let root: string

/** Writes a template document into `<dir>/<configFolder>/element-templates/<file>`. */
function writeTemplate(
	dir: string,
	file: string,
	content: unknown,
	configFolder = ".camunda",
): void {
	const target = join(root, dir, configFolder, "element-templates")
	mkdirSync(target, { recursive: true })
	writeFileSync(
		join(target, file),
		typeof content === "string" ? content : JSON.stringify(content, null, 2),
		"utf-8",
	)
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "bpmnkit-templates-"))
	mkdirSync(join(root, "processes", "orders"), { recursive: true })
})

afterEach(() => {
	clearRegisteredTemplates()
})

// ── Discovery ─────────────────────────────────────────────────────────────────

describe("discoverElementTemplates", () => {
	it("finds nothing in a project with no templates", async () => {
		const result = await discoverElementTemplates({ from: join(root, "processes"), root })
		expect(result).toMatchObject({ templates: [], problems: [], directories: [] })
	})

	it("finds a template at the project root", async () => {
		writeTemplate(".", "mine.json", template("com.example.A"))
		const { templates } = await discoverElementTemplates({
			from: join(root, "processes", "orders"),
			root,
		})
		expect(templates.map((t) => t.id)).toEqual(["com.example.A"])
	})

	it("accepts a file path and searches from its folder", async () => {
		writeTemplate("processes", "mine.json", template("com.example.A"))
		const { templates } = await discoverElementTemplates({
			from: join(root, "processes", "order.bpmn"),
			root,
		})
		expect(templates.map((t) => t.id)).toEqual(["com.example.A"])
	})

	it("reads every level, nearest last so it can override", async () => {
		writeTemplate(".", "a.json", template("com.example.Shared", "Root version"))
		writeTemplate("processes/orders", "a.json", template("com.example.Shared", "Nearby version"))
		const { templates, directories } = await discoverElementTemplates({
			from: join(root, "processes", "orders"),
			root,
		})
		expect(templates.map((t) => t.name)).toEqual(["Root version", "Nearby version"])
		expect(directories).toHaveLength(2)
		expect(directories[1]).toContain(join("processes", "orders"))
	})

	it("stops at the root and never walks above it", async () => {
		// A template above the root must not be picked up.
		writeTemplate("..", "outside.json", template("com.example.Outside"))
		const { templates } = await discoverElementTemplates({
			from: join(root, "processes"),
			root,
		})
		expect(templates).toEqual([])
	})

	it("returns only the start directory when it lies outside the root", async () => {
		const other = mkdtempSync(join(tmpdir(), "bpmnkit-elsewhere-"))
		const { templates, problems } = await discoverElementTemplates({ from: other, root })
		expect(templates).toEqual([])
		expect(problems).toEqual([])
	})

	it("honours a different config folder", async () => {
		writeTemplate(".", "mine.json", template("com.example.A"), ".bpmnkit")
		const fromDefault = await discoverElementTemplates({ from: join(root, "processes"), root })
		expect(fromDefault.templates).toEqual([])

		const fromCustom = await discoverElementTemplates({
			from: join(root, "processes"),
			root,
			configFolder: ".bpmnkit",
		})
		expect(fromCustom.templates.map((t) => t.id)).toEqual(["com.example.A"])
	})

	it("reads a document holding an array of templates", async () => {
		writeTemplate(".", "many.json", [template("com.example.A"), template("com.example.B")])
		const { templates } = await discoverElementTemplates({ from: join(root, "processes"), root })
		expect(templates.map((t) => t.id)).toEqual(["com.example.A", "com.example.B"])
	})

	it("names a file that is not valid JSON and keeps going", async () => {
		writeTemplate(".", "broken.json", "{ not json")
		writeTemplate(".", "good.json", template("com.example.Good"))
		const { templates, problems } = await discoverElementTemplates({
			from: join(root, "processes"),
			root,
		})
		expect(templates.map((t) => t.id)).toEqual(["com.example.Good"])
		expect(problems).toHaveLength(1)
		expect(problems[0]?.file).toContain("broken.json")
		expect(problems[0]?.message).toContain("not valid JSON")
	})

	it("names a template the schema rejects and keeps the rest of the file", async () => {
		writeTemplate(".", "mixed.json", [
			template("com.example.Good"),
			{ ...template("com.example.Bad"), appliesTo: [] },
		])
		const { templates, problems } = await discoverElementTemplates({
			from: join(root, "processes"),
			root,
		})
		expect(templates.map((t) => t.id)).toEqual(["com.example.Good"])
		expect(problems[0]).toMatchObject({ id: "com.example.Bad", path: "appliesTo", index: 1 })
		expect(problems[0]?.file).toContain("mixed.json")
	})

	it("ignores files that are not .json", async () => {
		writeTemplate(".", "notes.md", "# not a template")
		writeTemplate(".", "good.json", template("com.example.Good"))
		const { templates, problems } = await discoverElementTemplates({
			from: join(root, "processes"),
			root,
		})
		expect(templates.map((t) => t.id)).toEqual(["com.example.Good"])
		expect(problems).toEqual([])
	})

	it("reads files in a stable order", async () => {
		writeTemplate(".", "b.json", template("com.example.B"))
		writeTemplate(".", "a.json", template("com.example.A"))
		const { templates } = await discoverElementTemplates({ from: join(root, "processes"), root })
		expect(templates.map((t) => t.id)).toEqual(["com.example.A", "com.example.B"])
	})
})

// ── Registration ──────────────────────────────────────────────────────────────

describe("registerElementTemplates", () => {
	it("makes a workspace template visible to the catalogue", () => {
		expect(getTemplate("com.example.A")).toBeUndefined()
		registerElementTemplates([template("com.example.A") as unknown as ElementTemplate])
		expect(getTemplate("com.example.A")?.name).toBe("Workspace connector")
		expect(listConnectors().some((c) => c.id === "com.example.A")).toBe(true)
	})

	it("lets a workspace template override a bundled one", () => {
		const slackId = "io.camunda.connectors.Slack.v1"
		expect(getTemplate(slackId)?.name).not.toBe("Our Slack")
		registerElementTemplates([template(slackId, "Our Slack") as unknown as ElementTemplate])
		expect(getTemplate(slackId)?.name).toBe("Our Slack")
		// Exactly one entry for that id — the bundled one is replaced, not shadowed.
		expect(listConnectors().filter((c) => c.id === slackId)).toHaveLength(1)
	})

	it("keeps the later registration of the same id, so a nearer file wins", () => {
		registerElementTemplates([template("com.example.A", "Far") as unknown as ElementTemplate])
		registerElementTemplates([template("com.example.A", "Near") as unknown as ElementTemplate])
		expect(getTemplate("com.example.A")?.name).toBe("Near")
	})

	it("makes a workspace template searchable", () => {
		registerElementTemplates([
			template("com.example.Zebra", "Zebra herder") as unknown as ElementTemplate,
		])
		expect(searchConnectors("zebra").map((c) => c.id)).toContain("com.example.Zebra")
	})

	it("clearRegisteredTemplates restores the bundled catalogue", () => {
		const before = listConnectors().length
		registerElementTemplates([template("com.example.A") as unknown as ElementTemplate])
		expect(listConnectors().length).toBe(before + 1)
		clearRegisteredTemplates()
		expect(listConnectors().length).toBe(before)
		expect(getTemplate("com.example.A")).toBeUndefined()
	})
})
