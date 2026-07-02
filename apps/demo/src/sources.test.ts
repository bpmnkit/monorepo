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
			onTick: vi.fn(),
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
		new ReplaySource(panel).subscribe({
			onChunk: vi.fn(),
			onTick: vi.fn(),
			onDone,
			onBpmn,
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(100)
		expect(onDone).toHaveBeenCalledTimes(1)
		expect(onBpmn).not.toHaveBeenCalled()
	})

	it("delivers a bpmn result at durationMs with null usage when the recording has none", () => {
		const onBpmn = vi.fn()
		new ReplaySource(panel).subscribe({
			onChunk: vi.fn(),
			onTick: vi.fn(),
			onDone: vi.fn(),
			onBpmn,
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(300)
		expect(onBpmn).toHaveBeenCalledWith("<xml/>", null)
	})

	it("delivers the recorded usage alongside the bpmn result when present", () => {
		const panelWithUsage: RecordedPanel = {
			...panel,
			usage: { inputTokens: 8100, outputTokens: 340 },
		}
		const onBpmn = vi.fn()
		new ReplaySource(panelWithUsage).subscribe({
			onChunk: vi.fn(),
			onTick: vi.fn(),
			onDone: vi.fn(),
			onBpmn,
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(300)
		expect(onBpmn).toHaveBeenCalledWith("<xml/>", { inputTokens: 8100, outputTokens: 340 })
	})

	it("delivers an error result with null usage when the recorded result is an error", () => {
		const errorPanel: RecordedPanel = {
			...panel,
			result: { type: "error", message: "boom" },
		}
		const onError = vi.fn()
		new ReplaySource(errorPanel).subscribe({
			onChunk: vi.fn(),
			onTick: vi.fn(),
			onDone: vi.fn(),
			onBpmn: vi.fn(),
			onError,
		})

		vi.advanceTimersByTime(300)
		expect(onError).toHaveBeenCalledWith("boom", null)
	})

	it("cancels all pending timers when unsubscribed", () => {
		const onChunk = vi.fn()
		const unsubscribe = new ReplaySource(panel).subscribe({
			onChunk,
			onTick: vi.fn(),
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
			onTick: vi.fn(),
			onDone,
			onBpmn,
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(0)
		expect(onDone).toHaveBeenCalledTimes(1)
		vi.advanceTimersByTime(300)
		expect(onBpmn).toHaveBeenCalledWith("<xml/>", null)
	})

	it("reports elapsed virtual time via onTick as ticks advance", () => {
		const onTick = vi.fn()
		new ReplaySource(panel).subscribe({
			onChunk: vi.fn(),
			onTick,
			onDone: vi.fn(),
			onBpmn: vi.fn(),
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(100)
		expect(onTick).toHaveBeenLastCalledWith(100)
	})

	it("setSpeed changes how fast virtual time advances for subsequent ticks", () => {
		const longPanel: RecordedPanel = {
			systemPrompt: "irrelevant",
			chunks: [],
			durationMs: 10000,
			result: { type: "bpmn", xml: "<xml/>" },
		}
		const onTick = vi.fn()
		const source = new ReplaySource(longPanel)
		source.subscribe({
			onChunk: vi.fn(),
			onTick,
			onDone: vi.fn(),
			onBpmn: vi.fn(),
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(100)
		expect(onTick).toHaveBeenLastCalledWith(100)

		source.setSpeed(5)
		vi.advanceTimersByTime(100)
		expect(onTick).toHaveBeenLastCalledWith(600)
	})

	it("clamps onTick's final value to durationMs, never exceeding it", () => {
		const onTick = vi.fn()
		new ReplaySource(panel).subscribe({
			onChunk: vi.fn(),
			onTick,
			onDone: vi.fn(),
			onBpmn: vi.fn(),
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(1000)
		for (const call of onTick.mock.calls) {
			expect(call[0]).toBeLessThanOrEqual(300)
		}
	})
})
