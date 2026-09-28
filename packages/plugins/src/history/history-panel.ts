import { type Translate, defaultTranslate } from "@bpmnkit/editor"
import type { Checkpoint } from "./checkpoint.js"
import { listCheckpoints } from "./checkpoint.js"
import { injectHistoryStyles } from "./css.js"

export interface HistoryPanelOptions {
	getCurrentContext?(): { projectId: string; fileId: string } | null
	loadXml(xml: string): void
	/** Translation hook for the panel and its confirm dialog — pass the editor's. */
	translate?: Translate
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayKey(ts: number): string {
	const d = new Date(ts)
	return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(ts: number, t: Translate): string {
	const todayKey = dayKey(Date.now())
	const yesterdayKey = dayKey(Date.now() - 86_400_000)
	const key = dayKey(ts)
	if (key === todayKey) return t("Today")
	if (key === yesterdayKey) return t("Yesterday")
	return new Date(ts).toLocaleDateString(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
	})
}

function timeLabel(ts: number): string {
	return new Date(ts).toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	})
}

// ── Custom confirm dialog ─────────────────────────────────────────────────────

function showConfirm(t: Translate, onConfirm: () => void): void {
	const overlay = document.createElement("div")
	overlay.className = "bpmnkit-hist-confirm-overlay"

	const panel = document.createElement("div")
	panel.className = "bpmnkit-hist-confirm-panel"

	const titleEl = document.createElement("div")
	titleEl.className = "bpmnkit-hist-confirm-title"
	titleEl.textContent = t("Restore checkpoint?")

	const bodyEl = document.createElement("div")
	bodyEl.className = "bpmnkit-hist-confirm-body"
	bodyEl.textContent = t(
		"Your current changes will be replaced with this checkpoint. This cannot be undone.",
	)

	const actions = document.createElement("div")
	actions.className = "bpmnkit-hist-confirm-actions"

	const cancelBtn = document.createElement("button")
	cancelBtn.className = "bpmnkit-hist-confirm-cancel"
	cancelBtn.textContent = t("Cancel")
	cancelBtn.addEventListener("click", () => overlay.remove())

	const okBtn = document.createElement("button")
	okBtn.className = "bpmnkit-hist-confirm-ok"
	okBtn.textContent = t("Restore")
	okBtn.addEventListener("click", () => {
		overlay.remove()
		onConfirm()
	})

	actions.append(cancelBtn, okBtn)
	panel.append(titleEl, bodyEl, actions)
	overlay.append(panel)
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) overlay.remove()
	})
	document.body.append(overlay)
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function createHistoryPanel(options: HistoryPanelOptions): {
	el: HTMLElement
	refresh(): Promise<void>
} {
	injectHistoryStyles()
	const t = options.translate ?? defaultTranslate

	const el = document.createElement("div")
	el.className = "bpmnkit-hist-pane"

	// Header
	const header = document.createElement("div")
	header.className = "bpmnkit-hist-header"

	const titleEl = document.createElement("span")
	titleEl.className = "bpmnkit-hist-header-title"
	titleEl.textContent = t("Checkpoints")

	const refreshBtn = document.createElement("button")
	refreshBtn.className = "bpmnkit-hist-refresh"
	refreshBtn.title = t("Refresh")
	refreshBtn.textContent = "↻"

	header.append(titleEl, refreshBtn)

	// List
	const list = document.createElement("div")
	list.className = "bpmnkit-hist-list"

	el.append(header, list)

	// ── Render ──
	function render(checkpoints: Checkpoint[], hasContext: boolean): void {
		list.textContent = ""

		if (!hasContext) {
			const msg = document.createElement("div")
			msg.className = "bpmnkit-hist-empty"
			msg.textContent = t("Open a saved file to view its checkpoint history.")
			list.append(msg)
			return
		}

		if (checkpoints.length === 0) {
			const msg = document.createElement("div")
			msg.className = "bpmnkit-hist-empty"
			msg.textContent = t("No checkpoints yet. They are created automatically as you edit.")
			list.append(msg)
			return
		}

		// Group by day (checkpoints already sorted newest-first)
		let currentDay = ""
		for (const cp of checkpoints) {
			const day = dayKey(cp.timestamp)
			if (day !== currentDay) {
				currentDay = day
				const groupLabel = document.createElement("div")
				groupLabel.className = "bpmnkit-hist-group-label"
				groupLabel.textContent = dayLabel(cp.timestamp, t)
				list.append(groupLabel)
			}

			const item = document.createElement("div")
			item.className = "bpmnkit-hist-item"

			const timeEl = document.createElement("span")
			timeEl.className = "bpmnkit-hist-item-time"
			timeEl.textContent = timeLabel(cp.timestamp)

			const restoreBtn = document.createElement("button")
			restoreBtn.className = "bpmnkit-hist-restore"
			restoreBtn.textContent = t("Restore")
			restoreBtn.addEventListener("click", () => {
				showConfirm(t, () => options.loadXml(cp.xml))
			})

			item.append(timeEl, restoreBtn)
			list.append(item)
		}
	}

	// ── Refresh ──
	async function refresh(): Promise<void> {
		const ctx = options.getCurrentContext?.() ?? null
		if (!ctx) {
			render([], false)
			return
		}
		const checkpoints = await listCheckpoints(ctx.projectId, ctx.fileId)
		render(checkpoints, true)
	}

	refreshBtn.addEventListener("click", () => {
		void refresh()
	})

	return { el, refresh }
}
