import { describe, expect, it } from "vitest"
import { runSandboxed } from "../src/sandbox.js"

describe("runSandboxed", () => {
	it("returns value from sync code", async () => {
		expect(await runSandboxed("return 1 + 1", {})).toBe(2)
	})

	it("returns value from async code", async () => {
		expect(await runSandboxed("return await Promise.resolve('hi')", {})).toBe("hi")
	})

	it("injects serializable data as globals", async () => {
		expect(await runSandboxed("return spec.version", { data: { spec: { version: 42 } } })).toBe(42)
	})

	it("runs bootstrap before user code", async () => {
		expect(
			await runSandboxed("return greet('world')", {
				bootstrap: "function greet(n) { return 'hello ' + n }",
			}),
		).toBe("hello world")
	})

	it("times out on infinite loop", async () => {
		await expect(runSandboxed("while(true){}", {}, 100)).rejects.toThrow()
	})

	it("blocks access to process global", async () => {
		expect(await runSandboxed("return typeof process", {})).toBe("undefined")
	})

	it("calls host async function via ivm.Reference", async () => {
		const result = await runSandboxed(
			`const r = await __fn.apply(undefined, ['hello'], { result: { promise: true, copy: true } })
       return r`,
			{ functions: { __fn: async (arg: unknown) => String(arg).toUpperCase() } },
		)
		expect(result).toBe("HELLO")
	})

	it("propagates errors thrown by host functions", async () => {
		await expect(
			runSandboxed("await __fn.apply(undefined, [], { result: { promise: true, copy: true } })", {
				functions: {
					__fn: async () => {
						throw new Error("boom")
					},
				},
			}),
		).rejects.toThrow()
	})
})
