/**
 * Sharing a FEEL statement: what is accepted, what is stored, and what the
 * reader's browser will make of it.
 *
 * The evaluation path is tested here rather than only in the browser because it
 * is the whole claim of the feature — a FEEL drop that renders the text but not
 * the value is a paste, not a share.
 */
import { describe, expect, it } from "vitest"
import type { Env } from "../src/env.js"
import { getCurrentBody, insertDrop } from "../src/lib/db.js"
import { demoDrop, demoFileBody } from "../src/lib/demo.js"
import { sha256Hex } from "../src/lib/ids.js"
import { ValidationError, sniffKind, validateFile } from "../src/lib/validate.js"
import { handleUpload } from "../src/routes/upload.js"
import {
	type FeelDocument,
	FeelDocumentError,
	composeFeelDocument,
	feelLabel,
	parseFeelDocument,
	serializeFeelDocument,
} from "../src/shared/feel-doc.js"
import { evaluateFeelDocument } from "../src/shared/feel-eval.js"
import { migratedDb } from "./d1.js"

const DOC = JSON.stringify({
	expression: "order.amount * (1 + vat)",
	context: { order: { amount: 100 }, vat: 0.19 },
	mode: "expression",
})

describe("parseFeelDocument", () => {
	it("reads a bare expression as one with no context", () => {
		const doc = parseFeelDocument("1 + 1")
		expect(doc).toEqual({ expression: "1 + 1", context: {}, mode: "expression" })
	})

	it("reads the JSON document the composer posts", () => {
		const doc = parseFeelDocument(DOC)
		expect(doc.expression).toBe("order.amount * (1 + vat)")
		expect(doc.context).toEqual({ order: { amount: 100 }, vat: 0.19 })
		expect(doc.mode).toBe("expression")
	})

	it("treats a FEEL context literal as an expression, not as malformed JSON", () => {
		// `{ a: 1 }` opens a FEEL context and is not JSON; the leading brace must
		// not turn a valid expression into a complaint about a document shape.
		expect(parseFeelDocument("{ a: 1 }").expression).toBe("{ a: 1 }")
	})

	it("rejects an expression that does not parse", () => {
		expect(() => parseFeelDocument("1 +")).toThrow(FeelDocumentError)
	})

	it("rejects an empty statement", () => {
		expect(() => parseFeelDocument("   ")).toThrow(FeelDocumentError)
	})

	it("rejects a context that is not an object of variables", () => {
		const text = JSON.stringify({ expression: "1", context: [1, 2] })
		expect(() => parseFeelDocument(text)).toThrow(/context/)
	})

	it("rejects an unknown mode", () => {
		const text = JSON.stringify({ expression: "1", mode: "sideways" })
		expect(() => parseFeelDocument(text)).toThrow(/mode/)
	})

	it("parses unary tests in their own mode", () => {
		const text = JSON.stringify({ expression: "[18..65]", mode: "unary-tests" })
		expect(parseFeelDocument(text).mode).toBe("unary-tests")
	})

	it("round-trips through its canonical form", () => {
		const doc = parseFeelDocument(DOC)
		expect(parseFeelDocument(serializeFeelDocument(doc))).toEqual(doc)
	})
})

describe("composeFeelDocument", () => {
	// The composer on /drop and the editor on a share page have the same two
	// boxes, so they share the one function that turns them into a document.
	it("reads the two boxes as a document", () => {
		const state = composeFeelDocument(" 1 + 1 ", '{ "a": 1 }', "expression")
		expect(state).toEqual({
			ok: true,
			doc: { expression: "1 + 1", context: { a: 1 }, mode: "expression" },
		})
	})

	it("treats an empty context box as no variables", () => {
		const state = composeFeelDocument("1", "  ", "unary-tests")
		expect(state).toEqual({ ok: true, doc: { expression: "1", context: {}, mode: "unary-tests" } })
	})

	it("names the box that is wrong, not just the failure", () => {
		expect(composeFeelDocument("1", "{oops", "expression")).toEqual({
			ok: false,
			message: "The context is not valid JSON.",
		})
		expect(composeFeelDocument("1", "[1, 2]", "expression")).toMatchObject({ ok: false })
		expect(composeFeelDocument("  ", "{}", "expression")).toMatchObject({ ok: false })
	})
})

describe("feelLabel", () => {
	it("uses the first line, shortened", () => {
		const doc: FeelDocument = { expression: "a\nb", context: {}, mode: "expression" }
		expect(feelLabel(doc)).toBe("a")
		expect(feelLabel({ ...doc, expression: "x".repeat(80) })).toHaveLength(48)
	})
})

describe("sniffKind", () => {
	it("recognizes .feel by extension and a document by its expression field", () => {
		expect(sniffKind("condition.feel", "1 + 1")).toBe("feel")
		expect(sniffKind("pasted.json", DOC)).toBe("feel")
	})

	it("still prefers a Camunda form when the JSON has components", () => {
		expect(sniffKind("a.json", '{"components":[],"id":"f"}')).toBe("form")
	})
})

describe("validateFile", () => {
	it("stores a bare expression as the document it became", () => {
		const v = validateFile("condition.feel", "1 + 1")
		expect(v.kind).toBe("feel")
		expect(v.name).toBe("1 + 1")
		expect(JSON.parse(v.json)).toEqual({ expression: "1 + 1", context: {}, mode: "expression" })
		// The "Original" download has to be something this parser accepts back.
		expect(v.original).toBe(serializeFeelDocument(JSON.parse(v.json) as FeelDocument))
		expect(v.sizeOriginal).toBe(new TextEncoder().encode(v.original).length)
	})

	it("counts the context variables into the metadata", () => {
		const v = validateFile("order.feel", DOC)
		expect(v.meta).toEqual({ variables: 2, feelMode: "expression" })
	})

	it("rejects an expression that does not parse, naming the file", () => {
		expect(() => validateFile("bad.feel", "1 +")).toThrow(ValidationError)
		expect(() => validateFile("bad.feel", "1 +")).toThrow(/^bad\.feel: /)
	})
})

describe("evaluateFeelDocument", () => {
	it("evaluates an expression against its own context", () => {
		expect(evaluateFeelDocument(parseFeelDocument(DOC))).toEqual({ ok: true, value: "119" })
	})

	it("evaluates unary tests against the ? the context bound", () => {
		const doc = parseFeelDocument(
			JSON.stringify({ expression: "[18..65]", context: { "?": 30 }, mode: "unary-tests" }),
		)
		expect(evaluateFeelDocument(doc)).toEqual({ ok: true, value: "true" })
	})

	it("reports a missing variable as null rather than throwing", () => {
		// FEEL resolves an unbound name to null; a shared statement whose context
		// is incomplete has to say so by its value, not by a blank panel.
		expect(evaluateFeelDocument(parseFeelDocument("nope"))).toEqual({ ok: true, value: "null" })
	})
})

describe("storage", () => {
	it("accepts a FEEL file into the widened kind constraint", async () => {
		const db = migratedDb()
		const v = validateFile("condition.feel", DOC)
		await insertDrop(db, {
			shareId: "share-feel",
			files: [{ ...v, id: "file-feel", hash: "hash-feel" }],
			tosVersion: "test",
			now: 1,
		})
		const row = await db
			.prepare("SELECT kind, name FROM files WHERE id = ?")
			.bind("file-feel")
			.first<{ kind: string; name: string }>()
		expect(row?.kind).toBe("feel")
	})
})

describe("what an upload stores for a statement", () => {
	it("hashes the document it stored, not the bytes that arrived", async () => {
		// A `.feel` upload is kept as the canonical document it became, so the
		// content hash has to be of that. It is what the entity tag names, what the
		// ban list compares, and what the share page's editor sends back as the
		// state its save is made against — all three of which read the stored body.
		const db = migratedDb()
		const body = new FormData()
		body.append("files", new File([DOC], "condition.feel"), "condition.feel")
		const res = await handleUpload(
			new Request("https://bpmnkit.com/drop/api/drops", { method: "POST", body }),
			{ DB: db, TOS_VERSION: "test" } as unknown as Env,
			1,
		)
		const { shareId } = (await res.json()) as { shareId: string }
		const stored = await getCurrentBody(db, shareId, "condition.feel", "original")
		expect(stored?.body).toBe(serializeFeelDocument(parseFeelDocument(DOC)))
		expect(stored?.hash).toBe(await sha256Hex(stored?.body ?? ""))
	})
})

describe("the demo drop", () => {
	it("carries a FEEL statement alongside the diagram", async () => {
		const { files } = await demoDrop()
		const feel = files.find((f) => f.kind === "feel")
		expect(feel?.filename).toBe("approval-condition.feel")

		const body = await demoFileBody("approval-condition.feel", "json")
		const doc = JSON.parse(body?.body ?? "{}") as FeelDocument
		expect(evaluateFeelDocument(doc)).toEqual({ ok: true, value: '"approve"' })
	})
})
