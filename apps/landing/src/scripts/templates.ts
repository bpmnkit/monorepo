// Template gallery: category filter (index page) and the copy button for the
// `casen template use` command (template pages). Both pages render complete
// without this script — the filter only hides cards, it never builds them.

function setupFilter(): void {
	const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-filter]")]
	const cards = [...document.querySelectorAll<HTMLElement>("[data-category]")]
	if (buttons.length === 0) return

	const apply = (category: string): void => {
		const known = buttons.some((b) => b.dataset.filter === category)
		const active = known ? category : "all"
		for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.filter === active))
		for (const card of cards) card.hidden = active !== "all" && card.dataset.category !== active
	}

	for (const b of buttons) {
		b.addEventListener("click", () => {
			const category = b.dataset.filter ?? "all"
			apply(category)
			// The hash makes a filtered view linkable without a page per category.
			history.replaceState(null, "", category === "all" ? location.pathname : `#${category}`)
		})
	}
	apply(location.hash.slice(1) || "all")
}

function setupCopy(): void {
	for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
		btn.addEventListener("click", async () => {
			const text = btn.dataset.copy ?? ""
			let ok = false
			try {
				await navigator.clipboard.writeText(text)
				ok = true
			} catch {
				// Clipboard API refused (insecure context, permissions) — say so below.
			}
			btn.textContent = ok ? "copied" : "copy failed"
			setTimeout(() => {
				btn.textContent = "copy"
			}, 1500)
		})
	}
}

setupFilter()
setupCopy()
