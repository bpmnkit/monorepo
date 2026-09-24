// @vitest-environment happy-dom
/**
 * The comments panel on a share page: how a comment reads, where its marker
 * goes, what happens to one whose element is gone, and who gets told about a
 * mention.
 */
import type { BpmnCanvas } from "@bpmnkit/canvas"
import { Bpmn } from "@bpmnkit/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	CommentsPanel,
	anchorState,
	drawnIds,
	mentionAt,
	mentionsIn,
	renderBody,
	suggestNames,
	threadsFor,
} from "../src/client/comments.js"
import { AUTHOR_STORAGE_KEY, type CommentView, authorIdFromToken } from "../src/shared/comments.js"
import { SIMPLE_BPMN } from "./fixtures.js"

function comment(over: Partial<CommentView>): CommentView {
	return {
		id: "Abc123def456",
		filename: "order.bpmn",
		elementId: null,
		elementLabel: null,
		parentId: null,
		authorName: "Anna",
		authorId: "aaaaaaaaaaaaaaaa",
		body: "text",
		mentions: [],
		createdAt: 1,
		editedAt: null,
		deletedAt: null,
		resolvedAt: null,
		resolvedBy: null,
		...over,
	}
}

describe("a comment body", () => {
	it("marks confirmed mentions, longest name first", () => {
		const box = document.createElement("div")
		box.append(renderBody("cc @Anna Lee and @ben, not @Carl", ["Anna", "Anna Lee", "Ben"]))
		const spans = [...box.querySelectorAll(".cm-mention")].map((s) => s.textContent)
		expect(spans).toEqual(["@Anna Lee", "@ben"])
		expect(box.textContent).toBe("cc @Anna Lee and @ben, not @Carl")
	})

	it("never reads the text as markup", () => {
		const box = document.createElement("div")
		box.append(renderBody(`<img src=x onerror="alert(1)"> @Ben`, ["Ben"]))
		expect(box.querySelector("img")).toBeNull()
		expect(box.textContent).toContain("<img")
	})
})

describe("completing a mention", () => {
	it("finds the name being typed at the caret", () => {
		expect(mentionAt("hi @An", 6)).toEqual({ start: 3, query: "An" })
		expect(mentionAt("@", 1)).toEqual({ start: 0, query: "" })
		expect(mentionAt("hi @Anna Lee", 12)).toEqual({ start: 3, query: "Anna Lee" })
	})

	it("does not mistake an address or a finished line for a mention", () => {
		expect(mentionAt("mail anna@example.com", 21)).toBeNull()
		expect(mentionAt("@Anna\nnext", 10)).toBeNull()
		expect(mentionAt("no at here", 10)).toBeNull()
	})

	it("suggests matching names, never your own, at most six", () => {
		const names = ["Ben", "anna", "Anna", "Annika", "Carl", "Me"]
		expect(suggestNames(names, "an", "Me")).toEqual(["anna", "Annika"])
		expect(suggestNames(names, "", "Me")).toEqual(["anna", "Annika", "Ben", "Carl"])
		expect(
			suggestNames(
				Array.from({ length: 10 }, (_, i) => `N${i}`),
				"n",
			),
		).toHaveLength(6)
	})

	it("reports which known names a body mentions", () => {
		expect(mentionsIn("@anna and @Ben Lee", ["Anna", "Ben Lee", "Carl"])).toEqual([
			"Anna",
			"Ben Lee",
		])
	})
})

describe("threads", () => {
	const root = comment({ id: "r1", elementId: "task", createdAt: 1 })
	const reply = comment({ id: "p1", parentId: "r1", elementId: "task", createdAt: 2 })
	const resolved = comment({ id: "r2", createdAt: 0, resolvedAt: 5, resolvedBy: "Ben" })
	const lonelyTombstone = comment({ id: "r3", deletedAt: 3, body: "" })
	const otherFile = comment({ id: "r4", filename: "other.bpmn" })

	it("groups replies under their thread, open threads first, per file", () => {
		const threads = threadsFor([resolved, reply, root, lonelyTombstone, otherFile], "order.bpmn")
		expect(threads.map((t) => t.root.id)).toEqual(["r1", "r2"])
		expect(threads[0]?.replies.map((r) => r.id)).toEqual(["p1"])
	})

	it("keeps a deleted thread while it still has replies", () => {
		const deletedRoot = { ...root, deletedAt: 9, body: "" }
		expect(threadsFor([deletedRoot, reply], "order.bpmn").map((t) => t.root.id)).toEqual(["r1"])
	})

	it("says an anchor is removed when the diagram no longer has the element", () => {
		const defs = Bpmn.parse(SIMPLE_BPMN)
		const ids = drawnIds(defs)
		expect(ids.has("task")).toBe(true)
		expect(ids.has("flow1")).toBe(true)

		const thread = { root, replies: [] }
		expect(anchorState(thread, ids)).toBe("element")
		expect(anchorState({ root: { ...root, elementId: "gone" }, replies: [] }, ids)).toBe("removed")
		expect(anchorState({ root: { ...root, elementId: null }, replies: [] }, ids)).toBe("file")
		// Not a diagram: nothing can have been removed from it.
		expect(anchorState(thread, null)).toBe("element")
	})
})

describe("the panel", () => {
	let host: HTMLElement
	let panel: CommentsPanel
	let announced: string[]
	let overlays: Array<{ id: string; node: HTMLElement }>

	/** The slice of `BpmnCanvas` the panel uses. */
	const canvas = {
		overlays: {
			add: (id: string, opts: { html: HTMLElement }) => {
				overlays.push({ id, node: opts.html })
				return String(overlays.length)
			},
			remove: () => {
				overlays = []
			},
		},
		highlight: vi.fn(),
		clearHighlights: vi.fn(),
	} as unknown as BpmnCanvas

	function mount(readOnly: string | null = null) {
		host = document.createElement("div")
		host.innerHTML = `<button id="t"></button><aside id="p" hidden><div id="l"></div><footer id="c"></footer></aside>
			<div id="n" hidden><span id="nt"></span><button id="no"></button></div>`
		document.body.replaceChildren(host)
		const q = <T extends HTMLElement>(id: string) => host.querySelector(`#${id}`) as T
		panel = new CommentsPanel({
			shareId: "share1",
			readOnly,
			toggle: q("t"),
			panel: q("p"),
			list: q("l"),
			compose: q("c"),
			notice: { box: q("n"), text: q("nt"), open: q("no") },
			challenge: async () => ({ ok: true, token: null }),
			announceName: (name) => announced.push(name),
		})
		panel.setFile({ filename: "order.bpmn", kind: "bpmn" })
		panel.showOn(canvas, Bpmn.parse(SIMPLE_BPMN))
		return q
	}

	beforeEach(() => {
		announced = []
		overlays = []
		localStorage.clear()
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("puts one counted marker on each element with open threads", () => {
		mount()
		panel.receive(comment({ id: "a00000000001", elementId: "task" }))
		panel.receive(comment({ id: "a00000000002", elementId: "task" }))
		panel.receive(
			comment({ id: "a00000000003", elementId: "start", resolvedAt: 1, resolvedBy: "B" }),
		)
		panel.receive(comment({ id: "a00000000004", elementId: "removed_task" }))
		panel.receive(comment({ id: "a00000000005" }))

		expect(overlays.map((o) => [o.id, o.node.textContent])).toEqual([["task", "2"]])
	})

	it("shows a comment whose element is gone as on a removed element, not not at all", () => {
		const q = mount()
		panel.receive(comment({ id: "a00000000001", elementId: "gone", elementLabel: "Check credit" }))
		panel.open()
		const anchor = q("l").querySelector(".cm-anchor")
		expect(anchor?.textContent).toBe("On a removed element · Check credit")
		expect(anchor?.classList.contains("removed")).toBe(true)
	})

	it("pulls forward only the threads a marker was clicked for", () => {
		const q = mount()
		panel.receive(comment({ id: "a00000000001" }))
		panel.receive(comment({ id: "a00000000002", elementId: "task" }))
		// Opened from the toolbar: nothing is singled out, file-level threads included.
		panel.open()
		expect(q("l").querySelectorAll(".cm-thread.focus")).toHaveLength(0)

		panel.close()
		overlays.find((o) => o.id === "task")?.node.click()
		const focused = [...q("l").querySelectorAll(".cm-thread.focus .cm-anchor")]
		expect(focused.map((n) => n.textContent)).toEqual(["On task"])
	})

	it("counts open threads on the toggle", () => {
		const q = mount()
		expect(q("t").textContent).toBe("Comments")
		panel.receive(comment({ id: "a00000000001" }))
		panel.receive(comment({ id: "a00000000002", parentId: "a00000000001" }))
		expect(q("t").textContent).toBe("Comments 1")
	})

	it("tells a mentioned viewer, once, and not about their own comment", async () => {
		localStorage.setItem("bpmnkit-drop-name", "Ben")
		const token = "1".repeat(24)
		localStorage.setItem(AUTHOR_STORAGE_KEY, JSON.stringify({ share1: token }))
		const q = mount()
		// The author id is worked out asynchronously from the stored token.
		const ownId = await authorIdFromToken(token)
		let attempt = 0
		await vi.waitFor(() => {
			q("n").hidden = true
			attempt += 1
			panel.receive(comment({ id: `own${attempt}`, mentions: ["ben"], authorId: ownId }))
			expect(q("n").hidden).toBe(true)
		})

		panel.receive(comment({ id: "a00000000001", authorName: "Anna", mentions: ["Carl"] }))
		expect(q("n").hidden).toBe(true)

		panel.receive(comment({ id: "a00000000002", authorName: "Anna", mentions: ["ben"] }))
		expect(q("n").hidden).toBe(false)
		expect(q("nt").textContent).toBe("Anna mentioned you in a comment")

		// An edit of the same comment is not a second mention.
		q("n").hidden = true
		panel.receive(
			comment({ id: "a00000000002", authorName: "Anna", mentions: ["ben"], editedAt: 9 }),
		)
		expect(q("n").hidden).toBe(true)
	})

	it("offers no composer on a drop that takes no comments", () => {
		const q = mount("this drop is pinned by an operator")
		expect(q("c").querySelector("textarea")).toBeNull()
		expect(q("c").textContent).toContain("pinned")
	})

	it("posts a comment on the picked element and keeps the token it earns", async () => {
		const q = mount()
		const posted: Array<Record<string, unknown>> = []
		const earned = "2".repeat(24)
		vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string) as Record<string, unknown>
			posted.push(body)
			return new Response(
				JSON.stringify({
					comment: comment({ id: "new000000001", elementId: "task", body: body.body as string }),
					authorToken: earned,
				}),
				{ status: 201 },
			)
		})

		panel.pick("task", "Do Work")
		const name = q("c").querySelector<HTMLInputElement>(".cm-name") as HTMLInputElement
		name.value = "Anna"
		name.dispatchEvent(new Event("change"))
		expect(announced).toEqual(["Anna"])

		const area = q("c").querySelector("textarea") as HTMLTextAreaElement
		area.value = "Why a service task?"
		;(q("c").querySelector(".hv-btn--go") as HTMLButtonElement).click()
		await vi.waitFor(() => expect(posted).toHaveLength(1))

		expect(posted[0]).toMatchObject({
			filename: "order.bpmn",
			elementId: "task",
			elementLabel: "Do Work",
			name: "Anna",
			body: "Why a service task?",
		})
		await vi.waitFor(() =>
			expect(JSON.parse(localStorage.getItem(AUTHOR_STORAGE_KEY) ?? "{}")).toEqual({
				share1: earned,
			}),
		)
		expect(overlays.map((o) => o.id)).toEqual(["task"])
	})
})
