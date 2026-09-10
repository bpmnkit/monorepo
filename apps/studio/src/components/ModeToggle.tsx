import { useModeStore } from "../stores/mode.js"

export function ModeToggle() {
	const { mode, setMode } = useModeStore()

	return (
		<div className="flex border border-border bg-surface-2 p-0.5 text-xs">
			<button
				type="button"
				onClick={() => setMode("developer")}
				className={`px-2.5 py-0.5 transition-colors ${
					mode === "developer" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
				}`}
				aria-pressed={mode === "developer"}
				aria-label="Developer mode"
			>
				Dev
			</button>
			<button
				type="button"
				onClick={() => setMode("operator")}
				className={`px-2.5 py-0.5 transition-colors ${
					mode === "operator" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
				}`}
				aria-pressed={mode === "operator"}
				aria-label="Operator mode"
			>
				Ops
			</button>
		</div>
	)
}
