// @vitest-environment happy-dom
/**
 * The "Docs" export on a share page: what a reader of a drop gets from each
 * format, built from the drop's BPMN, DMN and form files.
 */
import { Dmn, Form } from "@bpmnkit/core"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
	DOC_FORMATS,
	type DocSources,
	buildDropDocument,
	deliverDocument,
	isDocFormat,
} from "../src/client/doc-export.js"
import { SAMPLE_DMN_XML, SAMPLE_FORM_JSON, SIMPLE_BPMN } from "./fixtures.js"

// The viewer hands the module the stored JSON models; a JSON round trip mirrors that.
const sources = (): DocSources => ({
	filename: "order.bpmn",
	xml: SIMPLE_BPMN,
	decisions: [JSON.parse(JSON.stringify(Dmn.parse(SAMPLE_DMN_XML)))],
	forms: [JSON.parse(JSON.stringify(Form.parse(SAMPLE_FORM_JSON)))],
})

afterEach(() => vi.restoreAllMocks())

describe("buildDropDocument", () => {
	it("names each format after the BPMN file", () => {
		const names = DOC_FORMATS.map((f) => buildDropDocument(sources(), f).name)
		expect(names).toEqual([
			"order-documentation.html",
			"order-documentation.html",
			"order-documentation.md",
			"order-documentation.docx",
		])
	})

	it("documents the steps, the drop's decisions and its forms", async () => {
		const html = await buildDropDocument(sources(), "html").blob.text()
		expect(html).toContain("Do Work")
		expect(html).toContain("Determine Price")
		expect(html).toContain("Form_registration")
		expect(html).toContain("<svg")
		const md = await buildDropDocument(sources(), "md").blob.text()
		expect(md).toContain("## Decisions")
		expect(md).not.toContain("<svg")
	})

	it("only accepts the formats the dialog offers", () => {
		expect(DOC_FORMATS.every(isDocFormat)).toBe(true)
		expect(isDocFormat("cancel")).toBe(false)
		expect(isDocFormat("")).toBe(false)
	})
})

describe("deliverDocument", () => {
	function spyDownloads(): string[] {
		const names: string[] = []
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:doc")
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
			this: HTMLAnchorElement,
		) {
			names.push(this.download)
		})
		return names
	}

	it("opens the print view in a new tab", () => {
		const names = spyDownloads()
		const open = vi.spyOn(window, "open").mockReturnValue({} as Window)
		deliverDocument(buildDropDocument(sources(), "print"), "print")
		expect(open).toHaveBeenCalledWith("blob:doc", "_blank")
		expect(names).toEqual([])
	})

	it("downloads the print view when the pop-up is blocked, and every other format", () => {
		const names = spyDownloads()
		vi.spyOn(window, "open").mockReturnValue(null)
		deliverDocument(buildDropDocument(sources(), "print"), "print")
		deliverDocument(buildDropDocument(sources(), "md"), "md")
		expect(names).toEqual(["order-documentation.html", "order-documentation.md"])
	})
})
