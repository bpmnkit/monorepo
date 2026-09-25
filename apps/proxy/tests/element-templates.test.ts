import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { handleElementTemplates, isInsideRoot } from "../src/routes/element-templates.js"

function template(id: string, name: string) {
	return {
		$schema: "https://unpkg.com/@camunda/zeebe-element-templates-json-schema/resources/schema.json",
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

let outside: string
let root: string

function put(dir: string, file: string, body: unknown): void {
	const folder = join(dir, ".camunda", "element-templates")
	mkdirSync(folder, { recursive: true })
	writeFileSync(join(folder, file), JSON.stringify(body))
}

beforeAll(() => {
	outside = realpathSync(mkdtempSync(join(tmpdir(), "proxy-templates-")))
	root = join(outside, "project")
	// Outside the project: must never be read.
	put(outside, "outside.json", template("acme.outside", "Outside"))
	put(root, "shared.json", [template("acme.shared", "Root shared"), template("acme.root", "Root")])
	put(join(root, "a"), "a.json", [template("acme.a", "A"), template("acme.shared", "A shared")])
	put(join(root, "b"), "b.json", template("acme.b", "B"))
	writeFileSync(join(root, "a", "order.bpmn"), "<definitions/>")
	writeFileSync(join(root, "b", "invoice.bpmn"), "<definitions/>")
})

afterAll(() => {
	rmSync(outside, { recursive: true, force: true })
})

function ids(body: unknown): string[] {
	return (body as { templates: Array<{ id: string }> }).templates.map((t) => t.id)
}

function names(body: unknown): Record<string, string> {
	const out: Record<string, string> = {}
	for (const t of (body as { templates: Array<{ id: string; name: string }> }).templates) {
		out[t.id] = t.name // later wins, as registerElementTemplates keeps the last
	}
	return out
}

describe("GET /element-templates", () => {
	it("?root= still merges the whole project", async () => {
		const { status, body } = await handleElementTemplates(new URLSearchParams({ root }))
		expect(status).toBe(200)
		expect(ids(body)).toEqual(expect.arrayContaining(["acme.a", "acme.b", "acme.root"]))
		expect(ids(body)).not.toContain("acme.outside")
	})

	it("&file= returns only the templates that diagram sees, nearest winning", async () => {
		const { status, body } = await handleElementTemplates(
			new URLSearchParams({ root, file: "a/order.bpmn" }),
		)
		expect(status).toBe(200)
		expect(ids(body)).toEqual(expect.arrayContaining(["acme.a", "acme.root", "acme.shared"]))
		expect(ids(body)).not.toContain("acme.b")
		expect(ids(body)).not.toContain("acme.outside")
		expect(names(body)["acme.shared"]).toBe("A shared")
	})

	it("accepts an absolute file inside root", async () => {
		const { status, body } = await handleElementTemplates(
			new URLSearchParams({ root, file: join(root, "b", "invoice.bpmn") }),
		)
		expect(status).toBe(200)
		expect(ids(body)).toContain("acme.b")
		expect(ids(body)).not.toContain("acme.a")
		expect(names(body)["acme.shared"]).toBe("Root shared")
	})

	it("refuses a file outside root, by traversal or by absolute path", async () => {
		for (const file of ["../x.bpmn", "a/../../x.bpmn", join(outside, "x.bpmn"), "/etc/passwd"]) {
			const { status } = await handleElementTemplates(new URLSearchParams({ root, file }))
			expect(status, file).toBe(400)
		}
	})

	it("refuses a configFolder that is a path", async () => {
		const { status } = await handleElementTemplates(
			new URLSearchParams({ root, file: "a/order.bpmn", configFolder: "../.camunda" }),
		)
		expect(status).toBe(400)
	})

	it("needs an existing root and file", async () => {
		expect(
			(await handleElementTemplates(new URLSearchParams({ file: "a/order.bpmn" }))).status,
		).toBe(400)
		expect(
			(await handleElementTemplates(new URLSearchParams({ root, file: "a/missing.bpmn" }))).status,
		).toBe(404)
	})

	it("isInsideRoot keeps to the root and its descendants", () => {
		expect(isInsideRoot("/p", "/p")).toBe(true)
		expect(isInsideRoot("/p", "/p/a.bpmn")).toBe(true)
		expect(isInsideRoot("/p", "/pother/a.bpmn")).toBe(false)
		expect(isInsideRoot("/p", "/p/../etc")).toBe(false)
	})
})
