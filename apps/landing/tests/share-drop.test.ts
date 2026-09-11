import { afterEach, describe, expect, it, vi } from "vitest"
import {
	DROP_UPLOAD_PATH,
	dropFileName,
	shareToDrop,
	uploadErrorMessage,
} from "../src/scripts/share-drop.js"

/** A `fetch` stub returning one canned JSON response. */
function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
	const fn = vi.fn(async () =>
		body === undefined
			? new Response(null, { status })
			: new Response(JSON.stringify(body), {
					status,
					headers: { "Content-Type": "application/json" },
				}),
	)
	vi.stubGlobal("fetch", fn)
	return fn
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("dropFileName", () => {
	it("falls back for an unsaved diagram", () => {
		expect(dropFileName(null)).toBe("diagram.bpmn")
		expect(dropFileName("")).toBe("diagram.bpmn")
		expect(dropFileName("   ")).toBe("diagram.bpmn")
	})

	it("adds the extension when it is missing", () => {
		expect(dropFileName("order-process")).toBe("order-process.bpmn")
	})

	it("leaves an existing extension alone, whatever its case", () => {
		expect(dropFileName("order.bpmn")).toBe("order.bpmn")
		expect(dropFileName("ORDER.BPMN")).toBe("ORDER.BPMN")
	})
})

describe("uploadErrorMessage", () => {
	it("prefers the per-file parser messages — they are the actionable ones", () => {
		const message = uploadErrorMessage(400, {
			error: "some files were rejected",
			details: ["diagram.bpmn: unexpected end of input"],
		})
		expect(message).toBe("diagram.bpmn: unexpected end of input")
	})

	it("joins several details onto their own lines", () => {
		expect(uploadErrorMessage(400, { details: ["a: bad", "b: worse"] })).toBe("a: bad\nb: worse")
	})

	it("falls back to the summary when there are no details", () => {
		expect(uploadErrorMessage(422, { error: "this content is not allowed" })).toBe(
			"this content is not allowed",
		)
	})

	it("explains the statuses the Worker can return without a body", () => {
		expect(uploadErrorMessage(413, null)).toMatch(/too large/i)
		expect(uploadErrorMessage(429, null)).toMatch(/too many/i)
		expect(uploadErrorMessage(500, null)).toBe("Sharing failed (500). Please try again.")
	})
})

describe("shareToDrop", () => {
	it("posts one multipart file to the Drop upload endpoint", async () => {
		const fetchMock = stubFetch(201, { shareId: "aB3xY", url: "/drop/aB3xY" })

		await shareToDrop("<definitions/>", "order.bpmn")

		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
		expect(url).toBe(DROP_UPLOAD_PATH)
		expect(init.method).toBe("POST")

		// The field name is the one `handleUpload` reads via `form.getAll("files")`.
		const body = init.body as FormData
		const sent = body.getAll("files")
		expect(sent).toHaveLength(1)
		const file = sent[0] as File
		expect(file.name).toBe("order.bpmn")
		await expect(file.text()).resolves.toBe("<definitions/>")
	})

	it("returns the share path on 201", async () => {
		stubFetch(201, { shareId: "aB3xY", url: "/drop/aB3xY" })
		await expect(shareToDrop("<definitions/>", "order.bpmn")).resolves.toEqual({
			ok: true,
			path: "/drop/aB3xY",
		})
	})

	it("surfaces a rejection from the Worker", async () => {
		stubFetch(400, { error: "some files were rejected", details: ["order.bpmn: not BPMN"] })
		await expect(shareToDrop("nonsense", "order.bpmn")).resolves.toEqual({
			ok: false,
			message: "order.bpmn: not BPMN",
		})
	})

	it("treats a 2xx without a url as a failure rather than a broken link", async () => {
		stubFetch(201, { shareId: "aB3xY" })
		const outcome = await shareToDrop("<definitions/>", "order.bpmn")
		expect(outcome.ok).toBe(false)
	})

	it("survives a response that is not JSON", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("<html>gateway error</html>", { status: 502 })),
		)
		await expect(shareToDrop("<definitions/>", "order.bpmn")).resolves.toEqual({
			ok: false,
			message: "Sharing failed (502). Please try again.",
		})
	})

	it("reports a network failure instead of throwing at the caller", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Failed to fetch")
			}),
		)
		const outcome = await shareToDrop("<definitions/>", "order.bpmn")
		expect(outcome).toEqual({
			ok: false,
			message: "Could not reach Drop. Check your connection and try again.",
		})
	})
})
