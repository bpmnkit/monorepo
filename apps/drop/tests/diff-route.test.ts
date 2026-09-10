import { describe, expect, it } from "vitest"
import type { Env } from "../src/env.js"
import { handleDiffPage } from "../src/routes/drop.js"
import { DEMO_SHARE_ID } from "../src/shared/constants.js"

/**
 * The demo drop is served from memory, so the whole page can be exercised
 * without a database — a D1 binding that throws proves nothing touched it.
 */
const NO_DB = {
	DB: {
		prepare() {
			throw new Error("the demo path must not reach D1")
		},
	},
} as unknown as Env

/** A D1 stand-in whose lookups always miss, for the not-found paths. */
const EMPTY_DB = {
	DB: {
		prepare() {
			const api = {
				bind: () => api,
				first: async () => null,
				all: async () => ({ results: [] }),
				run: async () => ({}),
			}
			return api
		},
	},
} as unknown as Env

describe("handleDiffPage", () => {
	it("renders a comparison of a drop against itself", async () => {
		const res = await handleDiffPage(DEMO_SHARE_ID, DEMO_SHARE_ID, NO_DB)
		expect(res.status).toBe(200)
		const body = await res.text()
		expect(body).toContain('id="leftPane"')
		expect(body).toContain('id="rightPane"')
		expect(body).toContain("/drop/assets/diff.js")
	})

	it("bootstraps both share ids and their BPMN filenames", async () => {
		const res = await handleDiffPage(DEMO_SHARE_ID, DEMO_SHARE_ID, NO_DB)
		const body = await res.text()
		const match = body.match(/<script type="application\/json" id="diff-data">([\s\S]*?)<\/script>/)
		expect(match).not.toBeNull()
		const data = JSON.parse(match?.[1] ?? "{}") as {
			left: { shareId: string; files: string[] }
			right: { shareId: string; files: string[] }
		}
		expect(data.left.shareId).toBe(DEMO_SHARE_ID)
		expect(data.right.shareId).toBe(DEMO_SHARE_ID)
		expect(data.left.files.every((f) => f.endsWith(".bpmn"))).toBe(true)
		expect(data.left.files.length).toBeGreaterThan(0)
	})

	it("offers a picker entry per BPMN file on each side", async () => {
		const res = await handleDiffPage(DEMO_SHARE_ID, DEMO_SHARE_ID, NO_DB)
		const body = await res.text()
		expect(body).toContain('id="leftPick"')
		expect(body).toContain('id="rightPick"')
	})

	it("keeps the page out of search indexes", async () => {
		const res = await handleDiffPage(DEMO_SHARE_ID, DEMO_SHARE_ID, NO_DB)
		expect(await res.text()).toContain('name="robots" content="noindex"')
	})

	it("404s when a share does not exist", async () => {
		const res = await handleDiffPage("nope", DEMO_SHARE_ID, EMPTY_DB)
		expect(res.status).toBe(404)
	})

	it("404s when the other share does not exist", async () => {
		const res = await handleDiffPage(DEMO_SHARE_ID, "nope", EMPTY_DB)
		expect(res.status).toBe(404)
	})
})
