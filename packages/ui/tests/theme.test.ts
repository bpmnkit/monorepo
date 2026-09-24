import { afterEach, describe, expect, it, vi } from "vitest"
import { applyTheme, loadPersistedTheme, persistTheme, resolveTheme } from "../src/index.js"

function preferDark(dark: boolean): void {
	vi.spyOn(window, "matchMedia").mockImplementation(
		(query: string) =>
			({ matches: dark && query.includes("dark"), media: query }) as MediaQueryList,
	)
}

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	localStorage.clear()
})

describe("resolveTheme", () => {
	it("passes explicit themes through", () => {
		expect(resolveTheme("light")).toBe("light")
		expect(resolveTheme("dark")).toBe("dark")
		expect(resolveTheme("neon")).toBe("neon")
	})

	it("resolves auto to the OS preference", () => {
		preferDark(true)
		expect(resolveTheme("auto")).toBe("dark")
		preferDark(false)
		expect(resolveTheme("auto")).toBe("light")
	})
})

describe("persistTheme / loadPersistedTheme", () => {
	it("returns null when nothing is stored", () => {
		expect(loadPersistedTheme()).toBeNull()
	})

	it("round-trips every theme under the bpmnkit-theme key", () => {
		for (const theme of ["light", "dark", "auto", "neon"] as const) {
			persistTheme(theme)
			expect(localStorage.getItem("bpmnkit-theme")).toBe(theme)
			expect(loadPersistedTheme()).toBe(theme)
		}
	})

	it("ignores a stored value that is not a theme", () => {
		localStorage.setItem("bpmnkit-theme", "sepia")
		expect(loadPersistedTheme()).toBeNull()
	})

	it("survives storage that throws", () => {
		const fail = () => {
			throw new Error("storage disabled")
		}
		vi.stubGlobal("localStorage", { getItem: fail, setItem: fail })
		expect(() => persistTheme("dark")).not.toThrow()
		expect(loadPersistedTheme()).toBeNull()
	})
})

describe("applyTheme", () => {
	it("sets data-theme to the resolved theme", () => {
		const el = document.createElement("div")
		applyTheme(el, "neon")
		expect(el.getAttribute("data-theme")).toBe("neon")
		preferDark(true)
		applyTheme(el, "auto")
		expect(el.getAttribute("data-theme")).toBe("dark")
	})
})
