import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { RecordedPanel } from "../shared/recording-types.js"
import { ReplaySource } from "./sources.js"

describe("ReplaySource", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	const panel: RecordedPanel = {
		systemPrompt: "irrelevant",
		chunks: [
			{ t: 0, text: "Hello" },
			{ t: 100, text: " world" },
		],
		durationMs: 300,
		result: { type: "bpmn", xml: "<xml/>" },
	}

	it("delivers chunks at their recorded relative times, in order", () => {
		const onChunk = vi.fn()
		new ReplaySource(panel).subscribe({
			onChunk,
			onDone: vi.fn(),
			onBpmn: vi.fn(),
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(0)
		expect(onChunk).toHaveBeenNthCalledWith(1, "Hello")

		vi.advanceTimersByTime(100)
		expect(onChunk).toHaveBeenNthCalledWith(2, " world")
		expect(onChunk).toHaveBeenCalledTimes(2)
	})

	it("calls onDone right after the last chunk, before the result", () => {
		const onDone = vi.fn()
		const onBpmn = vi.fn()
		new ReplaySource(panel).subscribe({ onChunk: vi.fn(), onDone, onBpmn, onError: vi.fn() })

		vi.advanceTimersByTime(100)
		expect(onDone).toHaveBeenCalledTimes(1)
		expect(onBpmn).not.toHaveBeenCalled()
	})

	it("delivers a bpmn result at durationMs", () => {
		const onBpmn = vi.fn()
		new ReplaySource(panel).subscribe({
			onChunk: vi.fn(),
			onDone: vi.fn(),
			onBpmn,
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(300)
		expect(onBpmn).toHaveBeenCalledWith("<xml/>")
	})

	it("delivers an error result when the recorded result is an error", () => {
		const errorPanel: RecordedPanel = {
			...panel,
			result: { type: "error", message: "boom" },
		}
		const onError = vi.fn()
		new ReplaySource(errorPanel).subscribe({
			onChunk: vi.fn(),
			onDone: vi.fn(),
			onBpmn: vi.fn(),
			onError,
		})

		vi.advanceTimersByTime(300)
		expect(onError).toHaveBeenCalledWith("boom")
	})

	it("cancels all pending timers when unsubscribed", () => {
		const onChunk = vi.fn()
		const unsubscribe = new ReplaySource(panel).subscribe({
			onChunk,
			onDone: vi.fn(),
			onBpmn: vi.fn(),
			onError: vi.fn(),
		})

		unsubscribe()
		vi.advanceTimersByTime(300)
		expect(onChunk).not.toHaveBeenCalled()
	})

	it("handles zero chunks: onDone fires immediately, result fires at durationMs", () => {
		const emptyPanel: RecordedPanel = { ...panel, chunks: [] }
		const onDone = vi.fn()
		const onBpmn = vi.fn()
		new ReplaySource(emptyPanel).subscribe({
			onChunk: vi.fn(),
			onDone,
			onBpmn,
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(0)
		expect(onDone).toHaveBeenCalledTimes(1)
		vi.advanceTimersByTime(300)
		expect(onBpmn).toHaveBeenCalledWith("<xml/>")
	})
})
