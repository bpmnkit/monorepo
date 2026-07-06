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
