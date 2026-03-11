import { createStatsCard } from "../components/card.js"
import type { DashboardStore } from "../stores/dashboard.js"

export function createDashboardView(
	store: DashboardStore,
	onNavigate: (path: string) => void,
): {
	el: HTMLElement
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view op-dashboard"

	const grid = document.createElement("div")
	grid.className = "op-card-grid"
	el.appendChild(grid)

	let instanceCard: HTMLElement
	let incidentCard: HTMLElement
	let jobCard: HTMLElement
	let taskCard: HTMLElement

	function render(): void {
		grid.innerHTML = ""
		const d = store.state.data

		instanceCard = createStatsCard("Active Instances", d?.activeInstances ?? "—")
		instanceCard.classList.add("bpmn-card--clickable")
		instanceCard.addEventListener("click", () => onNavigate("/instances"))
		grid.appendChild(instanceCard)

		incidentCard = createStatsCard(
			"Open Incidents",
			d?.openIncidents ?? "—",
			d?.openIncidents ? "warn" : undefined,
		)
		incidentCard.classList.add("bpmn-card--clickable")
		incidentCard.addEventListener("click", () => onNavigate("/incidents"))
		grid.appendChild(incidentCard)

		jobCard = createStatsCard("Active Jobs", d?.activeJobs ?? "—")
		jobCard.classList.add("bpmn-card--clickable")
		jobCard.addEventListener("click", () => onNavigate("/jobs"))
		grid.appendChild(jobCard)

		taskCard = createStatsCard("Pending Tasks", d?.pendingTasks ?? "—")
		taskCard.classList.add("bpmn-card--clickable")
		taskCard.addEventListener("click", () => onNavigate("/tasks"))
		grid.appendChild(taskCard)

		const defCard = createStatsCard("Deployed Processes", d?.definitions ?? "—")
		defCard.classList.add("bpmn-card--clickable")
		defCard.addEventListener("click", () => onNavigate("/definitions"))
		grid.appendChild(defCard)

		if (store.state.loading && !d) {
			grid.innerHTML = ""
			const loading = document.createElement("div")
			loading.className = "op-loading"
			loading.textContent = "Loading…"
			grid.appendChild(loading)
		}
	}

	const unsub = store.subscribe(render)
	render()

	return {
		el,
		destroy(): void {
			unsub()
		},
	}
}
