import { describe, expect, it } from "vitest"
import { tokenize } from "../src/lexer.js"
import type { FeelTokenKind } from "../src/lexer.js"

function kinds(input: string): FeelTokenKind[] {
	return tokenize(input).map((t) => t.kind)
}

function values(input: string): string[] {
	return tokenize(input).map((t) => t.value)
}

describe("tokenize", () => {
	it("tokenizes numbers", () => {
		expect(kinds("42")).toEqual(["number"])
		expect(kinds("3.14")).toEqual(["number"])
	})

	it("tokenizes string literals", () => {
		expect(kinds('"hello"')).toEqual(["string"])
		expect(values('"hello"')).toEqual(['"hello"'])
		expect(values('"a\\"b"')).toEqual(['"a\\"b"'])
	})

	it("tokenizes temporal literals", () => {
		const toks = tokenize('@"2021-01-01"')
		expect(toks[0]?.kind).toBe("temporal")
		expect(toks[0]?.value).toBe('@"2021-01-01"')
	})

	it("tokenizes backtick names", () => {
		const toks = tokenize("`First Name`")
		expect(toks[0]?.kind).toBe("backtick")
		expect(toks[0]?.value).toBe("First Name")
	})

	it("tokenizes keywords", () => {
		expect(kinds("true")).toEqual(["keyword"])
		expect(kinds("false")).toEqual(["keyword"])
		expect(kinds("null")).toEqual(["keyword"])
		expect(kinds("if")).toEqual(["keyword"])
		expect(kinds("and")).toEqual(["keyword"])
	})

	it("tokenizes names", () => {
		expect(kinds("foo")).toEqual(["name"])
		expect(kinds("myVar")).toEqual(["name"])
	})

	it("tokenizes operators", () => {
		expect(kinds("**")).toEqual(["op"])
		expect(kinds("..")).toEqual(["op"])
		expect(kinds(">=")).toEqual(["op"])
		expect(kinds("<=")).toEqual(["op"])
		expect(kinds("!=")).toEqual(["op"])
		expect(kinds("->")).toEqual(["op"])
		expect(kinds("+")).toEqual(["op"])
		expect(kinds("-")).toEqual(["op"])
		expect(kinds("*")).toEqual(["op"])
		expect(kinds("/")).toEqual(["op"])
	})

	it("prioritizes ** over *", () => {
		const toks = tokenize("2**3")
		expect(toks.map((t) => t.value)).toEqual(["2", "**", "3"])
	})

	it("prioritizes .. over .", () => {
		const toks = tokenize("1..5")
		expect(toks.map((t) => t.value)).toEqual(["1", "..", "5"])
	})

	it("tokenizes punctuation", () => {
		expect(kinds("(")).toEqual(["punct"])
		expect(kinds(")")).toEqual(["punct"])
		expect(kinds("[")).toEqual(["punct"])
		expect(kinds("]")).toEqual(["punct"])
		expect(kinds("{")).toEqual(["punct"])
		expect(kinds("}")).toEqual(["punct"])
		expect(kinds(",")).toEqual(["punct"])
		expect(kinds(":")).toEqual(["punct"])
	})

	it("tokenizes line comments", () => {
		const toks = tokenize("x // comment\ny")
		const commentTok = toks.find((t) => t.kind === "comment")
		expect(commentTok?.value).toBe("// comment")
	})

	it("tokenizes block comments", () => {
		const toks = tokenize("x /* block */ y")
		const commentTok = toks.find((t) => t.kind === "comment")
		expect(commentTok?.value).toBe("/* block */")
	})

	it("includes whitespace tokens", () => {
		const toks = tokenize("a b")
		expect(toks[1]?.kind).toBe("whitespace")
	})

	it("tracks positions", () => {
		const toks = tokenize("42 + 3")
		expect(toks[0]?.start).toBe(0)
		expect(toks[0]?.end).toBe(2)
		expect(toks[2]?.start).toBe(3)
		expect(toks[2]?.end).toBe(4)
	})

	it("handles empty input", () => {
		expect(tokenize("")).toEqual([])
	})

	it("tokenizes question mark", () => {
		expect(kinds("?")).toEqual(["op"])
	})
})
