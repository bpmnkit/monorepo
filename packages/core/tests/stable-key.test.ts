import { describe, expect, it } from "vitest"
import { compositeKey, stableToken } from "../src/types/stable-key.js"

/** XML NCName: what an id attribute is allowed to be. */
const NC_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/

describe("compositeKey", () => {
	it("joins segments in order", () => {
		expect(compositeKey(["form", "textfield", "name"])).toBe("form:textfield:name")
	})

	it("escapes the separator so segment boundaries cannot be forged", () => {
		expect(compositeKey(["a:b", "c"])).not.toBe(compositeKey(["a", "b:c"]))
	})

	it("escapes the escape character", () => {
		expect(compositeKey(["a\\", "b"])).not.toBe(compositeKey(["a", "\\b"]))
	})
})

describe("stableToken", () => {
	it("returns the same token for the same key", () => {
		const key = ["form", "textfield", "name"]
		expect(stableToken("Field", key)).toBe(stableToken("Field", key))
	})

	it("separates tokens by namespace suffix, so one entity can carry several", () => {
		const key = ["form", "textfield", "name"]
		expect(stableToken("Row", [...key, "row"])).not.toBe(stableToken("Row", key))
	})

	it("separates tokens by prefix", () => {
		const key = ["form", "textfield", "name"]
		expect(stableToken("Field", key)).not.toBe(stableToken("Row", key))
	})

	it("separates different identities", () => {
		expect(stableToken("Field", ["f", "textfield", "a"])).not.toBe(
			stableToken("Field", ["f", "textfield", "b"]),
		)
	})

	it("separates the same identity in different scopes", () => {
		expect(stableToken("Field", ["f1", "textfield", "name"])).not.toBe(
			stableToken("Field", ["f2", "textfield", "name"]),
		)
	})

	it("produces a valid NCName even though a bare digest need not be", () => {
		// A hex digest may lead with a digit; the prefix is what rules that out.
		for (const identity of ["name", "", "a b", "üñî", "9"]) {
			expect(stableToken("Field", ["f", "textfield", identity])).toMatch(NC_NAME)
		}
	})
})
