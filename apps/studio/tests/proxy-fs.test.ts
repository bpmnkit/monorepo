import { afterEach, describe, expect, it, vi } from "vitest"
import { ProxyFsAdapter } from "../src/storage/proxy-fs.js"

// Preferences live in IndexedDB, which Node lacks; these tests never touch them.
vi.mock("../src/storage/indexeddb.js", () => ({ sharedIndexedDb: {} }))

/**
 * The proxy only touches files inside a workspace root. The adapter names its
 * project folder as that root on every call, so a proxy that restarted — and
 * forgot which roots Studio opened — still accepts the next save.
 */
describe("ProxyFsAdapter sends its project root", () => {
	const calls: Array<{ url: string; method: string; body: unknown }> = []

	afterEach(() => {
		calls.length = 0
		vi.unstubAllGlobals()
	})

	function stubFetch(): void {
		vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
			calls.push({
				url,
				method: init?.method ?? "GET",
				body: init?.body ? JSON.parse(String(init.body)) : undefined,
			})
			const payload = url.includes("/fs/list")
				? [
						{
							relativePath: "a.bpmn",
							name: "a",
							absPath: "/work/proj/a.bpmn",
							fileType: "bpmn",
							content: "<x/>",
							meta: { id: "m1", createdAt: 1 },
						},
					]
				: url.includes("/fs/read")
					? { content: "<x/>" }
					: { ok: true }
			return new Response(JSON.stringify(payload), { status: 200 })
		})
	}

	it("on reads, writes, deletes, moves, folders and metadata", async () => {
		stubFetch()
		const fs = new ProxyFsAdapter("http://localhost:3033/", "/work/proj")
		await fs.listModels()
		await fs.getModel("m1")
		await fs.saveModel({
			id: "m1",
			name: "a",
			type: "bpmn",
			content: "<y/>",
			path: "a.bpmn",
			createdAt: 1,
		})
		await fs.createFolder("sub")
		await fs.moveModel("a.bpmn", "sub/a.bpmn")
		await fs.deleteModel("m1")

		const root = encodeURIComponent("/work/proj")
		for (const call of calls) {
			if (call.method === "GET" || call.method === "DELETE") {
				expect(call.url, call.url).toContain(`root=${root}`)
			} else {
				expect((call.body as { root?: string }).root, call.url).toBe("/work/proj")
			}
		}
		const routes = new Set(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`))
		for (const route of [
			"GET /fs/list",
			"GET /fs/read",
			"GET /fs/meta",
			"POST /fs/write",
			"POST /fs/meta",
			"POST /fs/mkdir",
			"POST /fs/move",
			"DELETE /fs/file",
		]) {
			expect(routes).toContain(route)
		}
	})
})
