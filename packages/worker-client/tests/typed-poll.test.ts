import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import { createWorkerClient } from "../src/index.js"

/** The shape `casen gen types` emits for one job type. */
type JobTypes = {
	"ship-order": {
		variables: { orderId: unknown; express?: unknown }
		output: { trackingNumber: unknown }
		headers: { readonly carrier: "dhl" }
		errors: "OUT_OF_STOCK"
		processIds: "order-process"
		elementIds: "Ship"
	}
}

function stubZeebe(): Array<{ url: string; body: unknown }> {
	const calls: Array<{ url: string; body: unknown }> = []
	vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
		const body = JSON.parse(init.body) as unknown
		calls.push({ url, body })
		const jobs = url.endsWith("/v2/jobs/activation")
			? [
					{
						jobKey: "1",
						type: "ship-order",
						variables: { orderId: "o-1" },
						customHeaders: { carrier: "dhl" },
					},
				]
			: []
		return new Response(JSON.stringify({ jobs }), { status: 200 })
	})
	return calls
}

/** The first job a poll yields; leaving the loop stops the generator. */
async function first<T>(jobs: AsyncGenerator<T>): Promise<T> {
	for await (const job of jobs) return job
	throw new Error("no job activated")
}

describe("createWorkerClient<JobTypes>", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("types a job by its job type and passes headers through", async () => {
		const calls = stubZeebe()
		const client = createWorkerClient<JobTypes>({ address: "http://zeebe" })
		const job = await first(client.poll("ship-order"))

		expectTypeOf(job.variables).toEqualTypeOf<JobTypes["ship-order"]["variables"]>()
		expectTypeOf(job.customHeaders.carrier).toEqualTypeOf<"dhl">()
		expect(job.variables.orderId).toBe("o-1")
		expect(job.customHeaders.carrier).toBe("dhl")

		await job.complete({ trackingNumber: "T-9" })
		await job.throwError("OUT_OF_STOCK", "none left")
		expect(calls.slice(1)).toEqual([
			{ url: "http://zeebe/v2/jobs/1/completion", body: { variables: { trackingNumber: "T-9" } } },
			{
				url: "http://zeebe/v2/jobs/1/error",
				body: { errorCode: "OUT_OF_STOCK", errorMessage: "none left", variables: {} },
			},
		])

		// Compile-time only (checked by `pnpm typecheck`); never called.
		const rejected = async () => {
			// @ts-expect-error — not a job type in the BPMN
			client.poll("ship-ordr")
			// @ts-expect-error — misspelt variable
			job.variables.orderID
			// @ts-expect-error — required output missing
			await job.complete({ tracking: "x" })
			// @ts-expect-error — no catch event handles this code
			await job.throwError("OUT_OF_STOK", "typo")
		}
		expect(typeof rejected).toBe("function")
	})

	it("stays untyped without a JobTypes map", async () => {
		stubZeebe()
		const job = await first(createWorkerClient({ address: "http://zeebe" }).poll("anything"))
		expectTypeOf(job.variables).toEqualTypeOf<Record<string, unknown>>()
		expectTypeOf(job.throwError).parameter(0).toEqualTypeOf<string>()
		expect(job.customHeaders).toEqual({ carrier: "dhl" })
	})
})
