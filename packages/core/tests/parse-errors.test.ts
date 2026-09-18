import { describe, expect, it } from "vitest"
import { Bpmn, Dmn, Form } from "../src/index.js"
import { BpmnSdkError, ParseError } from "../src/index.js"

/**
 * `ParseError` is the documented way to handle a bad file.
 *
 * `errors.ts` tells callers to write `catch (err) { if (err instanceof ParseError) … }`,
 * and for most of the life of this package that check was `false`: the three parsers
 * threw a bare `Error` in 35 of their 36 throw sites, so the only branch the
 * documentation offered never ran. Nothing failed loudly — a bare `Error` is still
 * caught by `catch` — which is exactly why it survived.
 *
 * These lock the contract down per parser and per failure shape, because the
 * regression is silent: swapping one `ParseError` back to `Error` breaks no other
 * test in this repo.
 */
describe("parse failures are ParseError", () => {
	const ROOT = '<?xml version="1.0"?>'

	describe("Bpmn.parse", () => {
		it("rejects a document with no root element", () => {
			expect(() => Bpmn.parse("")).toThrow(ParseError)
		})

		it("rejects a non-<definitions> root", () => {
			expect(() => Bpmn.parse(`${ROOT}<nonsense/>`)).toThrow(ParseError)
		})

		it("rejects a missing required attribute", () => {
			const xml = `${ROOT}<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"/>`
			expect(() => Bpmn.parse(xml)).toThrow(ParseError)
		})
	})

	describe("Dmn.parse", () => {
		it("rejects a non-<definitions> root", () => {
			expect(() => Dmn.parse(`${ROOT}<nonsense/>`)).toThrow(ParseError)
		})
	})

	describe("Form.parse", () => {
		it("rejects malformed JSON", () => {
			expect(() => Form.parse("{ not json")).toThrow(ParseError)
		})

		it("rejects JSON that is not an object", () => {
			expect(() => Form.parse("[]")).toThrow(ParseError)
		})

		it("rejects a form with no id", () => {
			expect(() => Form.parse('{ "type": "default", "components": [] }')).toThrow(ParseError)
		})
	})

	it("stays catchable as an Error and as the package's base error", () => {
		// The fix has to be additive: code that only ever caught `Error` keeps working.
		try {
			Bpmn.parse(`${ROOT}<nonsense/>`)
			expect.unreachable("expected a throw")
		} catch (err) {
			expect(err).toBeInstanceOf(Error)
			expect(err).toBeInstanceOf(BpmnSdkError)
			expect(err).toBeInstanceOf(ParseError)
			expect((err as ParseError).code).toBe("parse-error")
			expect((err as ParseError).name).toBe("ParseError")
		}
	})
})
