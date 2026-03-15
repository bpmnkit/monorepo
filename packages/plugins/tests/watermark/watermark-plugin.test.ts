import { BpmnCanvas } from "@bpmnkit/canvas"
import { afterEach, describe, expect, it } from "vitest"
import { WATERMARK_STYLE_ID, createWatermarkPlugin } from "../../src/watermark/index.js"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContainer(): HTMLElement {
	const el = document.createElement("div")
	document.body.appendChild(el)
	return el
}

afterEach(() => {
	document.body.innerHTML = ""
	document.head.innerHTML = ""
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createWatermarkPlugin", () => {
	it("has name 'watermark'", () => {
		expect(createWatermarkPlugin().name).toBe("watermark")
	})

	it("injects styles into <head>", () => {
		const container = makeContainer()
		new BpmnCanvas({ container, plugins: [createWatermarkPlugin()] })
		expect(document.getElementById(WATERMARK_STYLE_ID)).not.toBeNull()
	})

	it("mounts .bpmnkit-watermark inside the canvas host", () => {
		const container = makeContainer()
		new BpmnCanvas({ container, plugins: [createWatermarkPlugin()] })
		const host = container.querySelector(".bpmnkit-canvas-host")
		expect(host?.querySelector(".bpmnkit-watermark")).not.toBeNull()
	})

	it("renders configured links", () => {
		const container = makeContainer()
		new BpmnCanvas({
			container,
			plugins: [
				createWatermarkPlugin({
					links: [
						{ label: "GitHub", url: "https://github.com/example" },
						{ label: "Docs", url: "https://example.com/docs" },
					],
				}),
			],
		})
		const links = container.querySelectorAll<HTMLAnchorElement>(".bpmnkit-watermark-link")
		expect(links.length).toBe(2)
		expect(links[0]?.textContent).toBe("GitHub")
		expect(links[1]?.textContent).toBe("Docs")
	})

	it("logo is rightmost element when both links and logo are provided", () => {
		const container = makeContainer()
		new BpmnCanvas({
			container,
			plugins: [
				createWatermarkPlugin({
					links: [{ label: "GitHub", url: "https://github.com" }],
					logo: `<svg viewBox="0 0 24 24"><rect width="24" height="24"/></svg>`,
				}),
			],
		})
		const watermark = container.querySelector(".bpmnkit-watermark")
		if (!watermark) throw new Error(".bpmnkit-watermark not found")
		const children = Array.from(watermark.children)
		expect(children.at(-1)?.classList.contains("bpmnkit-watermark-logo")).toBe(true)
	})

	it("renders no links when links option is omitted", () => {
		const container = makeContainer()
		new BpmnCanvas({ container, plugins: [createWatermarkPlugin()] })
		expect(container.querySelectorAll(".bpmnkit-watermark-link").length).toBe(0)
	})

	it("removes .bpmnkit-watermark on uninstall", () => {
		const container = makeContainer()
		const canvas = new BpmnCanvas({ container, plugins: [createWatermarkPlugin()] })
		canvas.destroy()
		expect(container.querySelector(".bpmnkit-watermark")).toBeNull()
	})
})
