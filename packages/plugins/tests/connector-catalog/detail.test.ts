import type { ElementTemplate } from "@bpmnkit/connectors"
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest"
import { CatalogPanel } from "../../src/connector-catalog/panel.js"

const TEMPLATE: ElementTemplate = {
	id: "io.example.Notify.v1",
	name: "Notify",
	version: 3,
	description: "Sends a notification",
	appliesTo: ["bpmn:ServiceTask"],
	elementType: { value: "bpmn:ServiceTask" },
	documentationRef: "https://example.com/notify",
	properties: [
		{
			type: "Hidden",
			value: "io.example:notify:1",
			binding: { type: "zeebe:taskDefinition", property: "type" },
		},
		{
			label: "API token",
			type: "String",
			binding: { type: "zeebe:input", name: "token" },
			constraints: { notEmpty: true },
		},
		{
			label: "Message",
			type: "Text",
			feel: "optional",
			binding: { type: "zeebe:input", name: "message" },
			constraints: { notEmpty: true },
		},
		{
			label: "Retries",
			type: "String",
			value: "3",
			binding: { type: "zeebe:taskDefinition", property: "retries" },
		},
	],
}

function open(overrides: Partial<Parameters<typeof panelOptions>[0]> = {}): {
	applied: ElementTemplate[]
	panel: CatalogPanel
} {
	const applied: ElementTemplate[] = []
	const panel = new CatalogPanel(panelOptions({ applied, ...overrides }))
	panel.open()
	return { applied, panel }
}

function panelOptions(o: {
	applied: ElementTemplate[]
	templates?: ElementTemplate[]
}): ConstructorParameters<typeof CatalogPanel>[0] {
	return {
		builtinTemplates: o.templates ?? [TEMPLATE],
		catalogEntries: [],
		onUseBuiltin: (t) => o.applied.push(t),
		onLoadCatalogEntry: () => {},
		onLoadFromUrl: () => {},
		onLoadFromFile: () => {},
	}
}

const q = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector)
const text = (selector: string): string => q(selector)?.textContent ?? ""

beforeEach(() => {
	document.body.replaceChildren()
})

describe("catalog detail view", () => {
	it("shows the detail instead of applying when the card is clicked", () => {
		// Applying rewrites an element's extensions. Doing that on the first
		// click means choosing blind.
		const { applied } = open()
		q<HTMLElement>(".bpmnkit-cc-card")?.click()
		expect(applied).toEqual([])
		expect(text(".bpmnkit-cc-detail__name")).toBe("Notify")
	})

	it("still applies straight away from the card's own button", () => {
		const { applied } = open()
		q<HTMLElement>(".bpmnkit-cc-card__use")?.click()
		expect(applied).toEqual([TEMPLATE])
	})

	it("names the implementation the template binds", () => {
		open()
		q<HTMLElement>(".bpmnkit-cc-card")?.click()
		expect(text(".bpmnkit-cc-detail__binding")).toContain("io.example:notify:1")
		expect(text(".bpmnkit-cc-detail__binding")).toContain("bpmn:ServiceTask")
	})

	it("previews the properties it will ask for", () => {
		open()
		q<HTMLElement>(".bpmnkit-cc-card")?.click()
		const detail = text(".bpmnkit-cc-detail")
		expect(detail).toContain("API token")
		expect(detail).toContain("Message")
		expect(detail).toContain("Required inputs")
	})

	it("marks a field whose name reads like a credential", () => {
		open()
		q<HTMLElement>(".bpmnkit-cc-card")?.click()
		const token = [...document.querySelectorAll(".bpmnkit-cc-field")].find((f) =>
			f.textContent?.includes("API token"),
		)
		expect(token?.querySelector(".bpmnkit-cc-field__secret")).not.toBeNull()
	})

	it("does not hide the Hidden properties as inputs", () => {
		// A hidden property is set without asking; listing it as an input would
		// promise a question that never comes.
		open()
		q<HTMLElement>(".bpmnkit-cc-card")?.click()
		const fields = [...document.querySelectorAll(".bpmnkit-cc-field__name")].map(
			(f) => f.textContent,
		)
		expect(fields).not.toContain("io.example:notify:1")
	})

	it("applies from the detail view", () => {
		const { applied } = open()
		q<HTMLElement>(".bpmnkit-cc-card")?.click()
		q<HTMLElement>(".bpmnkit-cc-detail__apply")?.click()
		expect(applied).toEqual([TEMPLATE])
	})

	it("goes back to the grid without applying", () => {
		const { applied } = open()
		q<HTMLElement>(".bpmnkit-cc-card")?.click()
		q<HTMLElement>(".bpmnkit-cc-detail__back")?.click()
		expect(applied).toEqual([])
		expect(q(".bpmnkit-cc-detail")).toBeNull()
		expect(q(".bpmnkit-cc-card")).not.toBeNull()
	})

	it("reopens on the grid, not on the last thing inspected", () => {
		const { panel } = open()
		q<HTMLElement>(".bpmnkit-cc-card")?.click()
		panel.close()
		panel.open()
		expect(q(".bpmnkit-cc-detail")).toBeNull()
		expect(q(".bpmnkit-cc-card")).not.toBeNull()
	})

	it("says so when a template asks for nothing", () => {
		const bare: ElementTemplate = {
			id: "io.example.Bare.v1",
			name: "Bare",
			appliesTo: ["bpmn:Task"],
			properties: [
				{
					type: "Hidden",
					value: "io.example:bare:1",
					binding: { type: "zeebe:taskDefinition", property: "type" },
				},
			],
		}
		open({ templates: [bare] })
		q<HTMLElement>(".bpmnkit-cc-card")?.click()
		expect(text(".bpmnkit-cc-detail")).toContain("asks for nothing")
	})
})
