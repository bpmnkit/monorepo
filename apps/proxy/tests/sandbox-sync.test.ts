import { describe, expect, it } from "vitest"
import { runSandboxedSync } from "../src/sandbox.js"

describe("runSandboxedSync", () => {
	it("returns a copy of the value the code returns", () => {
		expect(runSandboxedSync("return { a: [1, 2] }", {})).toEqual({ a: [1, 2] })
	})

	it("injects data and calls host functions synchronously", () => {
		const result = runSandboxedSync("return shout(name)", {
			data: { name: "bpmn" },
			functions: { shout: (s: unknown) => String(s).toUpperCase() },
		})
		expect(result).toBe("BPMN")
	})

	it("lets the code catch an error a host function throws", () => {
		const result = runSandboxedSync("try { fail() } catch (e) { return 'caught: ' + e.message }", {
			functions: {
				fail: () => {
					throw new Error("no such element")
				},
			},
		})
		expect(result).toBe("caught: no such element")
	})

	it("times out on an infinite loop", () => {
		expect(() => runSandboxedSync("while(true){}", {}, 100)).toThrow()
	})

	// Under node:vm, a host function handed to the code is a way out:
	// fn.constructor is the host's Function, and that reaches process.
	it("gives the code no route to the host through an injected function", () => {
		const result = runSandboxedSync(
			`try {
				const p = hostFn.constructor("return typeof process")()
				return p
			} catch (e) { return "blocked" }`,
			{ functions: { hostFn: () => "x" } },
		)
		expect(result).not.toBe("object")
		expect(runSandboxedSync("return typeof process + typeof require", {})).toBe(
			"undefinedundefined",
		)
	})
})
