import type { CanvasApi } from "@bpmn-sdk/canvas";
import type { BpmnDefinitions } from "@bpmn-sdk/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConfigPanelPlugin } from "../../src/config-panel/index.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeApi(): CanvasApi {
	const container = document.createElement("div");
	document.body.appendChild(container);
	return {
		container,
		svg: document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement,
		viewportEl: document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement,
		getViewport: () => ({ tx: 0, ty: 0, scale: 1 }),
		setViewport: vi.fn(),
		getShapes: () => [],
		getEdges: () => [],
		getTheme: () => "dark" as const,
		setTheme: vi.fn(),
		on: (_event: unknown, _handler: unknown) => () => {},
		emit: vi.fn(),
	};
}

beforeEach(() => {
	document.body.innerHTML = "";
	document.head.innerHTML = "";
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("createConfigPanelPlugin", () => {
	it("returns a plugin with the correct name", () => {
		const plugin = createConfigPanelPlugin({
			getDefinitions: () => null,
			applyChange: vi.fn(),
		});
		expect(plugin.name).toBe("config-panel");
	});

	it("installs and uninstalls without errors", () => {
		const plugin = createConfigPanelPlugin({
			getDefinitions: () => null,
			applyChange: vi.fn(),
		});
		const api = makeApi();
		expect(() => plugin.install(api)).not.toThrow();
		expect(() => plugin.uninstall?.()).not.toThrow();
	});

	it("injects styles on install", () => {
		const plugin = createConfigPanelPlugin({
			getDefinitions: () => null,
			applyChange: vi.fn(),
		});
		plugin.install(makeApi());
		expect(document.getElementById("bpmn-config-panel-styles-v1")).not.toBeNull();
	});

	it("registerSchema stores schema before install", () => {
		const plugin = createConfigPanelPlugin({
			getDefinitions: () => null,
			applyChange: vi.fn(),
		});
		const schema = {
			compact: [{ key: "name", label: "Name", type: "text" as const }],
			groups: [],
		};
		const adapter = {
			read: () => ({}),
			write: (defs: BpmnDefinitions) => defs,
		};
		// Should not throw even before install
		expect(() => plugin.registerSchema("startEvent", schema, adapter)).not.toThrow();
	});

	it("shows inspector panel when element with registered schema is selected", () => {
		let selectHandler: ((ids: string[]) => void) | null = null;
		const api: CanvasApi = {
			...makeApi(),
			on(event: unknown, handler: unknown) {
				if (event === "editor:select") selectHandler = handler as (ids: string[]) => void;
				return () => {};
			},
			getShapes: () => [
				{
					id: "el1",
					element: document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement,
					shape: {
						id: "el1_di",
						bpmnElement: "el1",
						bounds: { x: 0, y: 0, width: 100, height: 80 },
						unknownAttributes: {},
					},
					flowElement: {
						id: "el1",
						type: "startEvent",
						name: "Start",
						incoming: [],
						outgoing: [],
						extensionElements: [],
						unknownAttributes: {},
						eventDefinitions: [],
					},
				},
			],
		};

		const plugin = createConfigPanelPlugin({
			getDefinitions: () => null,
			applyChange: vi.fn(),
		});
		plugin.registerSchema(
			"startEvent",
			{
				compact: [{ key: "name", label: "Name", type: "text" }],
				groups: [
					{
						id: "general",
						label: "General",
						fields: [{ key: "name", label: "Name", type: "text" }],
					},
				],
			},
			{
				read: (_defs, _id) => ({ name: "Start" }),
				write: (defs, _id, _values) => defs,
			},
		);
		plugin.install(api);

		// Trigger selection
		selectHandler?.(["el1"]);

		const panel = document.querySelector(".bpmn-cfg-full");
		expect(panel).not.toBeNull();
	});
});
