import { applyTheme, loadPersistedTheme, persistTheme } from "@bpmnkit/ui"
import type { Theme } from "@bpmnkit/ui"
import { create } from "zustand"

interface ThemeState {
	theme: "light" | "dark" | "neon"
	setTheme(t: "light" | "dark" | "neon"): void
	init(): void
}

export const useThemeStore = create<ThemeState>()((set) => ({
	theme: "light",

	setTheme(t) {
		set({ theme: t })
		applyTheme(document.documentElement, t)
		persistTheme(t)
	},

	init() {
		const persisted = loadPersistedTheme()
		const resolved: "light" | "dark" | "neon" =
			persisted === "light" || persisted === "dark" || persisted === "neon" ? persisted : "light"
		set({ theme: resolved })
		applyTheme(document.documentElement, resolved as Theme)
	},
}))
