import { describe, expect, it } from "vitest"
import { parseArgs } from "./args.js"

describe("parseArgs", () => {
	it("parses positional arguments", () => {
		const { positional, flags } = parseArgs(["process-instance", "list"])
		expect(positional).toEqual(["process-instance", "list"])
		expect(flags).toEqual({})
	})

	it("parses --flag value", () => {
		const { flags } = parseArgs(["--output", "json"])
		expect(flags.output).toBe("json")
	})

	it("parses --flag=value", () => {
		const { flags } = parseArgs(["--output=json"])
		expect(flags.output).toBe("json")
	})

	it("parses --boolean-flag as true", () => {
		const { flags } = parseArgs(["--debug"])
		expect(flags.debug).toBe(true)
	})

	it("parses --no-flag as false on the base key", () => {
		const { flags } = parseArgs(["--no-color"])
		expect(flags.color).toBe(false)
	})

	it("parses short flag -f value", () => {
		const { flags } = parseArgs(["-o", "yaml"])
		expect(flags.o).toBe("yaml")
	})

	it("parses short flag -fVALUE", () => {
		const { flags } = parseArgs(["-ojson"])
		expect(flags.o).toBe("json")
	})

	it("stops flag parsing after --", () => {
		const { positional, flags } = parseArgs(["--debug", "--", "--not-a-flag"])
		expect(flags.debug).toBe(true)
		expect(positional).toContain("--not-a-flag")
	})

	it("coerces numeric values", () => {
		const { flags } = parseArgs(["--limit", "20"])
		expect(flags.limit).toBe(20)
	})

	it("coerces boolean string values", () => {
		const { flags } = parseArgs(["--verbose", "true"])
		expect(flags.verbose).toBe(true)
	})

	it("mixes positionals and flags", () => {
		const { positional, flags } = parseArgs([
			"process-instance",
			"list",
			"--filter",
			'{"state":"ACTIVE"}',
			"--limit",
			"10",
		])
		expect(positional).toEqual(["process-instance", "list"])
		expect(flags.filter).toBe('{"state":"ACTIVE"}')
		expect(flags.limit).toBe(10)
	})
})
