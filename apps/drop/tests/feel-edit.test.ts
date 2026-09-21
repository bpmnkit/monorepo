// @vitest-environment happy-dom
/**
 * The statement editor on a share page.
 *
 * Its whole claim is a negative one — **typing in these boxes does not touch
 * the drop** — and a negative claim is exactly what a test is for: the editor
 * could evaluate perfectly and still be wrong by having posted something. So
 * the callbacks are spies, and what is asserted is mostly that they were not
 * called.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mountFeelEditor } from "../src/client/feel-edit.js"
import type { FeelDocument } from "../src/shared/feel-doc.js"

const DOC: FeelDocument = {
	expression: "amount > limit",
	context: { amount: 90, limit: 50 },
	mode: "expression",
}

let container: HTMLElement
let save: ReturnType<typeof vi.fn>
let shareCopy: ReturnType<typeof vi.fn>

function mount(readOnly: string | null = null) {
	return mountFeelEditor({
		container,
		doc: DOC,
		filename: "condition.feel",
		readOnly,
		save,
		shareCopy,
	})
}

const box = (label: string): HTMLTextAreaElement =>
	container.querySelector<HTMLTextAreaElement>(
		`textarea[aria-label="${label}"]`,
	) as HTMLTextAreaElement

const press = (text: string): HTMLButtonElement =>
	[...container.querySelectorAll("button")].find((b) => b.textContent === text) as HTMLButtonElement

function type(area: HTMLTextAreaElement, value: string): void {
	area.value = value
	area.dispatchEvent(new Event("input"))
}

const result = () => container.querySelector(".feel-result")?.textContent

beforeEach(() => {
	container = document.createElement("div")
	document.body.replaceChildren(container)
	save = vi.fn().mockResolvedValue(undefined)
	shareCopy = vi.fn().mockResolvedValue(undefined)
})

describe("playing with somebody else's statement", () => {
	it("opens on what the drop says, and evaluates it", () => {
		mount()
		expect(box("FEEL expression").value).toBe(DOC.expression)
		expect(JSON.parse(box("Context").value)).toEqual(DOC.context)
		expect(result()).toBe("true")
	})

	it("re-evaluates as you type, and sends nothing anywhere", () => {
		const editor = mount()
		type(box("Context"), '{ "amount": 10, "limit": 50 }')
		expect(result()).toBe("false")
		expect(editor.dirty()).toBe(true)
		expect(save).not.toHaveBeenCalled()
		expect(shareCopy).not.toHaveBeenCalled()
	})

	it("puts the drop's own statement back on Reset", () => {
		const editor = mount()
		type(box("FEEL expression"), "amount < limit")
		expect(editor.dirty()).toBe(true)
		press("Reset").click()
		expect(box("FEEL expression").value).toBe(DOC.expression)
		expect(editor.dirty()).toBe(false)
		expect(save).not.toHaveBeenCalled()
	})

	it("says what is wrong with the boxes rather than offering to save them", () => {
		mount()
		type(box("Context"), "{oops")
		expect(result()).toBe("The context is not valid JSON.")
		expect(press("Save to this drop").disabled).toBe(true)

		type(box("Context"), "{}")
		type(box("FEEL expression"), "1 +")
		expect(press("Save to this drop").disabled).toBe(true)
	})
})

describe("saving", () => {
	it("is offered only once the boxes differ from the drop", () => {
		mount()
		expect(press("Save to this drop").disabled).toBe(true)
		type(box("Context"), '{ "amount": 10, "limit": 50 }')
		expect(press("Save to this drop").disabled).toBe(false)
	})

	it("hands over the composed document, and the boxes become the new baseline", async () => {
		const editor = mount()
		type(box("Context"), '{ "amount": 10, "limit": 50 }')
		press("Save to this drop").click()
		await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))

		expect(save.mock.calls[0]?.[0]).toEqual({
			expression: "amount > limit",
			context: { amount: 10, limit: 50 },
			mode: "expression",
		})
		await vi.waitFor(() => expect(editor.dirty()).toBe(false))
	})

	it("shows what went wrong and leaves the boxes as they were", async () => {
		save.mockRejectedValue(new Error("this drop changed while you were editing"))
		const editor = mount()
		type(box("FEEL expression"), "amount >= limit")
		press("Save to this drop").click()

		await vi.waitFor(() =>
			expect(container.querySelector(".fe-status")?.textContent).toBe(
				"this drop changed while you were editing",
			),
		)
		expect(editor.dirty()).toBe(true)
		expect(box("FEEL expression").value).toBe("amount >= limit")
	})

	it("is refused on a drop nobody may rewrite — but the copy is still offered", async () => {
		mount("This drop is pinned by an operator and is read-only.")
		type(box("FEEL expression"), "amount >= limit")
		expect(press("Save to this drop").disabled).toBe(true)
		expect(press("Save to this drop").title).toMatch(/pinned/)

		press("Share as new").click()
		await vi.waitFor(() => expect(shareCopy).toHaveBeenCalledTimes(1))
	})
})
