import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { BpmnCanvas } from "@bpmnkit/canvas"
import { CAMUNDA_CONNECTOR_TEMPLATES } from "@bpmnkit/connectors"
import { Bpmn } from "@bpmnkit/core"
import { BpmnEditor, createTranslationRecorder, initEditorHud } from "@bpmnkit/editor"
import type { CreateShapeType, Translate } from "@bpmnkit/editor"
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { createCommandPaletteEditorPlugin } from "../src/command-palette-editor/index.js"
import { createCommandPalettePlugin } from "../src/command-palette/index.js"
import { createConfigPanelBpmnPlugin } from "../src/config-panel-bpmn/index.js"
import { createConfigPanelPlugin } from "../src/config-panel/index.js"
import { createHistoryPanel } from "../src/history/index.js"
import { createMainMenuPlugin } from "../src/main-menu/index.js"
import { createProcessRunnerPlugin } from "../src/process-runner/index.js"
import { createTabsPlugin } from "../src/tabs/tabs-plugin.js"

/**
 * The plugins' half of the translation catalogue, harvested the way the
 * editor's is (see `packages/editor/tests/i18n-harvest.test.ts`): run the UI
 * with a recording translator and keep what it asks for.
 *
 * The properties panel is where running beats reading. Its labels, hints and
 * placeholders live in schema objects and reach the translator only when the
 * renderer draws them, so the harvest selects one element of every kind and
 * lets the panel ask. A grep for `t("…")` would find the panel's chrome and
 * none of its content.
 *
 * Some strings sit behind paths a headless run does not take (a ternary's
 * other branch, standalone mode, an AI round trip). The literal keys among
 * them are added by scanning the covered sources for `t("…")`, and the rest are
 * named in {@link UNREACHED} with the reason — so the catalogue is complete and
 * every entry is accounted for.
 *
 * Regenerate after changing the UI:
 *
 * ```sh
 * UPDATE_I18N=1 pnpm --filter @bpmnkit/plugins test -- i18n-harvest
 * ```
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const CATALOGUE = join(HERE, "..", "i18n", "en.json")
const SOURCE = join(HERE, "..", "src")

/** The plugins whose UI ships translated. Anything else stays English. */
const COVERED_PLUGINS = [
	"command-palette",
	"command-palette-editor",
	"config-panel",
	"config-panel-bpmn",
	"history",
	"main-menu",
	"process-runner",
	"storage-tabs-bridge",
	"tabs",
] as const

/** Keys only a path this harvest does not drive would ask for, and why. */
const UNREACHED: Record<string, string> = {
	Expand: "standalone config panel only — the harvest mounts it in a container",
	Collapse: "standalone config panel only",
	"Switch to plain string": "shown once a field is already in FEEL mode",
	"Exit Zen Mode": "the other branch of the zen-mode command",
	"Restore grid and toolbars": "the other branch of the zen-mode command",
	"Send to AI assistant": "needs a running AI proxy",
	"Decision models not found: {ids}. Import the DMN in the Models view.":
		"needs a scenario naming two missing decisions",
	"Decision model not found: {ids}. Import the DMN in the Models view.":
		"needs a scenario naming a missing decision",
	"Chaos run: 1 stuck instance, unhandled errors: {count}": "needs a chaos run",
	"Chaos run: completed, unhandled errors: {count}": "needs a chaos run",
	"Add output": "scenario editor with a mocked task selected",
	Yesterday: "a checkpoint from yesterday",
	Today: "a checkpoint from today",
	"Label for new {type} (optional)…": "the third step of a palette command",
	"Connect after which element?": "the second step of a palette command",
	"{count} outgoing": "the second step of a palette command",
}

const XML_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="d" targetNamespace="x">`

/** A start event on its own: every other kind is added from it through the editor. */
const XML = `${XML_HEAD}
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="100" y="80" width="36" height="36"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

const KINDS: CreateShapeType[] = [
	"task",
	"serviceTask",
	"userTask",
	"scriptTask",
	"sendTask",
	"receiveTask",
	"businessRuleTask",
	"manualTask",
	"callActivity",
	"exclusiveGateway",
	"parallelGateway",
	"timerStartEvent",
	"messageStartEvent",
	"signalStartEvent",
	"conditionalStartEvent",
	"endEvent",
	"errorEndEvent",
	"escalationEndEvent",
	"messageEndEvent",
	"signalEndEvent",
	"timerCatchEvent",
	"messageCatchEvent",
	"signalCatchEvent",
	"conditionalCatchEvent",
	"escalationThrowEvent",
	"linkCatchEvent",
	// Last: an element added after a sub-process can land inside it.
	"subProcess",
	"adHocSubProcess",
]

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** Presses every button under `root` once, repeatedly, so menus that open reveal theirs. */
async function pressAll(root: ParentNode, pressed: WeakSet<Element>): Promise<void> {
	for (let pass = 0; pass < 4; pass += 1) {
		const buttons = [...root.querySelectorAll("button")].filter((b) => !pressed.has(b))
		if (buttons.length === 0) return
		for (const button of buttons) {
			pressed.add(button)
			;(button as HTMLElement).click()
		}
		await tick()
	}
}

async function harvestEditorPlugins(translate: Translate): Promise<void> {
	const container = document.createElement("div")
	const panel = document.createElement("div")
	const play = document.createElement("div")
	document.body.append(container, panel, play)

	let editorRef: BpmnEditor | null = null
	const configPanel = createConfigPanelPlugin({
		getDefinitions: () => editorRef?.getDefinitions() ?? null,
		applyChange: (fn) => editorRef?.applyChange(fn),
		container: panel,
		openInPlayground: () => {},
		translate,
	})
	const configPanelBpmn = createConfigPanelBpmnPlugin(configPanel, {
		applyChange: (fn) => editorRef?.applyChange(fn),
		translate,
	})
	const palette = createCommandPalettePlugin({ onAskAI: () => {}, translate })
	const paletteEditor = createCommandPaletteEditorPlugin(palette, () => editorRef, { translate })
	const mainMenu = createMainMenuPlugin({ title: "BPMN Kit", translate })
	const failing = {
		scenarioId: "s1",
		scenarioName: "Happy path",
		passed: false,
		visitedElements: ["start"],
		finalVariables: { total: 1 },
		feelEvals: [{ elementId: "start", property: "x", expression: "1", result: 1 }],
		errors: [{ elementId: "start", message: "boom" }, { message: "boom" }],
		failures: [{ field: "total", expected: 2, actual: 1 }],
		durationMs: 1,
	}
	let listener: ((event: Record<string, unknown>) => void) | undefined
	const runner = createProcessRunnerPlugin({
		engine: {
			deploy: () => {},
			getDeployedProcesses: () => ["proc"],
			start: () => ({
				onChange: (callback: (event: Record<string, unknown>) => void) => {
					listener = callback
					return () => {}
				},
				cancel: () => {},
			}),
		},
		playContainer: play,
		tokenHighlight: {
			api: {
				trackInstance: () => () => {},
				clear: () => {},
				setError: () => {},
				setActive: () => {},
				addVisited: () => {},
			},
		},
		runScenario: () => Promise.resolve(failing),
		generateScenarios: () => Promise.resolve([]),
		getJobType: () => "job",
		onLoadScenarios: () =>
			Promise.resolve([
				{
					id: "s1",
					name: "Happy path",
					inputs: { total: 1 },
					mocks: { job: { outputs: { ok: true } } },
					expect: { variables: { total: 2 } },
				},
			]),
		onSaveScenarios: () => Promise.resolve(),
		onLoadInputVars: () => Promise.resolve([{ name: "total", value: "1" }]),
		onSaveInputVars: () => Promise.resolve(),
		translate,
	} as never)

	const editor = new BpmnEditor({
		container,
		xml: XML,
		fit: "none",
		translate,
		plugins: [configPanel, configPanelBpmn, palette, paletteEditor, mainMenu, runner],
	})
	editorRef = editor
	initEditorHud(editor)

	// ── Properties panel: one element of every kind ─────────────────────────
	const ids: string[] = []
	for (const kind of KINDS) {
		const id = editor.addConnectedElement("start", kind)
		if (id) ids.push(id)
	}
	const flow = editor.getDefinitions()?.processes[0]?.sequenceFlows[0]?.id
	const pressed = new WeakSet<Element>()
	for (const id of [...ids, ...(flow ? [flow] : [])]) {
		editor.setSelection([id])
		await tick()
		// The panel search and the field guide.
		const search = panel.querySelector<HTMLInputElement>(".bpmnkit-cfg-search-input")
		if (search) {
			search.value = "zzzz"
			search.dispatchEvent(new Event("input"))
			search.value = ""
			search.dispatchEvent(new Event("input"))
		}
		for (const trigger of panel.querySelectorAll<HTMLElement>(".bpmnkit-cfg-ss-trigger")) {
			trigger.click()
			const ssSearch = document.querySelector<HTMLInputElement>(".bpmnkit-cfg-ss-search")
			if (ssSearch) {
				ssSearch.value = "zzzz"
				ssSearch.dispatchEvent(new Event("input"))
			}
			trigger.click()
		}
		await pressAll(panel, pressed)
		for (const overlay of document.querySelectorAll(".bpmnkit-val-overlay")) {
			await pressAll(overlay, pressed)
			overlay.remove()
		}
	}

	// ── Command palette and main menu ──────────────────────────────────────
	document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
	await tick()
	const paletteInput = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
	if (paletteInput) {
		paletteInput.value = "gateway"
		paletteInput.dispatchEvent(new Event("input"))
		paletteInput.value = "zzzz nothing"
		paletteInput.dispatchEvent(new Event("input"))
	}
	document.querySelector(".bpmnkit-palette-overlay")?.remove()
	await pressAll(container, pressed)
	for (const dropdown of document.querySelectorAll(".bpmnkit-menu-dropdown")) {
		await pressAll(dropdown, pressed)
	}

	// ── Play mode ───────────────────────────────────────────────────────────
	const { playButton } = runner as unknown as { playButton: HTMLElement }
	playButton.click()
	await tick()
	const { toolbar } = runner as unknown as { toolbar: HTMLElement }
	await pressAll(toolbar, pressed)
	listener?.({ type: "element:entered", elementId: "start", elementType: "startEvent" })
	listener?.({ type: "variable:set", name: "total", value: 1 })
	listener?.({
		type: "feel:evaluated",
		elementId: "start",
		property: "x",
		expression: "1",
		result: 1,
	})
	listener?.({ type: "element:failed", elementId: "start", error: "boom" })
	await tick()
	const scrubber = play.querySelector<HTMLInputElement>("input[type=range]")
	if (scrubber) {
		scrubber.value = "0"
		scrubber.dispatchEvent(new Event("input"))
	}
	for (let round = 0; round < 3; round += 1) {
		await pressAll(play, pressed)
		await tick()
	}

	editor.destroy()
	container.remove()
	panel.remove()
	play.remove()
}

async function harvestTabs(translate: Translate): Promise<void> {
	const container = document.createElement("div")
	document.body.appendChild(container)
	const tabs = createTabsPlugin({
		translate,
		enableFileImport: true,
		onNewDiagram: () => {},
		onDownloadTab: () => {},
		getRecentProjects: () => [],
		examples: [
			{ label: "Order", description: "An order process", badge: "BPMN", onOpen: () => {} },
		],
	} as never)
	new BpmnCanvas({ container, xml: XML, fit: "none", plugins: [tabs] })
	await tick()
	tabs.api.openTab({ type: "bpmn", xml: Bpmn.SAMPLE_XML, name: "Order" })
	await tick()
	const pressed = new WeakSet<Element>()
	await pressAll(document.body, pressed)
	container.remove()
	for (const overlay of document.querySelectorAll(".bpmnkit-close-dialog-overlay")) overlay.remove()
}

async function harvestHistory(translate: Translate): Promise<void> {
	const withoutContext = createHistoryPanel({ loadXml: () => {}, translate })
	await withoutContext.refresh()
	const withContext = createHistoryPanel({
		getCurrentContext: () => ({ projectId: "p", fileId: "f" }),
		loadXml: () => {},
		translate,
	})
	// IndexedDB is not there in happy-dom; the empty state is what renders.
	await withContext.refresh().catch(() => {})
}

/** Keys a grep can see: a literal passed straight to a translator in a covered plugin. */
function staticKeys(): Set<string> {
	const keys = new Set<string>()
	const call = /(?:^|[^\w$])(?:this\._t|tr|t)\(\s*(["'])((?:(?!\1)[^\\]|\\.)*)\1/g
	for (const dir of COVERED_PLUGINS) {
		const root = join(SOURCE, dir)
		for (const file of readdirSync(root)) {
			const path = join(root, file)
			if (!file.endsWith(".ts") || !statSync(path).isFile()) continue
			for (const match of readFileSync(path, "utf8").matchAll(call)) {
				if (match[2] !== undefined) keys.add(match[2])
			}
		}
	}
	return keys
}

/**
 * What the translator is asked for but no locale should translate. Connector
 * template names are product names, and a FEEL or JSON placeholder is code —
 * both are shown as given in every language.
 */
const TEMPLATE_NAMES = new Set(CAMUNDA_CONNECTOR_TEMPLATES.map((template) => template.name))
function isTranslatable(key: string): boolean {
	return !TEMPLATE_NAMES.has(key) && !/^(=|\{"|\d+$)/.test(key)
}

const recorder = createTranslationRecorder()
await harvestEditorPlugins(recorder.translate)
await harvestTabs(recorder.translate)
await harvestHistory(recorder.translate)
const harvested = recorder.keys().filter(isTranslatable)

describe("plugins i18n harvest", () => {
	it("reaches the properties panel's schema strings", () => {
		// Not one of these is a literal passed to `t()` — they only exist as schema data.
		for (const key of ["Timer type", "Message name", "Condition expression (FEEL)", "Loop type"]) {
			expect(harvested).toContain(key)
		}
	})

	it("keeps the catalogue in step with the running plugins", () => {
		const all = new Set([...harvested, ...staticKeys(), ...Object.keys(UNREACHED)])
		const catalogue = Object.fromEntries([...all].sort().map((key) => [key, key] as const))
		const serialised = `${JSON.stringify(catalogue, null, "\t")}\n`
		if (process.env.UPDATE_I18N !== undefined) writeFileSync(CATALOGUE, serialised)
		expect(readFileSync(CATALOGUE, "utf8")).toBe(serialised)
	})

	it("only excuses keys the harvest really does not reach", () => {
		// A key listed as unreached that the harvest now observes should leave the list.
		const seen = new Set(harvested)
		expect(Object.keys(UNREACHED).filter((key) => seen.has(key))).toEqual([])
	})

	it("harvests more than the literal calls a grep would find", () => {
		const grepped = staticKeys()
		const missed = harvested.filter((key) => !grepped.has(key))
		expect(missed.length).toBeGreaterThan(100)
	})
})
