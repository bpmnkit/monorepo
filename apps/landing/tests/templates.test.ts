import { describe, expect, it } from "vitest"
import { TEMPLATE_VIEWS } from "../src/data/templates.js"
import { templateBpmnPath } from "../src/scripts/template-handoff.js"

describe("template gallery pages", () => {
	it("hands every template to the editor at the path its page serves the .bpmn", () => {
		for (const view of TEMPLATE_VIEWS) {
			const id = new URL(view.editorHref, "https://bpmnkit.com").searchParams.get("template")
			expect(id).toBe(view.template.id)
			expect(templateBpmnPath(view.template.id)).toBe(view.bpmnHref)
			expect(view.files.map((f) => view.fileHref(f.path))).toContain(view.bpmnHref)
		}
	})

	it("refuses anything but a template slug", () => {
		for (const bad of [
			"../index",
			"a/b",
			"https://evil.example",
			"//evil.example/x",
			"Order",
			"",
			"a--b",
		]) {
			expect(templateBpmnPath(bad), bad).toBeNull()
		}
	})

	it("renders a diagram for every template", () => {
		for (const view of TEMPLATE_VIEWS) {
			expect(view.svg.startsWith("<svg"), view.template.id).toBe(true)
			expect(view.jobTypes.length, view.template.id).toBeGreaterThan(0)
		}
	})
})
