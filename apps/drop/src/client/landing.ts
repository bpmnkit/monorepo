import { BpmnCanvas } from "@bpmnkit/canvas"
import { DEMO_SHARE_ID } from "../shared/constants.js"

// Renders the live hero preview: the demo BPMN, fetched from the in-memory demo
// drop and drawn in with a subtle animation (CSS, prefers-reduced-motion-gated).
const hero = document.getElementById("heroCanvas")
if (hero) {
	void (async () => {
		try {
			const res = await fetch(`/drop/${DEMO_SHARE_ID}/f/loan-approval.bpmn`)
			if (!res.ok) throw new Error("demo unavailable")
			const xml = await res.text()
			hero.innerHTML = ""
			new BpmnCanvas({ container: hero, xml, theme: "light", grid: true, fit: "contain" })
			requestAnimationFrame(() => hero.classList.add("animate"))
		} catch {
			// Preview is decorative — the "Open the demo drop" button still works.
			hero.innerHTML = ""
		}
	})()
}

// Fill the "what people drop" cards with build-time mini-diagram SVGs (trusted,
// same-origin static asset — no user input).
void (async () => {
	try {
		const cases = (await (await fetch("/drop/assets/usecases.json")).json()) as Record<
			string,
			string
		>
		for (const el of document.querySelectorAll<HTMLElement>(".uc-diagram")) {
			const key = el.dataset.uc
			if (key && cases[key]) el.innerHTML = cases[key]
		}
	} catch {
		// cards still show their text if the SVGs fail to load
	}
})()

// Live counters — only shown once the numbers are healthy (>= 100 drops).
void (async () => {
	try {
		const s = (await (await fetch("/drop/api/stats")).json()) as { drops: number; views: number }
		if (s.drops < 100) return
		const stats = document.getElementById("stats")
		const drops = document.getElementById("statDrops")
		const views = document.getElementById("statViews")
		if (!stats || !drops || !views) return
		drops.textContent = s.drops.toLocaleString()
		views.textContent = s.views.toLocaleString()
		stats.hidden = false
	} catch {
		// counters are optional
	}
})()
