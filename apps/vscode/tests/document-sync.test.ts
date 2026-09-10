import { describe, expect, it } from "vitest"
import { DocumentSync } from "../src/host/document-sync.js"

describe("DocumentSync", () => {
	it("writes a change the webview made", () => {
		const sync = new DocumentSync("<a/>")
		expect(sync.fromWebview("<b/>", "<a/>")).toBe(true)
	})

	it("ignores the change event its own write produces", () => {
		// The write lands, the document fires a change, and the change is us.
		// Rebuilding the webview here is what makes the loop.
		const sync = new DocumentSync("<a/>")
		sync.fromWebview("<b/>", "<a/>")
		expect(sync.fromDocument("<b/>")).toBe(false)
	})

	it("rebuilds when the document changed from somewhere else", () => {
		const sync = new DocumentSync("<a/>")
		expect(sync.fromDocument("<typed-by-hand/>")).toBe(true)
	})

	it("does not write text the document already holds", () => {
		// A visual editor re-serialises on every command; one that changed
		// nothing must not mark the file dirty.
		const sync = new DocumentSync("<a/>")
		expect(sync.fromWebview("<a/>", "<a/>")).toBe(false)
	})

	it("treats a revert as foreign, even back to text it once wrote", () => {
		const sync = new DocumentSync("<a/>")
		sync.fromWebview("<b/>", "<a/>")
		sync.fromDocument("<b/>")
		expect(sync.fromDocument("<a/>")).toBe(true)
	})

	it("does not echo twice after a foreign change", () => {
		const sync = new DocumentSync("<a/>")
		expect(sync.fromDocument("<c/>")).toBe(true)
		expect(sync.fromDocument("<c/>")).toBe(false)
	})

	it("survives the two sides changing in turn, without a loop", () => {
		const sync = new DocumentSync("v0")
		// Webview edit → write → echo.
		expect(sync.fromWebview("v1", "v0")).toBe(true)
		expect(sync.fromDocument("v1")).toBe(false)
		// Hand edit → rebuild → the rebuilt view agrees, so nothing is written.
		expect(sync.fromDocument("v2")).toBe(true)
		expect(sync.fromWebview("v2", "v2")).toBe(false)
		// And another webview edit still goes through.
		expect(sync.fromWebview("v3", "v2")).toBe(true)
	})
})
