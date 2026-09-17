import { useThemeStore } from "../stores/theme.js"

type Theme = "light" | "dark" | "neon"

const THEMES: { value: Theme; label: string; title: string }[] = [
	{ value: "light", label: "Light", title: "Light theme" },
	{ value: "dark", label: "Dark", title: "Dark theme" },
	{ value: "neon", label: "Neon", title: "Neon theme" },
]

export function ThemePicker() {
	const { theme, setTheme } = useThemeStore()

	return (
		<div className="ds-seg">
			{THEMES.map((t) => (
				<button
					key={t.value}
					type="button"
					onClick={() => setTheme(t.value)}
					className={`ds-seg-btn ${theme === t.value ? "ds-seg-btn--on" : ""}`}
					aria-pressed={theme === t.value}
					aria-label={t.title}
				>
					{t.label}
				</button>
			))}
		</div>
	)
}
