import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Recording } from "../shared/recording-types.js"
import { saveRecording, slugify } from "./recordings-store.js"

describe("slugify", () => {
	it("lowercases and hyphenates spaces", () => {
		expect(slugify("Loan Approval Demo")).toBe("loan-approval-demo")
	})

	it("strips special characters", () => {
		expect(slugify("Test! Run #2")).toBe("test-run-2")
	})

	it("collapses repeated hyphens", () => {
		expect(slugify("a---b")).toBe("a-b")
	})

	it("trims leading and trailing hyphens", () => {
		expect(slugify("-hello-")).toBe("hello")
	})

	it("returns an empty string when nothing sanitizable remains", () => {
		expect(slugify("!!!")).toBe("")
	})
})

describe("saveRecording", () => {
	let dir: string

	const sampleRecording: Recording = {
		name: "Test Recording",
		recordedAt: "2026-07-01T00:00:00.000Z",
		scenarioPrompt: "scenario",
		panels: {
			"with-sdk": {
				systemPrompt: "sdk prompt",
				chunks: [{ t: 0, text: "hello" }],
				durationMs: 100,
				result: { type: "bpmn", xml: "<xml/>" },
			},
			"without-sdk": {
				systemPrompt: "raw prompt",
				chunks: [{ t: 0, text: "world" }],
				durationMs: 200,
				result: { type: "error", message: "oops" },
			},
		},
	}

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "recordings-store-test-"))
	})

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true })
	})

	it("writes a JSON file readable back with the same content", () => {
		const result = saveRecording(dir, sampleRecording)
		expect(result).toEqual({ status: "ok", slug: "test-recording" })
		const written = JSON.parse(readFileSync(join(dir, "test-recording.json"), "utf-8"))
		expect(written).toEqual(sampleRecording)
	})

	it("returns conflict without overwriting an existing file", () => {
		saveRecording(dir, sampleRecording)
		const before = readFileSync(join(dir, "test-recording.json"), "utf-8")

		const second = saveRecording(dir, { ...sampleRecording, scenarioPrompt: "changed" })

		expect(second).toEqual({ status: "conflict", slug: "test-recording" })
		const after = readFileSync(join(dir, "test-recording.json"), "utf-8")
		expect(after).toBe(before)
	})

	it("returns invalid when the name sanitizes to an empty slug", () => {
		const result = saveRecording(dir, { ...sampleRecording, name: "!!!" })
		expect(result).toEqual({ status: "invalid" })
	})

	it("creates the target directory if it does not exist", () => {
		const nested = join(dir, "nested", "recordings")
		const result = saveRecording(nested, sampleRecording)
		expect(result).toEqual({ status: "ok", slug: "test-recording" })
	})
})
