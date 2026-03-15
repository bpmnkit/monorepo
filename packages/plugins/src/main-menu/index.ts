/**
 * @bpmnkit/canvas-plugin-main-menu — main menu plugin for `@bpmnkit/canvas`.
 *
 * Adds a panel in the top-right corner of the canvas with an optional title
 * and a menu button. The menu lets users switch between light, dark, and
 * automatic (OS-preference) color themes. Supports drill-down navigation,
 * dynamic items, and a programmatic API for title/items injection.
 *
 * @packageDocumentation
 */

import type { CanvasPlugin, Theme } from "@bpmnkit/canvas"
import { injectMainMenuStyles } from "./css.js"

export { MAIN_MENU_CSS, MAIN_MENU_STYLE_ID, injectMainMenuStyles } from "./css.js"

/** A clickable action item in the main menu dropdown. */
export interface MenuAction {
	label: string
	icon?: string
	onClick: () => void
}

/** A visual separator between groups of menu items. */
export interface MenuSeparator {
	type: "separator"
}

/** A drill-down item — clicking replaces dropdown content with a sub-menu. */
export interface MenuDrill {
	type: "drill"
	label: string
	icon?: string
	items: MenuItem[] | (() => MenuItem[])
}

/** A passive info row with optional inline action button. */
export interface MenuInfo {
	type: "info"
	text: string
	actionLabel?: string
	onAction?: () => void
}

export type MenuItem = MenuAction | MenuSeparator | MenuDrill | MenuInfo

export interface MainMenuOptions {
	/** Optional title text shown to the left of the menu button. */
	title?: string
	/** Extra items rendered above the Theme section in the dropdown. */
	menuItems?: MenuItem[]
}

/** Programmatic API returned alongside the plugin. */
export interface MainMenuApi {
	/** Overwrite the title span text. */
	setTitle(text: string): void
	/** Supply items prepended to the dropdown (above static menuItems) on each open. */
	setDynamicItems(fn: () => MenuItem[]): void
}

const DOTS_ICON =
	'<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>'

const CHECK_ICON =
	'<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5,6 4.5,9 10.5,3"/></svg>'

const MOON_ICON =
	'<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13 9.5a6 6 0 1 1-7.5-7.5 7 7 0 0 0 7.5 7.5z"/></svg>'

const SUN_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="2.8"/><line x1="8" y1="1.5" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="14.5"/><line x1="1.5" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="14.5" y2="8"/><line x1="3.3" y1="3.3" x2="4.4" y2="4.4"/><line x1="11.6" y1="11.6" x2="12.7" y2="12.7"/><line x1="3.3" y1="12.7" x2="4.4" y2="11.6"/><line x1="11.6" y1="4.4" x2="12.7" y2="3.3"/></svg>'

const AUTO_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 8V3.5"/><path d="M8 8l3.2 2"/></svg>'

const BACK_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="10,3 5,8 10,13"/></svg>'

const ARROW_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,3 11,8 6,13"/></svg>'

const THEMES: Array<{ value: Theme; label: string; icon: string }> = [
	{ value: "dark", label: "Dark", icon: MOON_ICON },
	{ value: "light", label: "Light", icon: SUN_ICON },
	{ value: "auto", label: "System", icon: AUTO_ICON },
]

type Level = { title?: string; items: MenuItem[] }

/**
 * Creates a main menu plugin instance.
 *
 * Each call returns a fresh plugin — pass one instance per canvas.
 */
export function createMainMenuPlugin(
	options: MainMenuOptions = {},
): CanvasPlugin & { api: MainMenuApi } {
	let dropdownEl: HTMLDivElement | null = null
	let panelEl: HTMLDivElement | null = null
	let titleEl: HTMLSpanElement | null = null
	let isOpen = false
	let navStack: Level[] = []
	let dynamicItemsFn: (() => MenuItem[]) | null = null
	let currentTheme: Theme = "light"
	let _setTheme: (t: Theme) => void = () => {}

	const offPointerDown = { fn: (_e: PointerEvent) => {} }

	const api: MainMenuApi = {
		setTitle(text: string) {
			if (titleEl) titleEl.textContent = text
		},
		setDynamicItems(fn: () => MenuItem[]) {
			dynamicItemsFn = fn
		},
	}

	function buildRootItems(): MenuItem[] {
		const dynamic = dynamicItemsFn ? dynamicItemsFn() : []
		const staticItems = options.menuItems ?? []
		const themeSection: MenuItem[] = [
			{ type: "separator" },
			{
				type: "drill",
				label: "Theme",
				items: () =>
					THEMES.map((t) => ({
						label: t.label,
						icon: t.icon,
						onClick: () => {
							currentTheme = t.value
							_setTheme(t.value)
							closeDropdown()
						},
					})),
			},
		]

		const beforeTheme: MenuItem[] = [...dynamic, ...staticItems]
		return [...beforeTheme, ...themeSection]
	}

	function resolveItems(items: MenuItem[] | (() => MenuItem[])): MenuItem[] {
		return typeof items === "function" ? items() : items
	}

	function closeDropdown(): void {
		dropdownEl?.classList.remove("open")
		isOpen = false
	}

	function buildLevelContent(dropdown: HTMLDivElement): HTMLDivElement {
		const slot = document.createElement("div")
		slot.className = "bpmnkit-menu-level"

		const level = navStack[navStack.length - 1]
		if (!level) return slot

		if (navStack.length > 1) {
			const backRow = document.createElement("div")
			backRow.className = "bpmnkit-menu-back-row"

			const backBtn = document.createElement("button")
			backBtn.className = "bpmnkit-menu-back-btn"
			backBtn.type = "button"
			backBtn.innerHTML = BACK_ICON
			backBtn.addEventListener("click", () => {
				navStack.pop()
				renderLevel(dropdown, "back")
			})

			const levelTitle = document.createElement("span")
			levelTitle.className = "bpmnkit-menu-level-title"
			levelTitle.textContent = level.title ?? ""

			backRow.append(backBtn, levelTitle)
			slot.appendChild(backRow)

			const sep = document.createElement("div")
			sep.className = "bpmnkit-menu-drop-sep"
			slot.appendChild(sep)
		}

		for (const item of level.items) {
			slot.appendChild(buildItemEl(item, dropdown))
		}

		return slot
	}

	function renderLevel(dropdown: HTMLDivElement, direction: "forward" | "back" | "initial"): void {
		const newSlot = buildLevelContent(dropdown)

		if (direction === "initial") {
			dropdown.textContent = ""
			dropdown.appendChild(newSlot)
			return
		}

		const oldSlot = dropdown.querySelector<HTMLElement>(".bpmnkit-menu-level")

		// Freeze width so the dropdown doesn't shrink/grow during animation
		dropdown.style.minWidth = `${dropdown.offsetWidth}px`

		// Exit: absolutely positioned so it doesn't affect layout
		if (oldSlot) {
			oldSlot.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:0;"
			oldSlot.classList.add(
				direction === "forward" ? "bpmnkit-menu-level--out-left" : "bpmnkit-menu-level--out-right",
			)
		}

		// Enter: on top, drives height
		newSlot.classList.add(
			direction === "forward" ? "bpmnkit-menu-level--in-right" : "bpmnkit-menu-level--in-left",
		)
		dropdown.appendChild(newSlot)

		setTimeout(() => {
			oldSlot?.remove()
			newSlot.classList.remove("bpmnkit-menu-level--in-right", "bpmnkit-menu-level--in-left")
			dropdown.style.minWidth = ""
		}, 200)
	}

	function buildItemEl(item: MenuItem, dropdown: HTMLDivElement): HTMLElement {
		if ("type" in item && item.type === "separator") {
			const sep = document.createElement("div")
			sep.className = "bpmnkit-menu-drop-sep"
			return sep
		}

		if ("type" in item && item.type === "info") {
			const row = document.createElement("div")
			row.className = "bpmnkit-menu-info-row"

			const textSpan = document.createElement("span")
			textSpan.className = "bpmnkit-menu-info-text"
			textSpan.textContent = item.text
			row.appendChild(textSpan)

			if (item.actionLabel && item.onAction) {
				const actionBtn = document.createElement("button")
				actionBtn.className = "bpmnkit-menu-info-action"
				actionBtn.type = "button"
				actionBtn.textContent = item.actionLabel
				const onAction = item.onAction
				actionBtn.addEventListener("click", () => {
					closeDropdown()
					onAction()
				})
				row.appendChild(actionBtn)
			}
			return row
		}

		if ("type" in item && item.type === "drill") {
			const btn = document.createElement("button")
			btn.className = "bpmnkit-menu-item"
			btn.type = "button"

			const checkSpan = document.createElement("span")
			checkSpan.className = "bpmnkit-menu-item-check"
			btn.appendChild(checkSpan)

			const iconSpan = document.createElement("span")
			iconSpan.className = "bpmnkit-menu-item-icon"
			if (item.icon) iconSpan.innerHTML = item.icon
			btn.appendChild(iconSpan)

			const labelSpan = document.createElement("span")
			labelSpan.className = "bpmnkit-menu-item-label"
			labelSpan.textContent = item.label
			btn.appendChild(labelSpan)

			const arrowSpan = document.createElement("span")
			arrowSpan.className = "bpmnkit-menu-item-arrow"
			arrowSpan.innerHTML = ARROW_ICON
			btn.appendChild(arrowSpan)

			const drillItems = item.items
			btn.addEventListener("click", () => {
				navStack.push({ title: item.label, items: resolveItems(drillItems) })
				renderLevel(dropdown, "forward")
			})
			return btn
		}

		// MenuAction
		const action = item as MenuAction
		const btn = document.createElement("button")
		btn.className = "bpmnkit-menu-item"
		btn.type = "button"

		const checkSpan = document.createElement("span")
		checkSpan.className = "bpmnkit-menu-item-check"
		// Show check mark for active theme when inside a drill level
		const themeMatch = THEMES.find((t) => t.label === action.label)
		if (themeMatch && themeMatch.value === currentTheme) {
			checkSpan.innerHTML = CHECK_ICON
		}
		btn.appendChild(checkSpan)

		const iconSpan = document.createElement("span")
		iconSpan.className = "bpmnkit-menu-item-icon"
		if (action.icon) iconSpan.innerHTML = action.icon
		btn.appendChild(iconSpan)

		const labelSpan = document.createElement("span")
		labelSpan.className = "bpmnkit-menu-item-label"
		labelSpan.textContent = action.label
		btn.appendChild(labelSpan)

		btn.addEventListener("click", () => {
			closeDropdown()
			action.onClick()
		})
		return btn
	}

	return {
		name: "main-menu",
		api,

		install(canvasApi) {
			injectMainMenuStyles()

			currentTheme = canvasApi.getTheme()
			_setTheme = (t: Theme) => canvasApi.setTheme(t)

			// ── Panel ────────────────────────────────────────────────────
			const panel = document.createElement("div")
			panel.className = "bpmnkit-main-menu-panel"

			if (options.title) {
				const title = document.createElement("span")
				title.className = "bpmnkit-main-menu-title"
				title.textContent = options.title
				panel.appendChild(title)
				titleEl = title

				const sep = document.createElement("div")
				sep.className = "bpmnkit-main-menu-sep"
				panel.appendChild(sep)
			}

			const menuBtn = document.createElement("button")
			menuBtn.className = "bpmnkit-menu-btn"
			menuBtn.type = "button"
			menuBtn.setAttribute("aria-label", "Main menu")
			menuBtn.title = "Main menu"
			menuBtn.innerHTML = DOTS_ICON
			panel.appendChild(menuBtn)

			canvasApi.container.appendChild(panel)
			panelEl = panel

			// ── Dropdown ─────────────────────────────────────────────────
			const dropdown = document.createElement("div")
			dropdown.className = "bpmnkit-menu-dropdown"
			document.body.appendChild(dropdown)
			dropdownEl = dropdown

			menuBtn.addEventListener("pointerdown", (e) => {
				e.stopPropagation()
			})
			menuBtn.addEventListener("click", () => {
				if (isOpen) {
					closeDropdown()
				} else {
					navStack = [{ items: buildRootItems() }]
					renderLevel(dropdown, "initial")
					const rect = menuBtn.getBoundingClientRect()
					dropdown.style.top = `${rect.bottom + 6}px`
					dropdown.style.right = `${window.innerWidth - rect.right}px`
					dropdown.style.left = "auto"
					dropdown.classList.add("open")
					isOpen = true
				}
			})

			offPointerDown.fn = (e: PointerEvent) => {
				if (isOpen && !dropdown.contains(e.target as Node)) {
					closeDropdown()
				}
			}
			document.addEventListener("pointerdown", offPointerDown.fn)
		},

		uninstall() {
			document.removeEventListener("pointerdown", offPointerDown.fn)
			dropdownEl?.remove()
			dropdownEl = null
			panelEl?.remove()
			panelEl = null
			titleEl = null
			isOpen = false
		},
	}
}
