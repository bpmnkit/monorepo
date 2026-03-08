import type { CanvasApi } from "@bpmn-sdk/canvas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCommandPalettePlugin } from "../../src/command-palette/index.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeApi(theme: "dark" | "light" = "dark"): CanvasApi {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	return {
		container,
		svg: svg as unknown as SVGSVGElement,
		viewportEl: document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement,
		getViewport: () => ({ tx: 0, ty: 0, scale: 1 }),
		setViewport: vi.fn(),
		getShapes: () => [],
		getEdges: () => [],
		getTheme: () => theme,
		setTheme: vi.fn(),
		on: (_event: unknown, _handler: unknown) => () => {},
		emit: vi.fn(),
	};
}

function ctrlK(): void {
	document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
}

function pressEscape(): void {
	const overlay = document.querySelector(".bpmn-palette-overlay");
	overlay?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

// Track plugins so we can uninstall after each test to prevent listener leaks
let installed: Array<ReturnType<typeof createCommandPalettePlugin>> = [];

function install(theme: "dark" | "light" = "dark") {
	const plugin = createCommandPalettePlugin();
	plugin.install(makeApi(theme));
	installed.push(plugin);
	return plugin;
}

beforeEach(() => {
	document.body.innerHTML = "";
	document.head.innerHTML = "";
	installed = [];
});

afterEach(() => {
	for (const p of installed) p.uninstall?.();
	installed = [];
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("createCommandPalettePlugin", () => {
	it("installs and uninstalls without error", () => {
		const plugin = createCommandPalettePlugin();
		const api = makeApi();
		expect(() => plugin.install(api)).not.toThrow();
		expect(() => plugin.uninstall?.()).not.toThrow();
	});

	it("opens palette on Ctrl+K after install", () => {
		install();
		expect(document.querySelector(".bpmn-palette-overlay")).toBeNull();
		ctrlK();
		expect(document.querySelector(".bpmn-palette-overlay")).not.toBeNull();
	});

	it("closes palette on second Ctrl+K", () => {
		install();
		ctrlK();
		expect(document.querySelector(".bpmn-palette-overlay")).not.toBeNull();
		ctrlK();
		expect(document.querySelector(".bpmn-palette-overlay")).toBeNull();
	});

	it("closes palette on Escape", () => {
		install();
		ctrlK();
		expect(document.querySelector(".bpmn-palette-overlay")).not.toBeNull();
		pressEscape();
		expect(document.querySelector(".bpmn-palette-overlay")).toBeNull();
	});

	it("closes palette on backdrop click", () => {
		install();
		ctrlK();
		const overlay = document.querySelector(".bpmn-palette-overlay");
		if (!overlay) throw new Error("overlay not found");
		overlay.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
		expect(document.querySelector(".bpmn-palette-overlay")).toBeNull();
	});

	it("shows built-in commands when open", () => {
		install();
		ctrlK();
		const items = document.querySelectorAll(".bpmn-palette-item");
		expect(items.length).toBeGreaterThanOrEqual(5); // 5 built-in commands
	});

	it("filters commands by query", () => {
		install();
		ctrlK();
		const input = document.querySelector<HTMLInputElement>(".bpmn-palette-input");
		if (!input) throw new Error("input not found");
		input.value = "zoom";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		const items = document.querySelectorAll(".bpmn-palette-item");
		// "Zoom to 100%" and "Zoom to Fit" match
		expect(items.length).toBe(2);
	});

	it("shows empty message for unmatched query", () => {
		install();
		ctrlK();
		const input = document.querySelector<HTMLInputElement>(".bpmn-palette-input");
		if (!input) throw new Error("input not found");
		input.value = "xyzzy-no-match";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		const empty = document.querySelector(".bpmn-palette-empty");
		expect(empty).not.toBeNull();
	});

	it("addCommands registers commands that appear in the list", () => {
		const plugin = install();
		plugin.addCommands([{ id: "custom", title: "Custom Action", action: vi.fn() }]);
		ctrlK();
		const input = document.querySelector<HTMLInputElement>(".bpmn-palette-input");
		if (!input) throw new Error("input not found");
		input.value = "custom";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		const items = document.querySelectorAll(".bpmn-palette-item");
		expect(items.length).toBe(1);
		expect(items[0]?.textContent).toContain("Custom Action");
	});

	it("addCommands returns a deregister function", () => {
		const plugin = install();
		const deregister = plugin.addCommands([
			{ id: "custom", title: "Custom Action", action: vi.fn() },
		]);
		deregister();
		ctrlK();
		const input = document.querySelector<HTMLInputElement>(".bpmn-palette-input");
		if (!input) throw new Error("input not found");
		input.value = "custom";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		expect(document.querySelector(".bpmn-palette-empty")).not.toBeNull();
	});

	it("zen mode toggles container class and calls onZenModeChange", () => {
		const onZenModeChange = vi.fn();
		const plugin = createCommandPalettePlugin({ onZenModeChange });
		const api = makeApi();
		plugin.install(api);
		installed.push(plugin);
		ctrlK();
		const input = document.querySelector<HTMLInputElement>(".bpmn-palette-input");
		if (!input) throw new Error("input not found");
		input.value = "zen";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		const zenItem = document.querySelector<HTMLDivElement>(".bpmn-palette-item");
		if (!zenItem) throw new Error("zen item not found");
		zenItem.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
		expect(api.container.classList.contains("bpmn-zen-mode")).toBe(true);
		expect(onZenModeChange).toHaveBeenCalledWith(true);
	});

	it("injects styles into document.head", () => {
		install();
		expect(document.getElementById("bpmn-command-palette-styles-v1")).not.toBeNull();
	});

	it("applies light theme class when theme is light", () => {
		install("light");
		ctrlK();
		const overlay = document.querySelector(".bpmn-palette-overlay");
		expect(overlay?.classList.contains("bpmn-palette--light")).toBe(true);
	});

	it("uninstall closes open palette and cleans up", () => {
		const plugin = install();
		ctrlK();
		expect(document.querySelector(".bpmn-palette-overlay")).not.toBeNull();
		plugin.uninstall?.();
		// remove from installed so afterEach doesn't double-uninstall
		installed = installed.filter((p) => p !== plugin);
		expect(document.querySelector(".bpmn-palette-overlay")).toBeNull();
		// Ctrl+K should no longer open palette after uninstall
		ctrlK();
		expect(document.querySelector(".bpmn-palette-overlay")).toBeNull();
	});
});
