import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import { BpmnCanvas } from "@bpmnkit/canvas"
import { Bpmn } from "@bpmnkit/core"
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import {
	type ModelReference,
	type ReferencePort,
	collectReferences,
	createModelNavigationPlugin,
} from "../../src/model-navigation/index.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** One of each referencing element, in the Camunda 8 shape. */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:callActivity id="call" name="Fulfil order">
      <bpmn:extensionElements><zeebe:calledElement processId="fulfilment-process" /></bpmn:extensionElements>
    </bpmn:callActivity>
    <bpmn:businessRuleTask id="rule" name="Score risk">
      <bpmn:extensionElements><zeebe:calledDecision decisionId="risk-score" /></bpmn:extensionElements>
    </bpmn:businessRuleTask>
    <bpmn:userTask id="approve" name="Approve">
      <bpmn:extensionElements><zeebe:formDefinition formId="approval-form" /></bpmn:extensionElements>
    </bpmn:userTask>
    <bpmn:task id="plain" name="Nothing to follow" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="s1" bpmnElement="call"><dc:Bounds x="100" y="80" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s2" bpmnElement="rule"><dc:Bounds x="240" y="80" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s3" bpmnElement="approve"><dc:Bounds x="380" y="80" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s4" bpmnElement="plain"><dc:Bounds x="520" y="80" width="100" height="80"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

// ── Helpers ───────────────────────────────────────────────────────────────────

function probe(): CanvasPlugin & { api: CanvasApi } {
	const plugin = {
		name: "probe",
		api: null as unknown as CanvasApi,
		install(api: CanvasApi) {
			plugin.api = api
		},
	}
	return plugin
}

function mount(port: ReferencePort, xml = XML, key?: string | null) {
	const container = document.createElement("div")
	document.body.appendChild(container)
	const canvasProbe = probe()
	const nav = createModelNavigationPlugin(key === undefined ? { port } : { port, key })
	const canvas = new BpmnCanvas({ container, xml, fit: "none", plugins: [nav, canvasProbe] })
	return { nav, canvas, canvasApi: canvasProbe.api, host: canvasProbe.api.container }
}

function available(host: HTMLElement): string[] {
	return [...host.querySelectorAll(".bpmnkit-modelnav-available")]
		.map((el) => el.getAttribute("data-bpmnkit-id") ?? "")
		.sort()
}

/** Lets a pending `resolve()` settle before assertions. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

// ── Extraction ────────────────────────────────────────────────────────────────

describe("collectReferences", () => {
	it("reads a process, a decision and a form reference", () => {
		expect(collectReferences(Bpmn.parse(XML))).toEqual([
			{ elementId: "call", kind: "process", ref: "fulfilment-process" },
			{ elementId: "rule", kind: "decision", ref: "risk-score" },
			{ elementId: "approve", kind: "form", ref: "approval-form" },
		])
	})

	it("ignores an element that references nothing", () => {
		expect(collectReferences(Bpmn.parse(XML)).map((r) => r.elementId)).not.toContain("plain")
	})

	it("reads the Camunda 7 attribute shape too", () => {
		// A diagram in a repository can predate the migration even when the tools
		// do not, so both shapes are read.
		const legacy = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:process id="proc">
    <bpmn:callActivity id="call" calledElement="legacy-process" />
    <bpmn:businessRuleTask id="rule" camunda:decisionRef="legacy-decision" />
  </bpmn:process>
</bpmn:definitions>`
		expect(collectReferences(Bpmn.parse(legacy))).toEqual([
			{ elementId: "call", kind: "process", ref: "legacy-process" },
			{ elementId: "rule", kind: "decision", ref: "legacy-decision" },
		])
	})

	it("finds references inside a sub-process", () => {
		const nested = XML.replace(
			'<bpmn:task id="plain" name="Nothing to follow" />',
			`<bpmn:subProcess id="sub"><bpmn:callActivity id="inner">
        <bpmn:extensionElements><zeebe:calledElement processId="inner-process" /></bpmn:extensionElements>
      </bpmn:callActivity></bpmn:subProcess>`,
		)
		expect(collectReferences(Bpmn.parse(nested)).map((r) => r.elementId)).toContain("inner")
	})
})

// ── Plugin ────────────────────────────────────────────────────────────────────

describe("createModelNavigationPlugin", () => {
	it("is named model-navigation", () => {
		const { nav } = mount({ open: () => {} })
		expect(nav.name).toBe("model-navigation")
	})

	it("exposes every reference the model states", () => {
		const { nav } = mount({ open: () => {} })
		expect(nav.api.getReferences().map((r) => r.elementId)).toEqual(["call", "rule", "approve"])
	})

	it("opens a reference through the port", () => {
		const opened: ModelReference[] = []
		const { nav } = mount({ open: (r) => opened.push(r) })
		expect(nav.api.open("call")).toBe(true)
		expect(opened).toEqual([{ elementId: "call", kind: "process", ref: "fulfilment-process" }])
	})

	it("will not open an element that references nothing", () => {
		const opened: ModelReference[] = []
		const { nav } = mount({ open: (r) => opened.push(r) })
		expect(nav.api.open("plain")).toBe(false)
		expect(opened).toEqual([])
	})

	// ── Availability ──────────────────────────────────────────────────────────

	it("treats every reference as available when the host cannot check", () => {
		const { nav, host } = mount({ open: () => {} })
		expect(available(host)).toEqual(["approve", "call", "rule"])
		expect(nav.api.getReference("call")).not.toBeNull()
	})

	it("marks references optimistically before the host answers", () => {
		// A link that appeared late on every diagram would be worse than one that
		// is occasionally wrong for a single round trip.
		const { host } = mount({
			open: () => {},
			resolve: () => new Promise(() => []),
		})
		expect(available(host)).toEqual(["approve", "call", "rule"])
	})

	it("withdraws the ones the host cannot resolve", async () => {
		const { nav, host } = mount({
			open: () => {},
			resolve: (refs) => refs.filter((r) => r.kind !== "form").map((r) => r.elementId),
		})
		await settle()
		expect(available(host)).toEqual(["call", "rule"])
		expect(nav.api.getReference("approve")).toBeNull()
	})

	it("refuses to open a reference the host said does not resolve", async () => {
		const opened: ModelReference[] = []
		const { nav } = mount({
			open: (r) => opened.push(r),
			resolve: () => [],
		})
		await settle()
		expect(nav.api.open("call")).toBe(false)
		expect(opened).toEqual([])
	})

	it("still lists a withdrawn reference, since the model does state it", async () => {
		const { nav } = mount({ open: () => {}, resolve: () => [] })
		await settle()
		expect(nav.api.getReferences().map((r) => r.elementId)).toEqual(["call", "rule", "approve"])
	})

	it("ignores an answer that arrives after the diagram moved on", async () => {
		// Each load starts its own resolve; keep them apart so the *first* one can
		// be answered late, which is the race being tested.
		const resolvers: Array<(ids: readonly string[]) => void> = []
		const { nav, canvas } = mount({
			open: () => {},
			resolve: () => new Promise<readonly string[]>((r) => resolvers.push(r)),
		})
		canvas.load(XML.replace('processId="fulfilment-process"', 'processId="other-process"'))
		expect(resolvers).toHaveLength(2)

		// The stale "nothing resolves" must not withdraw the new diagram's links.
		resolvers[0]?.([])
		await settle()
		expect(nav.api.getReference("call")?.ref).toBe("other-process")
	})

	// ── Keyboard ──────────────────────────────────────────────────────────────

	it("opens the cursor's reference on the bound key", () => {
		const opened: ModelReference[] = []
		const { canvasApi, host } = mount({ open: (r) => opened.push(r) })
		canvasApi.emit("element:click", "rule", new PointerEvent("pointerdown"))
		const event = new KeyboardEvent("keydown", { key: "g", bubbles: true, cancelable: true })
		host.dispatchEvent(event)
		expect(opened.map((r) => r.ref)).toEqual(["risk-score"])
		expect(event.defaultPrevented).toBe(true)
	})

	it("leaves the key alone when the element references nothing", () => {
		const { canvasApi, host } = mount({ open: () => {} })
		canvasApi.emit("element:click", "plain", new PointerEvent("pointerdown"))
		const event = new KeyboardEvent("keydown", { key: "g", bubbles: true, cancelable: true })
		host.dispatchEvent(event)
		expect(event.defaultPrevented).toBe(false)
	})

	it("follows the editor's selection, which is what it reports instead of clicks", () => {
		const opened: ModelReference[] = []
		const { canvasApi, host } = mount({ open: (r) => opened.push(r) })
		const emit = canvasApi.emit as unknown as (event: string, ids: string[]) => void
		emit("editor:select", ["approve"])
		host.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true, cancelable: true }))
		expect(opened.map((r) => r.ref)).toEqual(["approval-form"])
	})

	it("binds nothing when the key is null", () => {
		const opened: ModelReference[] = []
		const { canvasApi, host } = mount({ open: (r) => opened.push(r) }, XML, null)
		canvasApi.emit("element:click", "call", new PointerEvent("pointerdown"))
		host.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true, cancelable: true }))
		expect(opened).toEqual([])
	})

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	it("re-reads references when a different model loads", () => {
		const { nav, canvas } = mount({ open: () => {} })
		canvas.load(XML.replace('processId="fulfilment-process"', 'processId="replaced"'))
		expect(nav.api.getReference("call")?.ref).toBe("replaced")
	})

	it("clears everything when the canvas is destroyed", () => {
		const { nav, canvas } = mount({ open: () => {} })
		canvas.destroy()
		expect(nav.api.getReferences()).toEqual([])
	})
})
