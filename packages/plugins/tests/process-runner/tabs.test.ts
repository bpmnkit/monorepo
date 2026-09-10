import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import { BpmnCanvas } from "@bpmnkit/canvas"
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { createProcessRunnerPlugin } from "../../src/process-runner/index.js"

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="d" targetNamespace="x">
  <bpmn:process id="proc" isExecutable="true"><bpmn:startEvent id="s" /></bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="sh" bpmnElement="s"><dc:Bounds x="10" y="10" width="36" height="36"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

/** A stand-in for `Engine`; the tab logic never runs anything. */
const engine = { deploy: () => {}, start: () => ({ onChange: () => () => {} }) }

function mount(options: Record<string, unknown>): HTMLElement {
	const container = document.createElement("div")
	document.body.appendChild(container)
	const play = document.createElement("div")
	const runner = createProcessRunnerPlugin({ engine, playContainer: play, ...options } as never)
	const probe: CanvasPlugin = { name: "probe", install: (_: CanvasApi) => {} }
	new BpmnCanvas({ container, xml: XML, fit: "none", plugins: [runner, probe] })
	return play
}

const tabs = (play: HTMLElement): string[] =>
	[...play.querySelectorAll("button")]
		.map((b) => b.textContent ?? "")
		.filter((t) => ["Variables", "FEEL", "Errors", "Input", "Tests"].includes(t))

describe("process runner tabs", () => {
	it("offers the Tests tab when the host can run a scenario", () => {
		expect(tabs(mount({ runScenario: () => Promise.resolve({}) }))).toContain("Tests")
	})

	it("hides the Tests tab when the host cannot run one", () => {
		// It used to open onto "Pass runScenario in options to enable the Tests
		// tab" — an instruction to whoever wrote the host, shown to its users.
		expect(tabs(mount({}))).not.toContain("Tests")
	})

	it("still shows the other tabs when tests are unavailable", () => {
		expect(tabs(mount({}))).toEqual(["Variables", "FEEL", "Errors", "Input"])
	})

	it("leaves the tab out when the host mounts tests somewhere of its own", () => {
		const elsewhere = document.createElement("div")
		const play = mount({ runScenario: () => Promise.resolve({}), testsContainer: elsewhere })
		expect(tabs(play)).not.toContain("Tests")
	})
})
