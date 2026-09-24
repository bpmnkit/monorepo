import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { BpmnCanvas } from "@bpmnkit/canvas"
import {
	BpmnEditor,
	type Locale,
	type LocaleMessage,
	createTranslate,
	interpolate,
} from "@bpmnkit/editor"
import { de } from "@bpmnkit/editor/locales/de"
import { es } from "@bpmnkit/editor/locales/es"
import { fr } from "@bpmnkit/editor/locales/fr"
import { it as italian } from "@bpmnkit/editor/locales/it"
import { ja } from "@bpmnkit/editor/locales/ja"
import { nl } from "@bpmnkit/editor/locales/nl"
import { pl } from "@bpmnkit/editor/locales/pl"
import { ptBR } from "@bpmnkit/editor/locales/pt-BR"
import { zhCN } from "@bpmnkit/editor/locales/zh-CN"
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest"
import { createCommandPaletteEditorPlugin } from "../src/command-palette-editor/index.js"
import { createCommandPalettePlugin } from "../src/command-palette/index.js"
import { createConfigPanelBpmnPlugin } from "../src/config-panel-bpmn/index.js"
import { createConfigPanelPlugin } from "../src/config-panel/index.js"
import { createHistoryPanel } from "../src/history/index.js"
import { createMainMenuPlugin } from "../src/main-menu/index.js"
import { createProcessRunnerPlugin } from "../src/process-runner/index.js"
import { createTabsPlugin } from "../src/tabs/tabs-plugin.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGES = join(HERE, "..", "..")

/**
 * The UI modules whose strings ship translated. A new user-visible literal in
 * one of them is a string every non-English user sees in English.
 */
const COVERED = [
	"editor/src",
	"plugins/src/command-palette",
	"plugins/src/command-palette-editor",
	"plugins/src/config-panel",
	"plugins/src/config-panel-bpmn",
	"plugins/src/history",
	"plugins/src/main-menu",
	"plugins/src/process-runner",
	"plugins/src/storage-tabs-bridge",
	"plugins/src/tabs",
]

/** Where a literal reaches the screen without passing a translator. */
const SINKS = [
	/\.(?:textContent|title|placeholder|innerText|innerHTML)\s*=\s*(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g,
	/setAttribute\(\s*"(?:title|aria-label|placeholder|alt)"\s*,\s*(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g,
	/createTextNode\(\s*(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g,
]

/** Removes `${…}` (balanced), markup, entities and escapes — what is left is prose. */
function prose(literal: string): string {
	let out = ""
	let depth = 0
	for (let i = 0; i < literal.length; i += 1) {
		if (depth === 0 && literal[i] === "$" && literal[i + 1] === "{") {
			depth = 1
			i += 1
		} else if (depth > 0) {
			if (literal[i] === "{") depth += 1
			if (literal[i] === "}") depth -= 1
		} else {
			out += literal[i]
		}
	}
	return out
		.replace(/<[^>]*>/g, " ")
		.replace(/&\w+;/g, " ")
		.replace(/\\u[0-9a-fA-F]{4}/g, " ")
}

function sourceFiles(dir: string): string[] {
	const root = join(PACKAGES, dir)
	return readdirSync(root)
		.map((file) => join(root, file))
		.filter((path) => statSync(path).isFile() && path.endsWith(".ts") && !path.endsWith("css.ts"))
}

/** Hard-coded English in `source`, as `line: literal`. */
function hardCoded(source: string): string[] {
	const found: string[] = []
	const lines = source.split("\n")
	for (const sink of SINKS) {
		for (const match of source.matchAll(sink)) {
			const text = match[2] ?? ""
			if (!/[A-Za-z]{2,}/.test(prose(text))) continue
			const line = source.slice(0, match.index).split("\n").length
			// A `<style>` element's text is CSS, not UI.
			if (/\bstyle\.textContent\s*=\s*$/.test(source.slice(0, (match.index ?? 0) + 20))) continue
			if (source.slice(Math.max(0, (match.index ?? 0) - 12), match.index).includes("style"))
				continue
			// An explicit, reasoned exemption on the line above.
			if ((lines[line - 2] ?? "").includes("i18n-ignore:")) continue
			found.push(`${line}: ${text.slice(0, 80)}`)
		}
	}
	return found
}

describe("no hard-coded English in covered UI modules", () => {
	it("catches a literal written straight to the screen", () => {
		expect(hardCoded('btn.title = "Delete element"')).toHaveLength(1)
		expect(hardCoded('el.setAttribute("aria-label", "Close panel")')).toHaveLength(1)
		expect(hardCoded("el.textContent = `Run all (${n})`")).toHaveLength(1)
		expect(hardCoded('btn.title = t("Delete element")')).toEqual([])
		expect(hardCoded('btn.textContent = "×"')).toEqual([])
		expect(hardCoded('el.textContent = `\\u25B6 ${t("Run", { n: 1 })}`')).toEqual([])
	})

	for (const dir of COVERED) {
		for (const file of sourceFiles(dir)) {
			it(relative(PACKAGES, file), () => {
				expect(hardCoded(readFileSync(file, "utf8"))).toEqual([])
			})
		}
	}
})

// ── The properties panel, rendered in each locale ────────────────────────────

const LOCALES: Locale[] = [de, es, fr, italian, ja, nl, pl, ptBR, zhCN]

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="d" targetNamespace="x">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Order received"><bpmn:timerEventDefinition/></bpmn:startEvent>
    <bpmn:serviceTask id="task" name="Check stock"/>
    <bpmn:subProcess id="sub" name="Each line"/>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="task"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="100" y="80" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s2" bpmnElement="task"><dc:Bounds x="200" y="60" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s3" bpmnElement="sub"><dc:Bounds x="360" y="40" width="200" height="120"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

const forms = (message: LocaleMessage): string[] =>
	typeof message === "string" ? [message] : Object.values(message)

/** Every string a user can read or hear under `root` — the diagram's own labels aside. */
function uiStrings(root: Element): string[] {
	const out: string[] = []
	for (const el of [root, ...root.querySelectorAll("*")]) {
		if (el.closest("svg")) continue
		for (const attr of ["title", "placeholder", "aria-label"]) {
			const value = el.getAttribute(attr)
			if (value) out.push(value)
		}
		for (const node of el.childNodes) {
			const text = node.nodeType === 3 ? node.textContent?.trim() : ""
			if (text) out.push(text)
		}
	}
	return out
}

describe("the properties panel, rendered in each locale", () => {
	afterEach(() => {
		document.body.innerHTML = ""
	})

	for (const locale of LOCALES) {
		it(`${locale.code}: shows no English the locale translates`, () => {
			const translate = createTranslate(locale)
			const container = document.createElement("div")
			const panel = document.createElement("div")
			document.body.append(container, panel)
			let editor: BpmnEditor | null = null
			const configPanel = createConfigPanelPlugin({
				getDefinitions: () => editor?.getDefinitions() ?? null,
				applyChange: (fn) => editor?.applyChange(fn),
				container: panel,
				openInPlayground: () => {},
				translate,
			})
			const bpmn = createConfigPanelBpmnPlugin(configPanel, { translate })
			editor = new BpmnEditor({
				container,
				xml: XML,
				fit: "none",
				translate,
				plugins: [configPanel, bpmn],
			})

			const shown: string[] = []
			for (const id of ["start", "task", "sub"]) {
				editor.setSelection([id])
				shown.push(...uiStrings(panel))
			}
			const leaked = shown.filter((text) => {
				const message = locale.messages[text]
				return message !== undefined && !forms(message).includes(text)
			})
			expect(leaked).toEqual([])
			expect(shown).toContain(translate("Timer type"))
			expect(shown).toContain(translate("Service Task"))
			editor.destroy()
		})
	}
})

/**
 * Pseudo-localisation: every string the translator is given comes back in
 * brackets, so text on screen without them never reached it — including text
 * no catalogue knows about yet.
 */
const pseudo = (template: string, vars?: Record<string, string | number>): string =>
	`⟦${interpolate(template, vars)}⟧`

/**
 * Shown as given in every language: the expression language and its type name,
 * a key cap, the wordmark, and the test diagram's own labels. The last two are
 * the read-only `@bpmnkit/canvas` viewer's labels, which the start page's bare
 * canvas carries and the editor replaces with its own — the viewer has no
 * translation hook.
 */
const AS_GIVEN = new Set([
	"FEEL",
	"string",
	"Esc",
	"bpmn",
	"kit",
	"Order received",
	"Check stock",
	"Each line",
	"BPMN Diagram",
	"Diagram plane",
])

const bypassed = (texts: Iterable<string>): string[] =>
	[...new Set(texts)].filter(
		(text) => /[A-Za-z]{2,}/.test(text) && !text.includes("⟦") && !AS_GIVEN.has(text),
	)

describe("the plugins, pseudo-localised", () => {
	afterEach(() => {
		document.body.innerHTML = ""
	})

	it("routes the properties panel, palette, menu and play mode through the translator", async () => {
		const container = document.createElement("div")
		const panel = document.createElement("div")
		const play = document.createElement("div")
		document.body.append(container, panel, play)
		let editor: BpmnEditor | null = null
		const configPanel = createConfigPanelPlugin({
			getDefinitions: () => editor?.getDefinitions() ?? null,
			applyChange: (fn) => editor?.applyChange(fn),
			container: panel,
			openInPlayground: () => {},
			translate: pseudo,
		})
		const bpmn = createConfigPanelBpmnPlugin(configPanel, { translate: pseudo })
		const palette = createCommandPalettePlugin({ translate: pseudo })
		const paletteEditor = createCommandPaletteEditorPlugin(palette, () => editor, {
			translate: pseudo,
		})
		const menu = createMainMenuPlugin({ translate: pseudo })
		const runner = createProcessRunnerPlugin({
			engine: { deploy: () => {}, getDeployedProcesses: () => ["proc"], start: () => ({}) },
			playContainer: play,
			tokenHighlight: {
				api: { trackInstance: () => () => {}, clear: () => {}, setError: () => {} },
			},
			runScenario: () => Promise.resolve({}),
			onLoadScenarios: () => Promise.resolve([]),
			onLoadInputVars: () => Promise.resolve([]),
			translate: pseudo,
		} as never)
		editor = new BpmnEditor({
			container,
			xml: XML,
			fit: "none",
			translate: pseudo,
			plugins: [configPanel, bpmn, palette, paletteEditor, menu, runner],
		})

		const shown: string[] = []
		for (const id of ["start", "task", "sub"]) {
			editor.setSelection([id])
			shown.push(...uiStrings(panel))
		}
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
		container.querySelector<HTMLElement>(".bpmnkit-main-menu-panel button")?.click()
		shown.push(...uiStrings(document.body))
		;(runner as unknown as { playButton: HTMLElement }).playButton.click()
		await new Promise((resolve) => setTimeout(resolve, 0))
		for (const tab of play.querySelectorAll<HTMLElement>("button")) tab.click()
		shown.push(
			...uiStrings(play),
			...uiStrings((runner as unknown as { toolbar: Element }).toolbar),
		)

		expect(bypassed(shown)).toEqual([])
		expect(shown.some((text) => text.includes("Timer type"))).toBe(true)
		editor.destroy()
	})

	it("routes the start page and the history panel through the translator", async () => {
		const container = document.createElement("div")
		document.body.appendChild(container)
		const tabs = createTabsPlugin({ translate: pseudo, enableFileImport: true })
		new BpmnCanvas({ container, fit: "none", plugins: [tabs] })
		const history = createHistoryPanel({ loadXml: () => {}, translate: pseudo })
		await history.refresh()
		expect(bypassed([...uiStrings(container), ...uiStrings(history.el)])).toEqual([])
	})
})
