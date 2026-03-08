import { BpmnCanvas } from "@bpmn-sdk/canvas";
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZOOM_CONTROLS_STYLE_ID, createZoomControlsPlugin } from "../../src/zoom-controls/index.js";

// ── Fixture ───────────────────────────────────────────────────────────────────

const SIMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start"/>
    <bpmn:endEvent id="end" name="End"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram1">
    <bpmndi:BPMNPlane id="plane1" bpmnElement="proc">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="100" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="300" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContainer(): HTMLElement {
	const el = document.createElement("div");
	el.style.width = "800px";
	el.style.height = "600px";
	document.body.appendChild(el);
	return el;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createZoomControlsPlugin", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("has name 'zoom-controls'", () => {
		expect(createZoomControlsPlugin().name).toBe("zoom-controls");
	});

	it("injects styles into <head>", () => {
		const container = makeContainer();
		new BpmnCanvas({ container, plugins: [createZoomControlsPlugin()] });
		expect(document.getElementById(ZOOM_CONTROLS_STYLE_ID)).not.toBeNull();
	});

	it("mounts .bpmn-controls inside the canvas host", () => {
		const container = makeContainer();
		new BpmnCanvas({ container, plugins: [createZoomControlsPlugin()] });
		const host = container.querySelector(".bpmn-canvas-host");
		expect(host?.querySelector(".bpmn-controls")).not.toBeNull();
	});

	it("renders three buttons (zoom in, zoom out, fit)", () => {
		const container = makeContainer();
		new BpmnCanvas({ container, plugins: [createZoomControlsPlugin()] });
		const buttons = container.querySelectorAll(".bpmn-control-btn");
		expect(buttons.length).toBe(3);
	});

	it("zoom-in button fires viewport:change with a higher scale", () => {
		const container = makeContainer();
		const canvas = new BpmnCanvas({ container, plugins: [createZoomControlsPlugin()] });
		let newScale = 1;
		canvas.on("viewport:change", (vp) => {
			newScale = vp.scale;
		});
		const btn = container.querySelectorAll<HTMLButtonElement>(".bpmn-control-btn")[0];
		if (!btn) throw new Error("zoom-in button not found");
		btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		vi.runAllTimers();
		expect(newScale).toBeGreaterThan(1);
	});

	it("zoom-out button fires viewport:change with a lower scale", () => {
		const container = makeContainer();
		const canvas = new BpmnCanvas({ container, plugins: [createZoomControlsPlugin()] });
		let newScale = 1;
		canvas.on("viewport:change", (vp) => {
			newScale = vp.scale;
		});
		const btn = container.querySelectorAll<HTMLButtonElement>(".bpmn-control-btn")[1];
		if (!btn) throw new Error("zoom-out button not found");
		btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		vi.runAllTimers();
		expect(newScale).toBeLessThan(1);
	});

	it("removes .bpmn-controls on uninstall (destroy)", () => {
		const container = makeContainer();
		const canvas = new BpmnCanvas({ container, plugins: [createZoomControlsPlugin()] });
		canvas.destroy();
		expect(container.querySelector(".bpmn-controls")).toBeNull();
	});

	it("each plugin instance is independent", () => {
		const c1 = makeContainer();
		const c2 = makeContainer();
		new BpmnCanvas({ container: c1, plugins: [createZoomControlsPlugin()] });
		new BpmnCanvas({ container: c2, plugins: [createZoomControlsPlugin()] });
		expect(c1.querySelector(".bpmn-controls")).not.toBeNull();
		expect(c2.querySelector(".bpmn-controls")).not.toBeNull();
		expect(c1.querySelector(".bpmn-controls")).not.toBe(c2.querySelector(".bpmn-controls"));
	});

	it("fit button fires viewport:change when shapes are loaded", () => {
		const container = makeContainer();
		let changed = false;
		const canvas = new BpmnCanvas({
			container,
			xml: SIMPLE_XML,
			plugins: [createZoomControlsPlugin()],
		});
		canvas.on("viewport:change", () => {
			changed = true;
		});
		const btn = container.querySelectorAll<HTMLButtonElement>(".bpmn-control-btn")[2];
		if (!btn) throw new Error("fit button not found");
		btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		vi.runAllTimers();
		expect(changed).toBe(true);
	});
});
