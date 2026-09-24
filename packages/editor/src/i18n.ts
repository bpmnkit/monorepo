/** Interpolation variables for a translation template. */
export type TranslateVars = Record<string, string | number>

/**
 * A translation hook. Receives an English template string (used as the lookup
 * key) plus optional `{name}` interpolation variables and returns the localized
 * string. Keys that are not localized should be returned unchanged (after
 * interpolation) — {@link defaultTranslate} does exactly that.
 */
export type Translate = (template: string, vars?: TranslateVars) => string

/** Fills `{name}` placeholders in `template` from `vars`. */
export function interpolate(template: string, vars?: TranslateVars): string {
	if (!vars) return template
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in vars ? String(vars[key]) : match,
	)
}

/** The default (identity) translator: no localization, just placeholder interpolation. */
export function defaultTranslate(template: string, vars?: TranslateVars): string {
	return interpolate(template, vars)
}

/**
 * A translator that also records what it was asked for.
 *
 * Localising a UI starts with knowing which strings it has, and the usual
 * answer — grep the source for the translation call — produces a list nobody
 * can trust: it includes strings behind code that no longer runs, and misses
 * any built by concatenation. Harvesting from a *running* editor inverts that.
 * Every key it observes is real by construction, and a key the harvest never
 * observes is either dead or reachable only through a path the harvest does
 * not exercise. Both are worth knowing, and neither is knowable from the
 * source alone.
 *
 * @param base - The translator to delegate to. Defaults to identity, which is
 *   what a harvest wants; pass a real one to record a live session instead.
 *
 * @example
 * ```typescript
 * const recorder = createTranslationRecorder();
 * const editor = new BpmnEditor({ container, translate: recorder.translate });
 * initEditorHud(editor);
 * recorder.keys(); // every string the editor asked for while starting up
 * ```
 */
export function createTranslationRecorder(base: Translate = defaultTranslate): TranslationRecorder {
	// Insertion-ordered, so the harvest reads in the order the UI asks.
	const seen = new Map<string, Set<string>>()

	return {
		translate(template, vars) {
			const names = seen.get(template) ?? new Set<string>()
			for (const name of Object.keys(vars ?? {})) names.add(name)
			seen.set(template, names)
			return base(template, vars)
		},
		keys() {
			return [...seen.keys()]
		},
		placeholders(template) {
			return [...(seen.get(template) ?? [])].sort()
		},
		reset() {
			seen.clear()
		},
	}
}

/** A {@link Translate} that remembers every template it was given. */
export interface TranslationRecorder {
	/** Pass this to the editor as its `translate` option. */
	translate: Translate
	/** Every template requested, in the order it was first asked for. */
	keys(): string[]
	/** The interpolation variables a template was given, sorted. */
	placeholders(template: string): string[]
	/** Forgets everything observed so far. */
	reset(): void
}

/**
 * A message whose wording depends on a number. Selected with `Intl.PluralRules`
 * from the `count` variable, so each language supplies only the categories its
 * grammar has — Polish needs `one`, `few` and `many`; Japanese only `other`.
 */
export type PluralMessage = Partial<Record<Exclude<Intl.LDMLPluralRule, "other">, string>> & {
	other: string
}

/** One translated message: plain text, or plural forms keyed by CLDR category. */
export type LocaleMessage = string | PluralMessage

/**
 * A shipped translation of the editor and its first-party plugins.
 *
 * Keys are the English templates the UI asks for (see {@link Translate}), so a
 * locale is plain data: it can be imported per language and tree-shaken, and a
 * key it lacks falls back to English rather than to a blank.
 */
export interface Locale {
	/** BCP 47 tag, e.g. `"de"` or `"pt-BR"`. Also selects the plural rules. */
	code: string
	/** The language's own name for itself, for a language picker. */
	name: string
	messages: Readonly<Record<string, LocaleMessage>>
}

/**
 * Builds a {@link Translate} from a {@link Locale}.
 *
 * Missing keys fall back to the English template, and `{name}` placeholders are
 * interpolated either way. A {@link PluralMessage} picks its form from
 * `vars.count`.
 *
 * @example
 * ```typescript
 * import { BpmnEditor, createTranslate } from "@bpmnkit/editor";
 * import { de } from "@bpmnkit/editor/locales/de";
 *
 * const editor = new BpmnEditor({ container, translate: createTranslate(de) });
 * ```
 */
export function createTranslate(locale: Locale): Translate {
	const rules = new Intl.PluralRules(locale.code)
	return (template, vars) => {
		const message = locale.messages[template]
		if (message === undefined) return interpolate(template, vars)
		if (typeof message === "string") return interpolate(message, vars)
		const count = Number(vars?.count)
		const form = Number.isFinite(count) ? message[rules.select(count)] : undefined
		return interpolate(form ?? message.other, vars)
	}
}

/** The languages `@bpmnkit/editor/locales/*` ships, by code, with their own names. */
export const AVAILABLE_LOCALES: ReadonlyArray<{ code: string; name: string }> = [
	{ code: "en", name: "English" },
	{ code: "de", name: "Deutsch" },
	{ code: "es", name: "Español" },
	{ code: "fr", name: "Français" },
	{ code: "it", name: "Italiano" },
	{ code: "nl", name: "Nederlands" },
	{ code: "pl", name: "Polski" },
	{ code: "pt-BR", name: "Português (Brasil)" },
	{ code: "ja", name: "日本語" },
	{ code: "zh-CN", name: "简体中文" },
]

/**
 * Picks the best of `available` for a list of preferred tags — typically
 * `navigator.languages`. An exact match wins, then a match on the language
 * alone (`"pt-PT"` finds `"pt-BR"`, `"zh"` finds `"zh-CN"`). Returns
 * `undefined` when nothing matches, so the caller decides the fallback.
 */
export function matchLocale(
	preferred: ReadonlyArray<string>,
	available: ReadonlyArray<string>,
): string | undefined {
	const lower = available.map((code) => code.toLowerCase())
	for (const tag of preferred) {
		const exact = lower.indexOf(tag.toLowerCase())
		if (exact !== -1) return available[exact]
		const language = tag.toLowerCase().split("-")[0]
		const partial = lower.findIndex((code) => code.split("-")[0] === language)
		if (partial !== -1) return available[partial]
	}
	return undefined
}
