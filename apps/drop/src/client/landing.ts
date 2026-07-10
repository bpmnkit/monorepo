import { BpmnCanvas } from "@bpmnkit/canvas"
import { DEMO_SHARE_ID } from "../shared/constants.js"

// Renders the live hero preview: the demo BPMN, fetched from the in-memory demo
// drop and drawn in with a subtle animation (CSS, prefers-reduced-motion-gated).
const el = document.getElementById("heroCanvas")
if (el) {
	void (async () => {
		try {
			const res = await fetch(`/drop/${DEMO_SHARE_ID}/f/loan-approval.bpmn`)
			if (!res.ok) throw new Error("demo unavailable")
			const xml = await res.text()
			el.innerHTML = ""
			new BpmnCanvas({ container: el, xml, theme: "light", grid: true, fit: "contain" })
			requestAnimationFrame(() => el.classList.add("animate"))
		} catch {
			// Preview is decorative — the "Open the demo drop" button still works.
			el.innerHTML = ""
		}
	})()
}
