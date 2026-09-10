import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { PAYLOADS_PATH, discoverPayloads, readPayload } from "../src/host/payloads.js"

const roots: string[] = []

async function project(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "bpmnkit-payloads-"))
	roots.push(root)
	for (const [path, content] of Object.entries(files)) {
		const full = join(root, path)
		await mkdir(join(full, ".."), { recursive: true })
		await writeFile(full, content)
	}
	return root
}

afterEach(() => {
	roots.length = 0
})

const payload = (vars: Record<string, unknown>) => JSON.stringify(vars)

describe("readPayload", () => {
	it("names a payload after its file", () => {
		const result = readPayload("/w/.camunda/payloads/large-order.json", payload({ amount: 5 }))
		expect(result).toEqual({
			name: "large-order",
			path: "/w/.camunda/payloads/large-order.json",
			variables: { amount: 5 },
		})
	})

	it("rejects a file that is not JSON, and says so", () => {
		expect(readPayload("/w/p.json", "{oops")).toMatchObject({
			message: expect.stringMatching(/not JSON/),
		})
	})

	it("rejects JSON that is not an object of variables", () => {
		// An array or a number is a file someone meant to be something else.
		// Starting an instance with nothing would hide the mistake.
		expect(readPayload("/w/p.json", "[1, 2]")).toMatchObject({
			message: expect.stringMatching(/JSON object/),
		})
		expect(readPayload("/w/p.json", "7")).toMatchObject({
			message: expect.stringMatching(/JSON object/),
		})
	})
})

describe("discoverPayloads", () => {
	it("finds payloads beside the diagram", async () => {
		const root = await project({
			"order.bpmn": "<x/>",
			[join(PAYLOADS_PATH, "small.json")]: payload({ amount: 1 }),
			[join(PAYLOADS_PATH, "large.json")]: payload({ amount: 1000 }),
		})
		const { payloads } = await discoverPayloads(join(root, "order.bpmn"), root)
		expect(payloads.map((p) => p.name)).toEqual(["large", "small"])
		expect(payloads[0]?.variables).toEqual({ amount: 1000 })
	})

	it("walks up to the project root", async () => {
		const root = await project({
			"processes/orders/order.bpmn": "<x/>",
			[join(PAYLOADS_PATH, "shared.json")]: payload({ tenant: "acme" }),
		})
		const { payloads } = await discoverPayloads(join(root, "processes/orders/order.bpmn"), root)
		expect(payloads.map((p) => p.name)).toEqual(["shared"])
	})

	it("lets the nearest directory win a name clash", async () => {
		const root = await project({
			"processes/order.bpmn": "<x/>",
			[join(PAYLOADS_PATH, "default.json")]: payload({ from: "root" }),
			[join("processes", PAYLOADS_PATH, "default.json")]: payload({ from: "beside" }),
		})
		const { payloads } = await discoverPayloads(join(root, "processes/order.bpmn"), root)
		expect(payloads).toHaveLength(1)
		expect(payloads[0]?.variables).toEqual({ from: "beside" })
	})

	it("stops at the root it was given", async () => {
		// A payload outside the project must not be picked up by accident.
		const root = await project({
			"inner/order.bpmn": "<x/>",
			[join(PAYLOADS_PATH, "outside.json")]: payload({ leaked: true }),
		})
		const { payloads } = await discoverPayloads(join(root, "inner/order.bpmn"), join(root, "inner"))
		expect(payloads).toEqual([])
	})

	it("reports a bad file without losing the good ones beside it", async () => {
		const root = await project({
			"order.bpmn": "<x/>",
			[join(PAYLOADS_PATH, "good.json")]: payload({ ok: true }),
			[join(PAYLOADS_PATH, "broken.json")]: "{not json",
		})
		const { payloads, problems } = await discoverPayloads(join(root, "order.bpmn"), root)
		expect(payloads.map((p) => p.name)).toEqual(["good"])
		expect(problems).toHaveLength(1)
		expect(problems[0]?.path).toMatch(/broken\.json$/)
	})

	it("ignores files that are not JSON documents", async () => {
		const root = await project({
			"order.bpmn": "<x/>",
			[join(PAYLOADS_PATH, "notes.md")]: "# not a payload",
			[join(PAYLOADS_PATH, "real.json")]: payload({ ok: true }),
		})
		const { payloads, problems } = await discoverPayloads(join(root, "order.bpmn"), root)
		expect(payloads.map((p) => p.name)).toEqual(["real"])
		expect(problems).toEqual([])
	})

	it("finds nothing, quietly, in a project with no payloads", async () => {
		const root = await project({ "order.bpmn": "<x/>" })
		expect(await discoverPayloads(join(root, "order.bpmn"), root)).toEqual({
			payloads: [],
			problems: [],
		})
	})

	it("accepts the directory holding the diagram as well as the diagram", async () => {
		const root = await project({
			"order.bpmn": "<x/>",
			[join(PAYLOADS_PATH, "p.json")]: payload({ a: 1 }),
		})
		expect((await discoverPayloads(root, root)).payloads).toHaveLength(1)
	})
})
