import { describe, expect, it } from "vitest"
import { ValidationError, sanitizeFilename, sniffKind, validateFile } from "../src/lib/validate.js"
import { MAX_FILE_BYTES } from "../src/shared/constants.js"
import { SAMPLE_BPMN_XML, SAMPLE_DMN_XML, SAMPLE_FORM_JSON } from "./fixtures.js"

describe("sniffKind", () => {
	it("uses the extension when it is decisive", () => {
		expect(sniffKind("a.bpmn", "<xml/>")).toBe("bpmn")
		expect(sniffKind("a.dmn", "<xml/>")).toBe("dmn")
		expect(sniffKind("a.form", "{}")).toBe("form")
	})

	it("sniffs .xml by namespace and root element", () => {
		expect(sniffKind("a.xml", SAMPLE_BPMN_XML)).toBe("bpmn")
		expect(sniffKind("a.xml", SAMPLE_DMN_XML)).toBe("dmn")
	})

	it("sniffs .json Camunda forms by their components array", () => {
		expect(sniffKind("a.json", SAMPLE_FORM_JSON)).toBe("form")
		expect(sniffKind("a.json", '{"foo":1}')).toBeNull()
	})

	it("returns null for unrecognized content", () => {
		expect(sniffKind("notes.txt", "just some text")).toBeNull()
	})
})

describe("sanitizeFilename", () => {
	it("strips paths and neutralizes unsafe characters", () => {
		expect(sanitizeFilename("../../etc/passwd")).toBe("passwd")
		expect(sanitizeFilename("a b<c>.bpmn")).toBe("a b_c_.bpmn")
		expect(sanitizeFilename("")).toBe("file")
	})
})

describe("validateFile", () => {
	it("accepts and converts a BPMN file", () => {
		const v = validateFile("order.bpmn", SAMPLE_BPMN_XML)
		expect(v.kind).toBe("bpmn")
		expect(v.name).toBeTruthy()
		expect(JSON.parse(v.json).processes).toBeInstanceOf(Array)
		expect(v.meta.elements).toBeGreaterThan(0)
	})

	it("accepts and converts a DMN file", () => {
		const v = validateFile("pricing.dmn", SAMPLE_DMN_XML)
		expect(v.kind).toBe("dmn")
		expect(v.name).toBe("Pricing")
		expect(v.meta.decisions).toBe(1)
	})

	it("accepts and converts a Form file", () => {
		const v = validateFile("reg.form", SAMPLE_FORM_JSON)
		expect(v.kind).toBe("form")
		expect(v.name).toBe("Form_registration")
		expect(v.meta.components).toBe(2)
	})

	it("rejects an empty file", () => {
		expect(() => validateFile("a.bpmn", "")).toThrow(ValidationError)
	})

	it("rejects an oversized file with status 413", () => {
		const big = `<?xml version="1.0"?><x>${"a".repeat(MAX_FILE_BYTES)}</x>`
		try {
			validateFile("a.xml", big)
			expect.unreachable("should have thrown")
		} catch (err) {
			expect(err).toBeInstanceOf(ValidationError)
			expect((err as ValidationError).status).toBe(413)
		}
	})

	it("rejects unrecognized content with status 400", () => {
		try {
			validateFile("notes.txt", "hello world")
			expect.unreachable("should have thrown")
		} catch (err) {
			expect((err as ValidationError).status).toBe(400)
		}
	})

	it("rejects malformed BPMN with a filename-prefixed message", () => {
		expect(() => validateFile("bad.bpmn", "<bpmn:definitions>oops")).toThrow(/bad\.bpmn:/)
	})
})
