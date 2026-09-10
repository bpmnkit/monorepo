import { describe, expect, it } from "vitest"
import { CAMUNDA_CONNECTOR_TEMPLATES } from "../src/index.js"
import { readTemplateDocument, validateElementTemplate } from "../src/validate.js"

/** A minimal template that passes, for tests to break one field at a time. */
function template(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: "com.example.MyConnector.v1",
		name: "My connector",
		appliesTo: ["bpmn:ServiceTask"],
		properties: [
			{
				type: "Hidden",
				value: "com.example:my-connector:1",
				binding: { type: "zeebe:taskDefinition", property: "type" },
			},
		],
		...overrides,
	}
}

function paths(value: unknown): string[] {
	return validateElementTemplate(value).problems.map((p) => p.path)
}

describe("validateElementTemplate", () => {
	it("accepts a minimal template", () => {
		expect(validateElementTemplate(template())).toEqual({
			valid: true,
			problems: [],
			warnings: [],
		})
	})

	it("accepts every template in the bundled catalogue", () => {
		// The bundle is generated; if the validator rejects it, one of the two is
		// wrong and this is where that shows up rather than in a user's project.
		const rejected = CAMUNDA_CONNECTOR_TEMPLATES.filter(
			(t) => !validateElementTemplate(t).valid,
		).map((t) => ({ id: t.id, problems: validateElementTemplate(t).problems }))
		expect(rejected).toEqual([])
	})

	it("rejects a non-object", () => {
		expect(validateElementTemplate("nope").valid).toBe(false)
		expect(validateElementTemplate(null).valid).toBe(false)
		expect(validateElementTemplate([]).valid).toBe(false)
	})

	it("requires id, name, appliesTo and properties", () => {
		expect(paths({})).toEqual(["id", "name", "appliesTo", "properties"])
	})

	it("rejects an empty or non-bpmn appliesTo entry", () => {
		expect(paths(template({ appliesTo: [] }))).toContain("appliesTo")
		expect(paths(template({ appliesTo: ["ServiceTask"] }))).toContain("appliesTo[0]")
	})

	it("rejects a non-integer version", () => {
		expect(paths(template({ version: 1.5 }))).toContain("version")
		expect(validateElementTemplate(template({ version: 2 })).valid).toBe(true)
	})

	it("rejects an unknown property type", () => {
		const value = template({
			properties: [{ type: "Slider", binding: { type: "zeebe:input", name: "x" } }],
		})
		expect(paths(value)).toContain("properties[0].type")
	})

	it("allows an omitted property type, which means String", () => {
		const value = template({ properties: [{ binding: { type: "zeebe:input", name: "x" } }] })
		expect(validateElementTemplate(value).valid).toBe(true)
	})

	it("requires a binding", () => {
		expect(paths(template({ properties: [{ type: "String" }] }))).toContain("properties[0].binding")
	})

	it("rejects an unknown binding type", () => {
		const value = template({ properties: [{ binding: { type: "zeebe:nonsense", name: "x" } }] })
		const problem = validateElementTemplate(value).problems[0]
		expect(problem?.path).toBe("properties[0].binding.type")
		expect(problem?.message).toContain("unknown binding type")
	})

	it("requires the field each binding type needs", () => {
		expect(paths(template({ properties: [{ binding: { type: "zeebe:input" } }] }))).toContain(
			"properties[0].binding.name",
		)
		expect(paths(template({ properties: [{ binding: { type: "zeebe:output" } }] }))).toContain(
			"properties[0].binding.source",
		)
		expect(paths(template({ properties: [{ binding: { type: "zeebe:taskHeader" } }] }))).toContain(
			"properties[0].binding.key",
		)
	})

	it("accepts a binding that needs nothing beyond its type", () => {
		const value = template({
			properties: [{ type: "Hidden", value: "x", binding: { type: "zeebe:taskDefinition:type" } }],
		})
		expect(validateElementTemplate(value).valid).toBe(true)
	})

	it("rejects an out-of-range taskDefinition property", () => {
		const value = template({
			properties: [{ binding: { type: "zeebe:taskDefinition", property: "timeout" } }],
		})
		expect(paths(value)).toContain("properties[0].binding.property")
	})

	it("requires choices on a Dropdown", () => {
		const value = template({
			properties: [{ type: "Dropdown", binding: { type: "zeebe:input", name: "x" } }],
		})
		expect(paths(value)).toContain("properties[0].choices")
	})

	it("rejects an invalid feel mode", () => {
		const value = template({
			properties: [{ feel: "sometimes", binding: { type: "zeebe:input", name: "x" } }],
		})
		expect(paths(value)).toContain("properties[0].feel")
	})

	it("accepts properties that share an id under different conditions", () => {
		// The Camunda pattern for one logical field with per-resource variants —
		// HubSpot.v1 has four properties all keyed "operationId".
		const value = template({
			properties: [
				{
					id: "op",
					condition: { property: "kind", oneOf: ["a"] },
					binding: { type: "zeebe:input", name: "op" },
				},
				{
					id: "op",
					condition: { property: "kind", oneOf: ["b"] },
					binding: { type: "zeebe:input", name: "op" },
				},
			],
		})
		expect(validateElementTemplate(value).valid).toBe(true)
	})

	it("warns about a valid binding this toolkit does not apply", () => {
		const value = template({
			properties: [{ binding: { type: "bpmn:Message#property", name: "name" } }],
		})
		const result = validateElementTemplate(value)
		expect(result.valid).toBe(true)
		expect(result.warnings[0]?.path).toBe("properties[0].binding.type")
		expect(result.warnings[0]?.message).toContain("not applied by this toolkit yet")
	})

	it("does not warn about a binding it does apply", () => {
		expect(validateElementTemplate(template()).warnings).toEqual([])
	})

	it("reports every problem at once rather than only the first", () => {
		const value = { id: "", name: "", appliesTo: [], properties: "no" }
		expect(validateElementTemplate(value).problems.length).toBeGreaterThanOrEqual(4)
	})
})

describe("readTemplateDocument", () => {
	it("reads a single template", () => {
		const { templates, problems } = readTemplateDocument(template())
		expect(templates).toHaveLength(1)
		expect(problems).toEqual([])
	})

	it("reads an array of templates", () => {
		const { templates } = readTemplateDocument([template({ id: "a" }), template({ id: "b" })])
		expect(templates.map((t) => t.id)).toEqual(["a", "b"])
	})

	it("keeps the good templates when one in the file is bad", () => {
		const { templates, problems } = readTemplateDocument([
			template({ id: "good" }),
			template({ id: "bad", appliesTo: [] }),
		])
		expect(templates.map((t) => t.id)).toEqual(["good"])
		expect(problems[0]).toMatchObject({ index: 1, id: "bad", path: "appliesTo" })
	})

	it("names the offending template by id when it has one", () => {
		const { problems } = readTemplateDocument(template({ properties: "no" }))
		expect(problems[0]?.id).toBe("com.example.MyConnector.v1")
	})
})
