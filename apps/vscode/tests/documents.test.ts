import { describe, expect, it } from "vitest"
import { kindForPath, viewTypeFor } from "../src/host/documents.js"

describe("kindForPath", () => {
	it("recognises the three artifacts", () => {
		expect(kindForPath("/w/order.bpmn")).toBe("bpmn")
		expect(kindForPath("/w/score.dmn")).toBe("dmn")
		expect(kindForPath("/w/approve.form")).toBe("form")
	})

	it("ignores case in the extension", () => {
		expect(kindForPath("/w/Order.BPMN")).toBe("bpmn")
	})

	it("rejects anything else", () => {
		expect(kindForPath("/w/order.xml")).toBeNull()
		expect(kindForPath("/w/README.md")).toBeNull()
		expect(kindForPath("/w/order")).toBeNull()
	})

	it("does not mistake a directory suffix for a file extension", () => {
		expect(kindForPath("/w/models.bpmn/notes.txt")).toBeNull()
	})

	it("handles Windows separators", () => {
		expect(kindForPath("C:\\models\\order.bpmn")).toBe("bpmn")
	})

	it("treats a dotfile as having no extension", () => {
		expect(kindForPath("/w/.bpmn")).toBeNull()
	})
})

describe("viewTypeFor", () => {
	it("matches the view types the manifest contributes", () => {
		expect(viewTypeFor("bpmn")).toBe("bpmnkit.bpmn")
		expect(viewTypeFor("dmn")).toBe("bpmnkit.dmn")
		expect(viewTypeFor("form")).toBe("bpmnkit.form")
	})
})
