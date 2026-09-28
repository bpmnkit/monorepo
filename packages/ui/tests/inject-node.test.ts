// @vitest-environment node
import { describe, expect, it } from "vitest"
import { injectStyle, injectUiStyles } from "../src/index.js"

describe("injection without a DOM", () => {
	it("is a no-op, so the package can be imported during SSR", () => {
		expect(typeof document).toBe("undefined")
		expect(() => injectStyle("x", ".a {}")).not.toThrow()
		expect(() => injectUiStyles()).not.toThrow()
	})
})
