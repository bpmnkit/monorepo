import { type Theme, createThemeSwitcher } from "@bpmnkit/ui"
import type { ProfileInfo } from "../types.js"

export function createHeader(
	onProfileChange: (name: string) => void,
	onThemeChange: (theme: Theme, resolved: "light" | "dark" | "neon") => void,
	initialTheme: Theme = "neon",
): {
	el: HTMLElement
	setTitle(title: string): void
	setProfiles(profiles: ProfileInfo[], active: string | null): void
	setTheme(t: Theme): void
} {
	const el = document.createElement("header")
	el.className = "op-header"

	const title = document.createElement("h1")
	title.className = "op-header-title"
	title.textContent = "Dashboard"
	el.appendChild(title)

	const right = document.createElement("div")
	right.className = "op-header-right"

	const select = document.createElement("select")
	select.className = "op-profile-select"
	select.setAttribute("aria-label", "Active profile")
	select.addEventListener("change", () => {
		if (select.value) onProfileChange(select.value)
	})
	right.appendChild(select)

	const themeSwitcher = createThemeSwitcher({
		initial: initialTheme,
		persist: true,
		onChange: onThemeChange,
	})
	right.appendChild(themeSwitcher.el)

	el.appendChild(right)

	function setTitle(t: string): void {
		title.textContent = t
	}

	function setProfiles(profiles: ProfileInfo[], active: string | null): void {
		select.innerHTML = ""
		if (profiles.length === 0) {
			const opt = document.createElement("option")
			opt.value = ""
			opt.textContent = "No profiles"
			select.appendChild(opt)
			return
		}
		for (const p of profiles) {
			const opt = document.createElement("option")
			opt.value = p.name
			opt.textContent = `${p.name}${p.active ? " ✓" : ""}`
			if (p.name === active || (active === null && p.active)) opt.selected = true
			select.appendChild(opt)
		}
	}

	return { el, setTitle, setProfiles, setTheme: themeSwitcher.setTheme }
}
