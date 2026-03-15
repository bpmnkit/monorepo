import { IC_UI } from "@bpmnkit/ui"

export interface NavItem {
	id: string
	label: string
	icon: string
}

const NAV_ITEMS: NavItem[] = [
	{ id: "/", label: "Dashboard", icon: IC_UI.dashboard },
	{ id: "/definitions", label: "Processes", icon: IC_UI.processes },
	{ id: "/decisions", label: "Decisions", icon: IC_UI.decisions },
	{ id: "/instances", label: "Instances", icon: IC_UI.instances },
	{ id: "/incidents", label: "Incidents", icon: IC_UI.incidents },
	{ id: "/jobs", label: "Jobs", icon: IC_UI.jobs },
	{ id: "/tasks", label: "Tasks", icon: IC_UI.tasks },
	{ id: "/messages", label: "Messages", icon: IC_UI.messages },
]

export function createNav(onNavigate: (path: string) => void): {
	el: HTMLElement
	setActive(path: string): void
} {
	const el = document.createElement("nav")
	el.className = "op-nav"

	const logo = document.createElement("div")
	logo.className = "op-nav-logo"
	logo.innerHTML = `<svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true">
    <polygon points="50,8 92,50 50,92 8,50" fill="currentColor"/>
    <line x1="50" y1="28" x2="50" y2="72" stroke="var(--bpmnkit-nav-bg)" stroke-width="12" stroke-linecap="round"/>
    <line x1="28" y1="50" x2="72" y2="50" stroke="var(--bpmnkit-nav-bg)" stroke-width="12" stroke-linecap="round"/>
  </svg>
  <span>Operate</span>`
	el.appendChild(logo)

	const list = document.createElement("ul")
	list.className = "op-nav-list"

	const itemEls = new Map<string, HTMLElement>()

	for (const item of NAV_ITEMS) {
		const li = document.createElement("li")
		const btn = document.createElement("button")
		btn.className = "op-nav-item"
		btn.dataset.path = item.id

		const iconSpan = document.createElement("span")
		iconSpan.className = "op-nav-icon"
		iconSpan.innerHTML = item.icon

		const labelSpan = document.createElement("span")
		labelSpan.className = "op-nav-label"
		labelSpan.textContent = item.label

		btn.appendChild(iconSpan)
		btn.appendChild(labelSpan)
		btn.addEventListener("click", () => onNavigate(item.id))
		li.appendChild(btn)
		list.appendChild(li)
		itemEls.set(item.id, btn)
	}

	el.appendChild(list)

	function setActive(path: string): void {
		// Normalize: strip trailing detail segments for highlighting
		const base = path === "/" ? "/" : `/${path.split("/")[1] ?? ""}`
		for (const [id, btn] of itemEls) {
			if (id === base) {
				btn.classList.add("op-nav-item--active")
			} else {
				btn.classList.remove("op-nav-item--active")
			}
		}
	}

	return { el, setActive }
}
