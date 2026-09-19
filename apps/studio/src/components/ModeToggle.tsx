import { useModeStore } from "../stores/mode.js"

export function ModeToggle() {
	const { mode, setMode } = useModeStore()

	return (
		<div className="ds-seg">
			<button
				type="button"
				onClick={() => setMode("developer")}
				className={`ds-seg-btn ${mode === "developer" ? "ds-seg-btn--on" : ""}`}
				aria-pressed={mode === "developer"}
				aria-label="Developer mode"
			>
				Dev
			</button>
			<button
				type="button"
				onClick={() => setMode("operator")}
				className={`ds-seg-btn ${mode === "operator" ? "ds-seg-btn--on" : ""}`}
				aria-pressed={mode === "operator"}
				aria-label="Operator mode"
			>
				Ops
			</button>
		</div>
	)
}
