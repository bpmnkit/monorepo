import type { Checkpoint } from "./checkpoint.js";
import { listCheckpoints } from "./checkpoint.js";
import { injectHistoryStyles } from "./css.js";

export interface HistoryPanelOptions {
	getCurrentContext?(): { projectId: string; fileId: string } | null;
	loadXml(xml: string): void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayKey(ts: number): string {
	const d = new Date(ts);
	return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(ts: number): string {
	const todayKey = dayKey(Date.now());
	const yesterdayKey = dayKey(Date.now() - 86_400_000);
	const key = dayKey(ts);
	if (key === todayKey) return "Today";
	if (key === yesterdayKey) return "Yesterday";
	return new Date(ts).toLocaleDateString(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
	});
}

function timeLabel(ts: number): string {
	return new Date(ts).toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

// ── Custom confirm dialog ─────────────────────────────────────────────────────

function showConfirm(onConfirm: () => void): void {
	const overlay = document.createElement("div");
	overlay.className = "bpmn-hist-confirm-overlay";

	const panel = document.createElement("div");
	panel.className = "bpmn-hist-confirm-panel";

	const titleEl = document.createElement("div");
	titleEl.className = "bpmn-hist-confirm-title";
	titleEl.textContent = "Restore checkpoint?";

	const bodyEl = document.createElement("div");
	bodyEl.className = "bpmn-hist-confirm-body";
	bodyEl.textContent =
		"Your current changes will be replaced with this checkpoint. This cannot be undone.";

	const actions = document.createElement("div");
	actions.className = "bpmn-hist-confirm-actions";

	const cancelBtn = document.createElement("button");
	cancelBtn.className = "bpmn-hist-confirm-cancel";
	cancelBtn.textContent = "Cancel";
	cancelBtn.addEventListener("click", () => overlay.remove());

	const okBtn = document.createElement("button");
	okBtn.className = "bpmn-hist-confirm-ok";
	okBtn.textContent = "Restore";
	okBtn.addEventListener("click", () => {
		overlay.remove();
		onConfirm();
	});

	actions.append(cancelBtn, okBtn);
	panel.append(titleEl, bodyEl, actions);
	overlay.append(panel);
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) overlay.remove();
	});
	document.body.append(overlay);
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function createHistoryPanel(options: HistoryPanelOptions): {
	el: HTMLElement;
	refresh(): Promise<void>;
} {
	injectHistoryStyles();

	const el = document.createElement("div");
	el.className = "bpmn-hist-pane";

	// Header
	const header = document.createElement("div");
	header.className = "bpmn-hist-header";

	const titleEl = document.createElement("span");
	titleEl.className = "bpmn-hist-header-title";
	titleEl.textContent = "Checkpoints";

	const refreshBtn = document.createElement("button");
	refreshBtn.className = "bpmn-hist-refresh";
	refreshBtn.title = "Refresh";
	refreshBtn.textContent = "↻";

	header.append(titleEl, refreshBtn);

	// List
	const list = document.createElement("div");
	list.className = "bpmn-hist-list";

	el.append(header, list);

	// ── Render ──
	function render(checkpoints: Checkpoint[], hasContext: boolean): void {
		list.textContent = "";

		if (!hasContext) {
			const msg = document.createElement("div");
			msg.className = "bpmn-hist-empty";
			msg.textContent = "Open a saved file to view its checkpoint history.";
			list.append(msg);
			return;
		}

		if (checkpoints.length === 0) {
			const msg = document.createElement("div");
			msg.className = "bpmn-hist-empty";
			msg.textContent = "No checkpoints yet. They are created automatically as you edit.";
			list.append(msg);
			return;
		}

		// Group by day (checkpoints already sorted newest-first)
		let currentDay = "";
		for (const cp of checkpoints) {
			const day = dayKey(cp.timestamp);
			if (day !== currentDay) {
				currentDay = day;
				const groupLabel = document.createElement("div");
				groupLabel.className = "bpmn-hist-group-label";
				groupLabel.textContent = dayLabel(cp.timestamp);
				list.append(groupLabel);
			}

			const item = document.createElement("div");
			item.className = "bpmn-hist-item";

			const timeEl = document.createElement("span");
			timeEl.className = "bpmn-hist-item-time";
			timeEl.textContent = timeLabel(cp.timestamp);

			const restoreBtn = document.createElement("button");
			restoreBtn.className = "bpmn-hist-restore";
			restoreBtn.textContent = "Restore";
			restoreBtn.addEventListener("click", () => {
				showConfirm(() => options.loadXml(cp.xml));
			});

			item.append(timeEl, restoreBtn);
			list.append(item);
		}
	}

	// ── Refresh ──
	async function refresh(): Promise<void> {
		const ctx = options.getCurrentContext?.() ?? null;
		if (!ctx) {
			render([], false);
			return;
		}
		const checkpoints = await listCheckpoints(ctx.projectId, ctx.fileId);
		render(checkpoints, true);
	}

	refreshBtn.addEventListener("click", () => {
		void refresh();
	});

	return { el, refresh };
}
