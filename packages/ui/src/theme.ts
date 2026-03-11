export type Theme = "light" | "dark" | "auto"

const STORAGE_KEY = "bpmn-theme"

/** Resolves "auto" to the OS preference; returns "light" or "dark". */
export function resolveTheme(theme: Theme): "light" | "dark" {
	if (theme !== "auto") return theme
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/** Writes the theme choice to localStorage. */
export function persistTheme(theme: Theme): void {
	try {
		localStorage.setItem(STORAGE_KEY, theme)
	} catch {
		// storage unavailable — silently ignore
	}
}

/** Reads the persisted theme from localStorage. Returns null if none stored. */
export function loadPersistedTheme(): Theme | null {
	try {
		const v = localStorage.getItem(STORAGE_KEY)
		if (v === "light" || v === "dark" || v === "auto") return v
	} catch {
		// storage unavailable
	}
	return null
}

/**
 * Applies the theme to an element by setting `data-theme` to the resolved value.
 * Pass the root element of the UI (e.g. `.op-root`).
 */
export function applyTheme(el: HTMLElement, theme: Theme): void {
	el.setAttribute("data-theme", resolveTheme(theme))
}
