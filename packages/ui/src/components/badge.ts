/** Returns a status badge element styled via shared bpmn-badge CSS classes. */
export function badge(state: string): HTMLElement {
	const el = document.createElement("span")
	el.className = `bpmn-badge bpmn-badge--${state.toLowerCase()}`
	el.textContent = state
	return el
}

/** Returns a plain text cell — suitable for table cells alongside badges. */
export function cell(text: string | null | undefined): HTMLElement {
	const el = document.createElement("span")
	el.textContent = text ?? "—"
	return el
}
