// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest"
import {
	FEEL_PLAYGROUND_STYLE_ID,
	buildFeelPlaygroundPanel,
} from "../../src/feel-playground/index.js"

describe("buildFeelPlaygroundPanel", () => {
	beforeEach(() => {
		document.getElementById(FEEL_PLAYGROUND_STYLE_ID)?.remove()
		document.body.replaceChildren()
	})

	it("brings its own stylesheet", () => {
		// A host that only imported the builder used to get a working evaluator
		// that rendered as unstyled form controls.
		buildFeelPlaygroundPanel()
		expect(document.getElementById(FEEL_PLAYGROUND_STYLE_ID)).not.toBeNull()
	})

	it("injects once however many panels are built", () => {
		buildFeelPlaygroundPanel()
		buildFeelPlaygroundPanel()
		expect(document.querySelectorAll(`#${FEEL_PLAYGROUND_STYLE_ID}`)).toHaveLength(1)
	})

	it("pre-fills the expression it is given", () => {
		const panel = buildFeelPlaygroundPanel(undefined, "sum([1, 2, 3])")
		const expression = panel.querySelector("textarea")
		expect(expression?.value).toBe("sum([1, 2, 3])")
	})

	it("renders no close button when nothing would handle it", () => {
		const embedded = buildFeelPlaygroundPanel()
		const closable = buildFeelPlaygroundPanel(() => {})
		const buttons = (el: HTMLElement) =>
			[...el.querySelectorAll("button")].map((b) => b.textContent)
		expect(buttons(closable).length).toBeGreaterThan(buttons(embedded).length)
	})
})
