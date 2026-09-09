import { describe, expect, it } from "vitest"
import type { Uri } from "vscode"
import { pairFromCommandArgs, uriFromCommandArg } from "../src/host/command-args.js"

/** Enough of a `Uri` for a structural check; the real one has far more on it. */
const uri = (path: string): Uri => ({ scheme: "file", path }) as Uri

describe("uriFromCommandArg", () => {
	it("takes a Uri as it is — the editor title and Explorer both pass one", () => {
		expect(uriFromCommandArg(uri("/w/order.bpmn"))?.path).toBe("/w/order.bpmn")
	})

	it("unwraps a Source Control resource state", () => {
		// The SCM panel passes the resource *state*, not its Uri. Missing this is
		// how a command ends up working everywhere except Source Control.
		const state = { resourceUri: uri("/w/order.bpmn"), decorations: {} }
		expect(uriFromCommandArg(state)?.path).toBe("/w/order.bpmn")
	})

	it("returns null for a command invoked from the palette with no argument", () => {
		expect(uriFromCommandArg(undefined)).toBeNull()
		expect(uriFromCommandArg(null)).toBeNull()
	})

	it("rejects an object that is not a Uri and does not hold one", () => {
		expect(uriFromCommandArg({ path: 7 })).toBeNull()
		expect(uriFromCommandArg({ resourceUri: "not a uri" })).toBeNull()
		expect(uriFromCommandArg("string")).toBeNull()
	})
})

describe("pairFromCommandArgs", () => {
	const a = uri("/w/before.bpmn")
	const b = uri("/w/after.bpmn")

	it("reads the selection VS Code passes after the clicked item", () => {
		expect(pairFromCommandArgs([a, [a, b]])?.map((u) => u.path)).toEqual([
			"/w/before.bpmn",
			"/w/after.bpmn",
		])
	})

	it("keeps the Explorer's order, which is the order the user sees", () => {
		expect(pairFromCommandArgs([b, [b, a]])?.map((u) => u.path)).toEqual([
			"/w/after.bpmn",
			"/w/before.bpmn",
		])
	})

	it("refuses a selection that is not exactly two", () => {
		expect(pairFromCommandArgs([a, [a]])).toBeNull()
		expect(pairFromCommandArgs([a, [a, b, uri("/w/third.bpmn")]])).toBeNull()
	})

	it("refuses an invocation with no selection at all", () => {
		expect(pairFromCommandArgs([a])).toBeNull()
		expect(pairFromCommandArgs([])).toBeNull()
	})
})
