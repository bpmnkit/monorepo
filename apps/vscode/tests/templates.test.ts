import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { requirementsResolver, resolverForFile } from "../src/host/templates.js"

const roots: string[] = []

async function project(files: Record<string, unknown>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "bpmnkit-templates-"))
	roots.push(root)
	for (const [path, content] of Object.entries(files)) {
		const full = join(root, path)
		await mkdir(join(full, ".."), { recursive: true })
		await writeFile(full, typeof content === "string" ? content : JSON.stringify(content))
	}
	return root
}

afterEach(async () => {
	for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

/** A template whose one required input is `field`. */
function template(id: string, field: string): unknown {
	return {
		$schema: "https://unpkg.com/@camunda/zeebe-element-templates-json-schema/resources/schema.json",
		id,
		name: id,
		appliesTo: ["bpmn:ServiceTask"],
		properties: [
			{
				type: "Hidden",
				value: `${id}:1`,
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
			{
				label: field,
				type: "String",
				binding: { type: "zeebe:input", name: field },
				constraints: { notEmpty: true },
			},
		],
	}
}

describe("resolverForFile", () => {
	it("sees the templates from the diagram's folder up to the workspace folder", async () => {
		const root = await project({
			".camunda/element-templates/root.json": template("acme.Root", "rootField"),
			"a/.camunda/element-templates/a.json": template("acme.A", "aField"),
			"b/.camunda/element-templates/b.json": template("acme.B", "bField"),
			"a/order.bpmn": "<definitions/>",
		})
		const resolve = await resolverForFile(join(root, "a", "order.bpmn"), root)

		expect(resolve("acme.A", [])).toEqual(["aField"])
		expect(resolve("acme.Root", [])).toEqual(["rootField"])
		// b/ is a sibling: its template is unknown here, so nothing is reported.
		expect(resolve("acme.B", [])).toEqual([])
	})

	it("lets the nearest folder win an id", async () => {
		const root = await project({
			".camunda/element-templates/root.json": template("acme.Shared", "rootField"),
			"a/.camunda/element-templates/a.json": template("acme.Shared", "nearField"),
			"a/order.bpmn": "<definitions/>",
		})
		const resolve = await resolverForFile(join(root, "a", "order.bpmn"), root)
		expect(resolve("acme.Shared", [])).toEqual(["nearField"])
	})

	it("searches only the diagram's own folder outside a workspace", async () => {
		const root = await project({
			".camunda/element-templates/root.json": template("acme.Root", "rootField"),
			"a/order.bpmn": "<definitions/>",
		})
		const resolve = await resolverForFile(join(root, "a", "order.bpmn"), undefined)
		expect(resolve("acme.Root", [])).toEqual([])
	})
})

describe("requirementsResolver", () => {
	it("falls back to the bundled catalogue", () => {
		const missing = requirementsResolver([])("io.camunda.connectors.Slack.v1", [
			"method",
			"data.channel",
		])
		expect(missing).toContain("token")
	})
})
