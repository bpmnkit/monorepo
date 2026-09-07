import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve as resolvePath } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { RunContext } from "../types.js"
import { generateGroup, resolveModifyOutputPath } from "./generate.js"

describe("resolveModifyOutputPath", () => {
	it("refuses to replace the input when no --output is given", () => {
		// Regression: `casen generate bpmn --input x.bpmn` used to write the lossy
		// compactify/expand round trip straight back over x.bpmn and report success,
		// destroying pools, lanes, message correlation keys and ioMapping detail.
		expect(() =>
			resolveModifyOutputPath({ inputFile: "order.bpmn", outputFlag: undefined, force: false }),
		).toThrow(/Refusing to overwrite order\.bpmn/)
	})

	it("refuses when --output names the input file", () => {
		expect(() =>
			resolveModifyOutputPath({ inputFile: "order.bpmn", outputFlag: "order.bpmn", force: false }),
		).toThrow(/Refusing to overwrite/)
	})

	it("refuses when --output reaches the input by a different path", () => {
		expect(() =>
			resolveModifyOutputPath({
				inputFile: "flows/order.bpmn",
				outputFlag: "flows/../flows/order.bpmn",
				force: false,
			}),
		).toThrow(/Refusing to overwrite/)
	})

	it("names both ways out in the error", () => {
		expect(() =>
			resolveModifyOutputPath({ inputFile: "order.bpmn", outputFlag: "", force: false }),
		).toThrow(/--output <file>.*--force/s)
	})

	it("says what would be lost, so the refusal is actionable", () => {
		expect(() =>
			resolveModifyOutputPath({ inputFile: "order.bpmn", outputFlag: undefined, force: false }),
		).toThrow(/collaborations, pools, lanes/)
	})

	it("allows in-place replacement with --force", () => {
		expect(
			resolveModifyOutputPath({ inputFile: "order.bpmn", outputFlag: undefined, force: true }),
		).toBe("order.bpmn")
	})

	it("allows --output naming the input with --force", () => {
		expect(
			resolveModifyOutputPath({ inputFile: "order.bpmn", outputFlag: "order.bpmn", force: true }),
		).toBe("order.bpmn")
	})

	it("writes to a distinct --output without --force", () => {
		expect(
			resolveModifyOutputPath({
				inputFile: "order.bpmn",
				outputFlag: "order.patched.bpmn",
				force: false,
			}),
		).toBe("order.patched.bpmn")
	})

	it("treats an empty --output as absent", () => {
		expect(resolveModifyOutputPath({ inputFile: "order.bpmn", outputFlag: "", force: true })).toBe(
			"order.bpmn",
		)
	})
})

describe("generate bpmn --input", () => {
	const sample = resolvePath(import.meta.dirname, "../../../../bpmn-samples/order-process.bpmn")
	let dir: string
	let input: string
	let wasTty: boolean | undefined

	function ctx(flags: Record<string, string | boolean>): RunContext {
		return { positional: [], flags, output: { ok() {}, info() {} } } as unknown as RunContext
	}

	function run(flags: Record<string, string | boolean>): Promise<void> {
		const bpmn = generateGroup.commands.find((command) => command.name === "bpmn")
		if (!bpmn) throw new Error("generate bpmn command not registered")
		return bpmn.run(ctx(flags))
	}

	beforeAll(() => {
		// The command reads a patch from stdin whenever stdin is not a TTY, which
		// would block here. Present as a terminal so the write path is reachable.
		wasTty = process.stdin.isTTY
		process.stdin.isTTY = true
		dir = mkdtempSync(join(tmpdir(), "casen-generate-"))
		input = join(dir, "order.bpmn")
	})

	afterAll(() => {
		process.stdin.isTTY = wasTty as boolean
		rmSync(dir, { force: true, recursive: true })
	})

	it("refuses in place and leaves the input byte-identical", async () => {
		copyFileSync(sample, input)
		const before = readFileSync(input, "utf-8")
		await expect(run({ input })).rejects.toThrow(/Refusing to overwrite/)
		expect(readFileSync(input, "utf-8")).toBe(before)
	})

	it("writes to --output without touching the input", async () => {
		copyFileSync(sample, input)
		const before = readFileSync(input, "utf-8")
		const output = join(dir, "order.patched.bpmn")
		await run({ input, output })
		expect(readFileSync(input, "utf-8")).toBe(before)
		expect(readFileSync(output, "utf-8")).toContain("<bpmn:definitions")
	})

	it("replaces the input when --force is given", async () => {
		copyFileSync(sample, input)
		await run({ input, force: true })
		expect(readFileSync(input, "utf-8")).toContain("<bpmn:definitions")
	})
})
