import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Bpmn } from "@bpmnkit/core"
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { BpmnEditor } from "../src/editor.js"
import { initEditorHud } from "../src/hud.js"
import { createTranslationRecorder } from "../src/i18n.js"

/**
 * Harvesting the editor's translatable strings by running it.
 *
 * The catalogue in `i18n/en.json` is produced here rather than written by hand
 * or grepped out of the source, and the difference is not cosmetic — see the
 * "grep would have missed" test at the bottom for the measurement.
 *
 * Regenerate after changing the UI:
 *
 * ```sh
 * UPDATE_I18N=1 pnpm --filter @bpmnkit/editor test
 * ```
 */

// happy-dom replaces the global URL, and `node:fs` will not take one. Paths.
const HERE = dirname(fileURLToPath(import.meta.url))
const CATALOGUE = join(HERE, "..", "i18n", "en.json")
const SOURCE = join(HERE, "..", "src")

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="d" targetNamespace="x">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start"/>
    <bpmn:serviceTask id="task" name="Do Work"/>
    <bpmn:exclusiveGateway id="gw" name="Which?"/>
    <bpmn:endEvent id="end" name="End"/>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="task"/>
    <bpmn:sequenceFlow id="f2" sourceRef="task" targetRef="gw"/>
    <bpmn:sequenceFlow id="f3" sourceRef="gw" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="100" y="80" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s2" bpmnElement="task"><dc:Bounds x="200" y="60" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s3" bpmnElement="gw"><dc:Bounds x="360" y="75" width="50" height="50"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s4" bpmnElement="end"><dc:Bounds x="460" y="80" width="36" height="36"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

/**
 * Drives an editor through the states its strings live in.
 *
 * Every key this observes is real by construction: the UI asked for it while
 * running. Coverage is only as good as the exercise below, which is why the
 * never-observed list is reported rather than deleted.
 */
function harvest(): { keys: string[]; placeholders: (key: string) => string[] } {
	const container = document.createElement("div")
	document.body.appendChild(container)

	const recorder = createTranslationRecorder()
	const editor = new BpmnEditor({ container, translate: recorder.translate, fit: "none" })
	const hud = initEditorHud(editor)

	// Each button is pressed at most once — pressing a toggle twice closes what
	// it just opened, and the strings inside would go unobserved. Pressing after
	// every state change is what reaches the ones a menu only reveals when open.
	const pressed = new WeakSet<Element>()
	const press = (): void => {
		for (let pass = 0; pass < 4; pass += 1) {
			const buttons = [...document.querySelectorAll("button")].filter((b) => !pressed.has(b))
			if (buttons.length === 0) return
			for (const button of buttons) {
				pressed.add(button)
				;(button as HTMLElement).click()
			}
		}
	}

	editor.load(XML)
	press()
	editor.setSelection(["task"])
	press()
	editor.setSelection(["task", "start"])
	press()
	editor.setSelection(["gw"])
	press()
	editor.selectAll()
	press()
	hud.showOnboarding()
	press()
	hud.setSimulationActive(true)
	press()
	editor.setSelection([])
	press()

	editor.destroy()
	container.remove()
	return { keys: recorder.keys(), placeholders: (key) => recorder.placeholders(key) }
}

/** Keys a grep over the source can see: a literal passed straight to `t()`. */
function staticKeys(): Set<string> {
	const keys = new Set<string>()
	for (const file of readdirSync(SOURCE).filter((name) => name.endsWith(".ts"))) {
		const source = readFileSync(join(SOURCE, file), "utf8")
		for (const match of source.matchAll(/(?:^|[^\w.])_?t\(\s*"((?:[^"\\]|\\.)*)"/g)) {
			if (match[1] !== undefined) keys.add(match[1])
		}
	}
	return keys
}

const observed = harvest()

describe("i18n harvest", () => {
	it("observes the strings the running editor asks for", () => {
		expect(observed.keys.length).toBeGreaterThan(40)
		expect(observed.keys).toContain("Undo")
		expect(observed.keys).toContain("Keyboard shortcuts")
	})

	it("records the interpolation variables a template is given", () => {
		expect(observed.placeholders("{name} selected")).toEqual(["name"])
		expect(observed.placeholders("{count} elements selected")).toEqual(["count"])
	})

	it("keeps the catalogue in step with the running editor", () => {
		const catalogue = Object.fromEntries(
			[...observed.keys].sort().map((key) => [key, key] as const),
		)
		const serialised = `${JSON.stringify(catalogue, null, "\t")}\n`

		if (process.env.UPDATE_I18N !== undefined) {
			writeFileSync(CATALOGUE, serialised)
		}
		expect(readFileSync(CATALOGUE, "utf8")).toBe(serialised)
	})

	it("finds strings a grep over the source cannot", () => {
		// The measurement this method exists for. A conventional extractor scans
		// for literals passed to the translation call; the editor builds most of
		// its labels from element types and templates at runtime, so that scan
		// sees a small fraction of what the UI actually says. Localising from the
		// grep would ship a mostly-English editor with a full-looking catalogue.
		const grepped = staticKeys()
		const missed = observed.keys.filter((key) => !grepped.has(key))
		expect(missed.length).toBeGreaterThan(observed.keys.length / 2)
	})

	it("reports keys the harvest never reached", () => {
		// Not a failure: a key here is either dead, or reachable only through a
		// path this exercise does not take. Both are worth knowing and neither is
		// safe to delete on the strength of a grep.
		const seen = new Set(observed.keys)
		const unreached = [...staticKeys()].filter((key) => !seen.has(key))
		expect(unreached).toEqual([])
	})
})
