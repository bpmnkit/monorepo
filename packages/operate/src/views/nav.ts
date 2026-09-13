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
	{ id: "/search", label: "Search", icon: IC_UI.search },
]

export function createNav(onNavigate: (path: string) => void): {
	el: HTMLElement
	setActive(path: string): void
} {
	const el = document.createElement("nav")
	el.className = "op-nav"

	const logo = document.createElement("div")
	logo.className = "op-nav-logo"
	// The site's wordmark, set in mono like every other label here — not the
	// app-icon lockup, which belongs to a launcher rather than a sidebar.
	logo.innerHTML =
		'<span class="op-logo-mark">bpmn<span class="op-logo-kit">kit</span></span>' +
		'<span class="op-logo-app">Operate</span>'
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
