import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMockStream, createStream } from "../src/stream.js"

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	})
}

/** Let pending fetch/json promise chains settle without advancing timers. */
async function flush(): Promise<void> {
	for (let i = 0; i < 5; i++) await Promise.resolve()
	await new Promise((r) => setImmediate(r))
}

describe("createStream", () => {
	let fetchMock: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
		fetchMock = vi.fn()
		vi.stubGlobal("fetch", fetchMock)
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllGlobals()
	})

	it("fetches immediately, then again on every interval", async () => {
		fetchMock.mockImplementation(async () => jsonResponse({ n: 1 }))
		const onData = vi.fn()
		const stop = createStream("http://proxy/operate/stream?interval=10000", onData, vi.fn())
		await flush()
		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(fetchMock).toHaveBeenCalledWith("http://proxy/operate/stream?interval=10000")
		expect(onData).toHaveBeenCalledWith({ n: 1 })

		vi.advanceTimersByTime(10_000)
		await flush()
		expect(fetchMock).toHaveBeenCalledTimes(2)
		stop()
	})

	it("defaults to 30 s and never polls faster than every 5 s", async () => {
		fetchMock.mockImplementation(async () => jsonResponse({}))
		const stopDefault = createStream("http://proxy/s", vi.fn(), vi.fn())
		await flush()
		vi.advanceTimersByTime(29_999)
		await flush()
		expect(fetchMock).toHaveBeenCalledTimes(1)
		vi.advanceTimersByTime(1)
		await flush()
		expect(fetchMock).toHaveBeenCalledTimes(2)
		stopDefault()

		fetchMock.mockClear()
		const stopFast = createStream("http://proxy/s?interval=100", vi.fn(), vi.fn())
		await flush()
		vi.advanceTimersByTime(4_999)
		await flush()
		expect(fetchMock).toHaveBeenCalledTimes(1)
		vi.advanceTimersByTime(1)
		await flush()
		expect(fetchMock).toHaveBeenCalledTimes(2)
		stopFast()
	})

	// Regression: `pollInterval: 0` is documented to disable auto-refresh, but the
	// stream used to fall back to 30 s polling whenever the interval was 0.
	it("fetches exactly once when interval=0", async () => {
		fetchMock.mockImplementation(async () => jsonResponse({}))
		const stop = createStream("http://proxy/s?interval=0", vi.fn(), vi.fn())
		await flush()
		vi.advanceTimersByTime(120_000)
		await flush()
		expect(fetchMock).toHaveBeenCalledTimes(1)
		stop()
	})

	// Regression: a same-origin relative proxy URL made `new URL(url)` throw.
	it("accepts a relative proxy URL", async () => {
		fetchMock.mockImplementation(async () => jsonResponse({ ok: true }))
		const onData = vi.fn()
		const stop = createStream("/bpmnkit-proxy/operate/stream?topic=jobs", onData, vi.fn())
		await flush()
		expect(fetchMock).toHaveBeenCalledWith("/bpmnkit-proxy/operate/stream?topic=jobs")
		expect(onData).toHaveBeenCalledWith({ ok: true })
		stop()
	})

	// Regression: every non-2xx became "Connection error", hiding the proxy's
	// "No active profile" / auth failure from the user.
	it("reports the HTTP status and the proxy's error message", async () => {
		fetchMock.mockImplementation(async () => jsonResponse({ error: "No active profile" }, 401))
		const onError = vi.fn()
		const onData = vi.fn()
		const stop = createStream("http://proxy/s", onData, onError)
		await flush()
		expect(onError).toHaveBeenCalledWith("HTTP 401: No active profile")
		expect(onData).not.toHaveBeenCalled()
		stop()
	})

	it("reports the bare status when the error body is not JSON", async () => {
		fetchMock.mockImplementation(async () => new Response("Bad Gateway", { status: 502 }))
		const onError = vi.fn()
		const stop = createStream("http://proxy/s", vi.fn(), onError)
		await flush()
		expect(onError).toHaveBeenCalledWith("HTTP 502")
		stop()
	})

	it("reports a network failure as a retryable connection error", async () => {
		fetchMock.mockImplementation(async () => {
			throw new TypeError("Failed to fetch")
		})
		const onError = vi.fn()
		const stop = createStream("http://proxy/s", vi.fn(), onError)
		await flush()
		expect(onError).toHaveBeenCalledWith("Connection error. Retrying…")
		stop()
	})

	// Regression: a request slower than the interval stacked a second one on top.
	it("does not start a poll while the previous one is still in flight", async () => {
		let release: (r: Response) => void = () => {}
		fetchMock.mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					release = resolve
				}),
		)
		const stop = createStream("http://proxy/s?interval=5000", vi.fn(), vi.fn())
		vi.advanceTimersByTime(15_000)
		await flush()
		expect(fetchMock).toHaveBeenCalledTimes(1)

		release(jsonResponse({}))
		await flush()
		vi.advanceTimersByTime(5_000)
		await flush()
		expect(fetchMock).toHaveBeenCalledTimes(2)
		stop()
	})

	it("stops polling and drops a late response after unsubscribe", async () => {
		let release: (r: Response) => void = () => {}
		fetchMock.mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					release = resolve
				}),
		)
		const onData = vi.fn()
		const onError = vi.fn()
		const stop = createStream("http://proxy/s?interval=5000", onData, onError)
		stop()
		release(jsonResponse({ late: true }))
		await flush()
		vi.advanceTimersByTime(60_000)
		await flush()
		expect(onData).not.toHaveBeenCalled()
		expect(onError).not.toHaveBeenCalled()
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})
})

describe("createMockStream", () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it("emits synchronously and then on the interval", () => {
		let n = 0
		const onData = vi.fn()
		const stop = createMockStream(() => ++n, onData, 1_000)
		expect(onData).toHaveBeenLastCalledWith(1)
		vi.advanceTimersByTime(2_000)
		expect(onData).toHaveBeenLastCalledWith(3)
		stop()
		vi.advanceTimersByTime(5_000)
		expect(onData).toHaveBeenCalledTimes(3)
	})

	it("emits once when the interval is 0", () => {
		const onData = vi.fn()
		createMockStream(() => 1, onData, 0)
		vi.advanceTimersByTime(60_000)
		expect(onData).toHaveBeenCalledTimes(1)
	})
})
