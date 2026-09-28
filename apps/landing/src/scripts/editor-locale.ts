import {
	AVAILABLE_LOCALES,
	type Locale,
	type Translate,
	createTranslate,
	matchLocale,
} from "@bpmnkit/editor"

/**
 * The editor's language: the one the visitor picked, else the browser's, else
 * English.
 *
 * Each locale is its own chunk, fetched only for the language in use — a
 * German visitor downloads German and nothing else, and an English one
 * downloads no strings at all.
 */

const STORAGE_KEY = "bpmnkit-editor-locale"

const LOADERS: Record<string, () => Promise<Locale>> = {
	de: () => import("@bpmnkit/editor/locales/de").then((m) => m.de),
	es: () => import("@bpmnkit/editor/locales/es").then((m) => m.es),
	fr: () => import("@bpmnkit/editor/locales/fr").then((m) => m.fr),
	it: () => import("@bpmnkit/editor/locales/it").then((m) => m.it),
	ja: () => import("@bpmnkit/editor/locales/ja").then((m) => m.ja),
	nl: () => import("@bpmnkit/editor/locales/nl").then((m) => m.nl),
	pl: () => import("@bpmnkit/editor/locales/pl").then((m) => m.pl),
	"pt-BR": () => import("@bpmnkit/editor/locales/pt-BR").then((m) => m.ptBR),
	"zh-CN": () => import("@bpmnkit/editor/locales/zh-CN").then((m) => m.zhCN),
}

const CODES = AVAILABLE_LOCALES.map((l) => l.code)

function storedChoice(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEY)
	} catch {
		// Storage blocked (private mode, sandboxed frame): fall back to the browser's language.
		return null
	}
}

/** Remembers the visitor's pick for the next visit. */
export function storeEditorLocale(code: string): void {
	try {
		localStorage.setItem(STORAGE_KEY, code)
	} catch {
		// Storage blocked: the choice lasts for this page only.
	}
}

/** Resolves the language to start in and loads its strings; `translate` is unset for English. */
export async function loadEditorLocale(): Promise<{ code: string; translate?: Translate }> {
	const stored = storedChoice()
	const code =
		(stored !== null && CODES.includes(stored) ? stored : undefined) ??
		matchLocale(navigator.languages ?? [navigator.language], CODES) ??
		"en"
	const load = LOADERS[code]
	if (!load) return { code: "en" }
	try {
		return { code, translate: createTranslate(await load()) }
	} catch {
		// A chunk that failed to load leaves the editor usable in English.
		return { code: "en" }
	}
}
