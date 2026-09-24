import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest"
import { createSideDock } from "../src/dock.js"
import { BpmnEditor } from "../src/editor.js"
import { initEditorHud } from "../src/hud.js"
import {
	AVAILABLE_LOCALES,
	type Locale,
	type LocaleMessage,
	createTranslate,
	interpolate,
	matchLocale,
} from "../src/i18n.js"
import { de } from "../src/locales/de.js"
import { es } from "../src/locales/es.js"
import { fr } from "../src/locales/fr.js"
import { it as italian } from "../src/locales/it.js"
import { ja } from "../src/locales/ja.js"
import { nl } from "../src/locales/nl.js"
import { pl } from "../src/locales/pl.js"
import { ptBR } from "../src/locales/pt-BR.js"
import { zhCN } from "../src/locales/zh-CN.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGE = join(HERE, "..")

const LOCALES: Locale[] = [de, es, fr, italian, ja, nl, pl, ptBR, zhCN]

const readCatalogue = (path: string): string[] =>
	Object.keys(JSON.parse(readFileSync(path, "utf8")) as Record<string, string>)

/**
 * Every key a locale must translate: the editor's harvested catalogue, the
 * plugins' (the locales cover both), and the undo names of edits only a pointer
 * gesture makes — a headless harvest cannot drag, so they are listed here.
 */
const POINTER_ONLY = [
	"Add waypoint",
	"Connect",
	"Insert on flow",
	"Move",
	"Move segment",
	"Move waypoint",
	"Reconnect",
	"Resize",
]
const KEYS = new Set([
	...readCatalogue(join(PACKAGE, "i18n", "en.json")),
	...readCatalogue(join(PACKAGE, "..", "plugins", "i18n", "en.json")),
	...POINTER_ONLY,
])

const placeholders = (text: string): string[] =>
	[...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? ""))].sort()

const forms = (message: LocaleMessage): string[] =>
	typeof message === "string" ? [message] : Object.values(message)

describe("createTranslate", () => {
	const locale: Locale = {
		code: "pl",
		name: "Polski",
		messages: {
			Undo: "Cofnij",
			"{name} selected": "Zaznaczono: {name}",
			"{count} elements selected": {
				one: "{count} element",
				few: "{count} elementy",
				many: "{count} elementów",
				other: "{count} elementu",
			},
		},
	}
	const t = createTranslate(locale)

	it("translates known keys and interpolates placeholders", () => {
		expect(t("Undo")).toBe("Cofnij")
		expect(t("{name} selected", { name: "Task" })).toBe("Zaznaczono: Task")
	})

	it("falls back to the English template, still interpolated", () => {
		expect(t("Redo")).toBe("Redo")
		expect(t("{index} of {count}", { index: 1, count: 3 })).toBe("1 of 3")
	})

	it("picks the plural form the language's rules call for", () => {
		expect(t("{count} elements selected", { count: 1 })).toBe("1 element")
		expect(t("{count} elements selected", { count: 3 })).toBe("3 elementy")
		expect(t("{count} elements selected", { count: 5 })).toBe("5 elementów")
		expect(t("{count} elements selected", { count: 22 })).toBe("22 elementy")
		expect(t("{count} elements selected", { count: 1.5 })).toBe("1.5 elementu")
	})

	it("uses `other` when there is no count to choose by", () => {
		expect(t("{count} elements selected")).toBe("{count} elementu")
	})
})

describe("matchLocale", () => {
	const codes = AVAILABLE_LOCALES.map((l) => l.code)

	it("prefers an exact tag, then the language alone", () => {
		expect(matchLocale(["pt-BR"], codes)).toBe("pt-BR")
		expect(matchLocale(["pt-PT"], codes)).toBe("pt-BR")
		expect(matchLocale(["zh"], codes)).toBe("zh-CN")
		expect(matchLocale(["de-AT", "en"], codes)).toBe("de")
	})

	it("walks the preference list in order and reports no match", () => {
		expect(matchLocale(["sv", "fr-CA"], codes)).toBe("fr")
		expect(matchLocale(["sv", "fi"], codes)).toBeUndefined()
	})
})

describe("shipped locales", () => {
	it("lists every locale file, and exports each from the package", () => {
		const files = readdirSync(join(PACKAGE, "src", "locales"))
			.map((file) => file.replace(/\.ts$/, ""))
			.sort()
		const listed = AVAILABLE_LOCALES.map((l) => l.code)
			.filter((code) => code !== "en")
			.sort()
		expect(files).toEqual(listed)
		expect(LOCALES.map((l) => l.code).sort()).toEqual(listed)

		const manifest = JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8")) as {
			exports: Record<string, unknown>
		}
		for (const code of listed) expect(manifest.exports).toHaveProperty(`./locales/${code}`)
	})

	for (const locale of LOCALES) {
		describe(locale.code, () => {
			const messages = locale.messages

			it("translates every key the UI asks for, and nothing else", () => {
				expect([...KEYS].filter((key) => !(key in messages))).toEqual([])
				expect(Object.keys(messages).filter((key) => !KEYS.has(key))).toEqual([])
			})

			it("keeps every placeholder of every key", () => {
				for (const [key, message] of Object.entries(messages)) {
					for (const form of forms(message)) {
						expect(placeholders(form), `${locale.code}: ${key}`).toEqual(placeholders(key))
					}
				}
			})

			it("gives each plural entry every form its language uses for a count", () => {
				// Counts of things on a canvas, not millions: French and Spanish have a
				// `many` form, but only for numbers like 1 000 000, which falls back to `other`.
				const rules = new Intl.PluralRules(locale.code)
				const categories = new Set(Array.from({ length: 200 }, (_, n) => rules.select(n)))
				for (const [key, message] of Object.entries(messages)) {
					if (typeof message === "string") continue
					for (const category of categories) {
						expect(message, `${locale.code}: ${key}`).toHaveProperty(category)
					}
				}
			})

			it("names itself the way the picker lists it", () => {
				expect(AVAILABLE_LOCALES.find((l) => l.code === locale.code)?.name).toBe(locale.name)
			})
		})
	}
})

// ── Rendering ────────────────────────────────────────────────────────────────

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="d" targetNamespace="x">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Order received"/>
    <bpmn:serviceTask id="task" name="Check stock"/>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="task"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="100" y="80" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s2" bpmnElement="task"><dc:Bounds x="200" y="60" width="100" height="80"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

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

describe("the editor, rendered in each locale", () => {
	afterEach(() => {
		document.body.innerHTML = ""
	})

	for (const locale of LOCALES) {
		it(`${locale.code}: shows no English the locale translates`, () => {
			const container = document.createElement("div")
			document.body.appendChild(container)
			const translate = createTranslate(locale)
			const editor = new BpmnEditor({ container, xml: XML, fit: "none", translate })
			const hud = initEditorHud(editor)
			const dock = createSideDock({ translate })
			document.body.appendChild(dock.el)

			editor.setSelection(["task"])
			hud.showOnboarding()
			hud.setSimulationActive(true)

			// An English template still on screen is a string that bypassed the
			// translator — unless the locale spells it the same way ("Gateways").
			const leaked = uiStrings(document.body).filter((text) => {
				const message = locale.messages[text]
				return message !== undefined && !forms(message).includes(text)
			})
			expect(leaked).toEqual([])
			expect(editor.container.querySelector("#btn-undo")?.getAttribute("title")).toBe(
				createTranslate(locale)("Undo (Ctrl+Z)"),
			)
			editor.destroy()
		})
	}
})

/**
 * Pseudo-localisation: a translator that brackets everything it is given. Text
 * on screen without the brackets never reached the translator — which finds the
 * strings a catalogue check cannot, because they are not keys yet.
 */
const pseudo = (template: string, vars?: Record<string, string | number>): string =>
	`⟦${interpolate(template, vars)}⟧`

describe("the editor, pseudo-localised", () => {
	afterEach(() => {
		document.body.innerHTML = ""
	})

	it("routes every visible string through the translator", () => {
		const container = document.createElement("div")
		document.body.appendChild(container)
		const editor = new BpmnEditor({ container, xml: XML, fit: "none", translate: pseudo })
		const hud = initEditorHud(editor, { getAvailableProcesses: () => [] })
		const dock = createSideDock({ translate: pseudo })
		document.body.appendChild(dock.el)

		const shown = new Set<string>()
		const collect = (): void => {
			for (const text of uiStrings(document.body)) shown.add(text)
		}
		const click = (selector: string): void => {
			document.querySelector<HTMLElement>(selector)?.click()
		}
		const rightClick = (): void => {
			container.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }))
		}

		editor.setSelection(["task"])
		collect()
		click("#cfg-toolbar .hud-btn")
		collect()
		rightClick()
		collect()
		editor.setSelection(["task", "start"])
		click("#btn-top-more")
		collect()
		click("#btn-zoom-pct")
		collect()
		editor.setSelection([])
		rightClick()
		hud.showOnboarding()
		hud.setSimulationActive(true)
		collect()

		const bypassed = [...shown].filter((text) => /[A-Za-z]{2,}/.test(text) && !text.includes("⟦"))
		expect(bypassed).toEqual([])
		editor.destroy()
	})
})
