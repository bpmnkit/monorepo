// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { CHROME_CSS } from "../src/chrome.js"
import { EDITOR_CSS, HUD_CSS } from "../src/css.js"
import { BpmnEditor } from "../src/editor.js"
import { initEditorHud } from "../src/hud.js"

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d"><bpmndi:BPMNPlane id="p" bpmnElement="proc">
    <bpmndi:BPMNShape id="s_start" bpmnElement="start">
      <dc:Bounds x="100" y="100" width="36" height="36"/>
    </bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

function makeContainer(): HTMLElement {
	const el = document.createElement("div")
	el.style.width = "1200px"
	el.style.height = "800px"
	document.body.appendChild(el)
	return el
}

function mount(): { container: HTMLElement; destroy: () => void } {
	const container = makeContainer()
	const mk = (id: string) => {
		const b = document.createElement("button")
		b.id = id
		return b
	}
	const editor = new BpmnEditor({ container, xml: XML, grid: false })
	initEditorHud(editor, {
		optimizeButton: mk("plug-optimize"),
		aiButton: mk("plug-ai"),
		playButton: mk("plug-play"),
		rawModeButton: mk("plug-raw"),
		asciiButton: mk("plug-ascii"),
	})
	return { container, destroy: () => editor.destroy() }
}

/**
 * The chrome restyle is CSS-only, so nothing here should ever change. These
 * assertions exist because a purely visual change once made the top toolbar
 * read as missing: the controls were all still in the DOM.
 */
describe("HUD control inventory", () => {
	const GROUPS: ReadonlyArray<[string, readonly string[]]> = [
		[
			"#hud-top-center",
			[
				"#btn-tc-toggle",
				"#btn-undo",
				"#btn-redo",
				"#btn-delete",
				"#btn-duplicate",
				"#btn-top-more",
				"#btn-auto-layout",
				"#plug-optimize",
				"#plug-ai",
				"#plug-play",
			],
		],
		[
			"#hud-bottom-left",
			[
				"#btn-zoom-current",
				"#zoom-expanded",
				"#btn-zoom-out",
				"#btn-zoom-pct",
				"#btn-zoom-in",
				"#plug-raw",
				"#plug-ascii",
			],
		],
		[
			"#hud-bottom-center",
			["#btn-bc-toggle", "#btn-select", "#btn-pan", "#btn-space", "#tool-groups"],
		],
	]

	it("keeps every control in its group", () => {
		const { container, destroy } = mount()
		for (const [group, controls] of GROUPS) {
			const host = container.querySelector(group)
			expect(host, `${group} is missing`).toBeTruthy()
			for (const sel of controls) {
				expect(host?.querySelector(sel), `${sel} is missing from ${group}`).toBeTruthy()
			}
		}
		destroy()
	})

	it("renders the element palette into the bottom-center group", () => {
		const { container, destroy } = mount()
		const tools = container.querySelectorAll("#tool-groups .hud-btn")
		expect(tools.length).toBeGreaterThan(0)
		destroy()
	})

	it("separates runs of buttons with explicit separators", () => {
		const { container, destroy } = mount()
		// A separator only reads as one if it can stretch; a run of buttons with
		// none would collapse the toolbar into an undifferentiated strip.
		expect(container.querySelectorAll("#hud-top-center .hud-sep").length).toBeGreaterThan(0)
		expect(container.querySelectorAll("#hud-bottom-center .hud-sep").length).toBeGreaterThan(0)
		destroy()
	})
})

describe("design-system invariants", () => {
	const sheets: ReadonlyArray<[string, string]> = [
		["EDITOR_CSS", EDITOR_CSS],
		["HUD_CSS", HUD_CSS],
	]

	it("is flat and square — no radius, shadow, gradient or blur", () => {
		for (const [name, css] of sheets) {
			for (const banned of ["border-radius", "box-shadow", "linear-gradient", "backdrop-filter"]) {
				expect(css, `${name} still uses ${banned}`).not.toContain(banned)
			}
		}
	})

	it("gives separators a stretch so they survive any align-items", () => {
		expect(HUD_CSS).toMatch(/\.hud-sep\s*\{[^}]*align-self:\s*stretch/)
	})

	it("draws internal hairlines between adjacent group items", () => {
		expect(HUD_CSS).toContain(".panel > * + *")
		// …and never doubles one up against an explicit separator.
		expect(HUD_CSS).toContain(".panel > .hud-sep + * { border-left: none; }")
	})

	it("selects with a dashed halo rather than recolouring the shape", () => {
		const rule = /\.bpmnkit-sel-indicator\s*\{([^}]*)\}/.exec(EDITOR_CSS)?.[1] ?? ""
		expect(rule).toContain("stroke-dasharray")
		expect(rule).toContain("fill: none")
	})
})

/**
 * The shell sits on the design system's light `--canvas` ground. Dark and the
 * `neon` white-label theme are opt-in from there, so a host that names no theme
 * — and any chrome rendered before the HUD stamps the body — reads light.
 */
describe("chrome ground", () => {
	/** The declarations a selector opens in CHROME_CSS. */
	function block(selector: string): string {
		const at = CHROME_CSS.indexOf(`${selector} {`)
		expect(at, `${selector} declares no block`).toBeGreaterThan(-1)
		return CHROME_CSS.slice(at, CHROME_CSS.indexOf("}", at))
	}

	it("puts the light design-system ground on the themeless default", () => {
		const root = block(":root")
		expect(root).toContain("--bpmnkit-chrome-ground: var(--bpmnkit-ds-surface, #ffffff)")
		expect(root).toContain("--bpmnkit-chrome-ink: var(--bpmnkit-ds-ink, #14161a)")
	})

	it("makes dark and neon opt in, and drops the old light opt-in", () => {
		expect(block('[data-bpmnkit-hud-theme="dark"]')).toContain(
			"--bpmnkit-chrome-ground: var(--bpmnkit-panel-bg, #0d0d16)",
		)
		expect(CHROME_CSS).toContain('[data-bpmnkit-hud-theme="neon"]')
		expect(CHROME_CSS).not.toContain('[data-bpmnkit-hud-theme="light"]')
	})

	it("comes up light when the host names no theme", () => {
		const container = makeContainer()
		const editor = new BpmnEditor({ container, xml: XML, grid: false })
		expect(editor.getTheme()).toBe("light")
		// Light is the themeless default in @bpmnkit/canvas too, so it sets nothing.
		expect(editor.container.hasAttribute("data-theme")).toBe(false)
		editor.destroy()
	})

	it("stamps the canvas theme on the body so chrome and canvas agree", () => {
		const { destroy } = mount()
		expect(document.body.dataset.bpmnkitHudTheme).toBe("light")
		destroy()
	})

	it("lands the new-diagram overlay on the --canvas ground", () => {
		expect(HUD_CSS).toMatch(/#bpmnkit-empty-state\s*\{[^}]*background:\s*var\(--bpmnkit-ds-canvas/)
		expect(HUD_CSS).toContain('[data-bpmnkit-hud-theme="dark"] #bpmnkit-empty-state')
	})
})
