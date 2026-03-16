import { IC_UI } from "../icons.js"
import { type Theme, persistTheme, resolveTheme } from "../theme.js"

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: string }> = [
	{ value: "dark", label: "Dark", icon: IC_UI.moon },
	{ value: "light", label: "Light", icon: IC_UI.sun },
	{ value: "auto", label: "System", icon: IC_UI.auto },
	{ value: "neon", label: "Neon", icon: IC_UI.neon },
]

export interface ThemeSwitcherOptions {
	initial?: Theme
	/** Called whenever the user selects a theme. */
	onChange: (theme: Theme, resolved: "light" | "dark" | "neon") => void
	/** If true, persists the selection to localStorage under "bpmnkit-theme". */
	persist?: boolean
}

/**
 * Creates a theme-switcher button that opens a Dark / Light / System dropdown.
 * The button icon updates to reflect the current selection.
 */
export function createThemeSwitcher(options: ThemeSwitcherOptions): {
	el: HTMLElement
	setTheme(t: Theme): void
} {
	let current: Theme = options.initial ?? "neon"
	let dropdownEl: HTMLDivElement | null = null
	let isOpen = false

	const btn = document.createElement("button")
	btn.className = "bpmnkit-theme-btn"
	btn.type = "button"
	btn.setAttribute("aria-label", "Switch theme")
	btn.title = "Switch theme"

	function updateIcon(): void {
		const opt = THEME_OPTIONS.find((o) => o.value === current) ?? THEME_OPTIONS[0]
		if (opt) btn.innerHTML = opt.icon
	}
	updateIcon()

	function closeDropdown(): void {
		dropdownEl?.remove()
		dropdownEl = null
		isOpen = false
	}

	function openDropdown(): void {
		const dropdown = document.createElement("div")
		dropdown.className = "bpmnkit-theme-dropdown"
		// Mirror resolved theme onto the dropdown so its own CSS variables apply
		dropdown.setAttribute("data-theme", resolveTheme(current))

		for (const opt of THEME_OPTIONS) {
			const item = document.createElement("button")
			item.className = "bpmnkit-theme-item"
			item.type = "button"

			const check = document.createElement("span")
			check.className = "bpmnkit-theme-item-check"
			if (opt.value === current) check.innerHTML = IC_UI.check
			item.appendChild(check)

			const icon = document.createElement("span")
			icon.className = "bpmnkit-theme-item-icon"
			icon.innerHTML = opt.icon
			item.appendChild(icon)

			const label = document.createElement("span")
			label.textContent = opt.label
			item.appendChild(label)

			item.addEventListener("click", (e) => {
				e.stopPropagation()
				closeDropdown()
				current = opt.value
				updateIcon()
				if (options.persist) persistTheme(current)
				options.onChange(current, resolveTheme(current))
			})

			dropdown.appendChild(item)
		}

		document.body.appendChild(dropdown)
		dropdownEl = dropdown
		isOpen = true

		// Position below the button, right-aligned
		const rect = btn.getBoundingClientRect()
		dropdown.style.top = `${rect.bottom + 4}px`
		dropdown.style.right = `${window.innerWidth - rect.right}px`
		dropdown.style.left = "auto"

		// Close on outside click (defer to avoid catching current click)
		const outsideHandler = (e: PointerEvent) => {
			if (!dropdown.contains(e.target as Node)) {
				closeDropdown()
				document.removeEventListener("pointerdown", outsideHandler)
			}
		}
		setTimeout(() => document.addEventListener("pointerdown", outsideHandler), 0)
	}

	btn.addEventListener("click", () => {
		if (isOpen) closeDropdown()
		else openDropdown()
	})

	return {
		el: btn,
		setTheme(t: Theme) {
			current = t
			updateIcon()
		},
	}
}
