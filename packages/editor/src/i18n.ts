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
