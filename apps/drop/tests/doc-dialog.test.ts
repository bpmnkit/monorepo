import { describe, expect, it } from "vitest"
import type { DropRow, FileInfo } from "../src/lib/db.js"
import { sharePage } from "../src/lib/pages.js"

const drop: DropRow = {
	id: "share1",
	file_count: 1,
	size_total: 10,
	tos_version: "v",
	created_at: 0,
	last_viewed_at: 0,
	view_count: 0,
	expires_at: null,
}

const bpmn: FileInfo = {
	id: "f1",
	position: 0,
	kind: "bpmn",
	filename: "order.bpmn",
	name: "Order",
	sizeOriginal: 10,
	sizeJson: 10,
	meta: {},
}

describe("share page documentation export", () => {
	const page = sharePage("share1", drop, [bpmn])

	it("has a Docs button, hidden until the viewer knows the drop has BPMN", () => {
		expect(page).toMatch(/<button id="docBtn" type="button"[^>]*hidden>Docs<\/button>/)
	})

	it("offers each format as a dialog button whose value the viewer reads", () => {
		const values = [...page.matchAll(/<button value="(\w+)" type="submit">/g)].map((m) => m[1])
		expect(values).toEqual(["print", "html", "md", "docx"])
		expect(page).toContain('<dialog id="docDialog">')
	})
})
