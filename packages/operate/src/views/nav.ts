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
	logo.innerHTML = `<svg width="28" height="28" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#060609" d="m0 166.67c0 -92.0493 74.6207 -166.67 166.67 -166.67l666.66003 0c44.203613 0 86.5968 17.559824 117.853455 48.816513c31.256714 31.256691 48.81653 73.64986 48.81653 117.853485l0 666.66003c0 92.049255 -74.62073 166.66998 -166.66998 166.66998l-666.66003 0c-92.0493 0 -166.67 -74.62073 -166.67 -166.66998z" fill-rule="evenodd"/><path fill="#e954c2" d="m80.49353 127.48857l84.734375 0q42.71875 0 63.03125 20.578125q20.3125 20.578125 20.3125 61.828125l0 13.0625q0 26.96875 -9.1875 44.812485q-9.171875 17.828125 -29.8125 20.0625l-0.09375 -0.9375q44.234375 8.796875 44.234375 69.0625l0 28.0q0 40.8125 -21.96875 62.78125q-21.96875 21.96875 -63.25 21.96875l-88.0 0l0 -341.21875zm78.671875 132.99998q12.328125 0 17.921875 -5.7656097q5.59375 -5.78125 5.59375 -21.484375l0 -18.203125q0 -15.203125 -4.421875 -20.765625q-4.40625 -5.5625 -14.421875 -5.5625l-17.453125 0l0 71.781235l12.78125 0zm9.328125 146.98438q10.296875 0 14.8125 -4.984375q4.515625 -5.0 4.515625 -19.921875l0 -28.46875q0 -19.625 -5.703125 -26.0q-5.6875 -6.390625 -20.15625 -6.390625l-15.578125 0l0 85.765625l22.109375 0zm115.10724 -279.98438l82.875 0q41.4375 0 62.625 22.75q21.1875 22.734375 21.1875 65.265625l0 32.1875q0 42.531235 -21.1875 65.281235q-21.1875 22.734375 -62.625 22.734375l-16.984375 0l0 133.0l-65.890625 0l0 -341.21875zm82.875 146.99998q9.359375 0 13.640625 -4.75q4.28125 -4.765625 4.28125 -18.781235l0 -38.71875q0 -14.015625 -4.28125 -18.765625q-4.28125 -4.765625 -13.640625 -4.765625l-16.984375 0l0 85.781235l16.984375 0zm111.83243 -146.99998l86.859406 0l27.28125 239.99998l-0.9375 0l27.265625 -239.99998l86.875 0l0 341.21875l-63.09375 0l6.359375 -253.68748l0.921875 0.15625l-32.0 253.53123l-55.453125 0l-32.0 -253.53123l0.921875 -0.15625l6.359375 253.68748l-59.359406 0l0 -341.21875zm265.6392 0l77.328125 0l45.203125 201.62498l-0.921875 0.265625l-6.359375 -201.89061l60.296875 0l0 341.21875l-65.65625 0l-56.890625 -244.54686l0.9375 -0.265625l6.34375 244.81248l-60.28125 0l0 -341.21875z" fill-rule="nonzero"/><path fill="#ffffff" d="m270.9452 522.1202l65.890625 0l0 112.609375l53.4375 -112.609375l67.828125 0l-65.203125 127.90625l64.03125 213.3125l-68.875 0l-39.65625 -133.03125l-11.5625 23.390625l0 109.640625l-65.890625 0l0 -341.21875zm207.7738 0l65.890625 0l0 341.21875l-65.890625 0l0 -341.21875zm144.30109 61.21875l-53.671875 0l0 -61.21875l173.23438 0l0 61.21875l-53.671875 0l0 280.0l-65.890625 0l0 -280.0z" fill-rule="nonzero"/></svg>
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
