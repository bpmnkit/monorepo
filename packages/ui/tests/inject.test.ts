import { afterEach, describe, expect, it } from "vitest"
import {
	UI_COMPONENTS_CSS,
	UI_COMPONENTS_STYLE_ID,
	UI_TOKENS_CSS,
	UI_TOKENS_STYLE_ID,
	injectStyle,
	injectUiComponents,
	injectUiStyles,
	injectUiTokens,
} from "../src/index.js"

const styles = () => Array.from(document.head.querySelectorAll("style"))

afterEach(() => {
	document.head.innerHTML = ""
})

describe("injectStyle", () => {
	it("appends a <style> with the given id and css to <head>", () => {
		injectStyle("my-style", ".a { color: red; }")
		const [style] = styles()
		expect(style?.id).toBe("my-style")
		expect(style?.textContent).toBe(".a { color: red; }")
	})

	it("injects once per id, keeping the first css", () => {
		injectStyle("my-style", ".a {}")
		injectStyle("my-style", ".b {}")
		expect(styles()).toHaveLength(1)
		expect(styles()[0]?.textContent).toBe(".a {}")
	})

	it("injects different ids side by side", () => {
		injectStyle("one", ".a {}")
		injectStyle("two", ".b {}")
		expect(styles().map((s) => s.id)).toEqual(["one", "two"])
	})
})

describe("injectUiStyles", () => {
	it("injects the tokens and the component styles under their exported ids", () => {
		injectUiStyles()
		expect(document.getElementById(UI_TOKENS_STYLE_ID)?.textContent).toBe(UI_TOKENS_CSS)
		expect(document.getElementById(UI_COMPONENTS_STYLE_ID)?.textContent).toBe(UI_COMPONENTS_CSS)
		expect(styles().map((s) => s.id)).toEqual([UI_TOKENS_STYLE_ID, UI_COMPONENTS_STYLE_ID])
	})

	it("is idempotent", () => {
		injectUiStyles()
		injectUiStyles()
		injectUiTokens()
		injectUiComponents()
		expect(styles()).toHaveLength(2)
	})

	it("leaves an injection by the separate functions in place", () => {
		injectUiTokens()
		expect(styles().map((s) => s.id)).toEqual([UI_TOKENS_STYLE_ID])
		injectUiStyles()
		expect(styles().map((s) => s.id)).toEqual([UI_TOKENS_STYLE_ID, UI_COMPONENTS_STYLE_ID])
	})

	it("keeps the component styles on the design-system rules: square, no shadow or gradient", () => {
		expect(UI_COMPONENTS_CSS).not.toMatch(/box-shadow|linear-gradient|backdrop-filter/)
		expect(UI_COMPONENTS_CSS).not.toMatch(/border-radius:\s*[1-9]/)
	})
})
