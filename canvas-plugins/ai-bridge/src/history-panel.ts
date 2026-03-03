import type { Checkpoint } from "./checkpoint.js";
import { listCheckpoints } from "./checkpoint.js";

export interface HistoryPanelOptions {
	getCurrentContext?(): { projectId: string; fileId: string } | null;
	loadXml(xml: string): void;
}

export function createHistoryPanel(options: HistoryPanelOptions): {
	el: HTMLElement;
	refresh(): Promise<void>;
} {
	const el = document.createElement("div");
	el.className = "ai-hist-pane";

	const header = document.createElement("div");
	header.className = "ai-hist-pane-header";

	const title = document.createElement("span");
	title.textContent = "Checkpoint History";

	const refreshBtn = document.createElement("button");
	refreshBtn.className = "ai-hdr-btn";
	refreshBtn.title = "Refresh";
	refreshBtn.textContent = "↻";

	header.append(title, refreshBtn);

	const list = document.createElement("div");
	list.className = "ai-hist-list";

	el.append(header, list);

	function render(checkpoints: Checkpoint[], hasContext: boolean): void {
		list.textContent = "";

		if (!hasContext) {
			const msg = document.createElement("div");
			msg.className = "ai-hist-empty";
			msg.textContent = "Open a saved file to view its checkpoint history.";
			list.append(msg);
			return;
		}

		if (checkpoints.length === 0) {
			const msg = document.createElement("div");
			msg.className = "ai-hist-empty";
			msg.textContent =
				"No checkpoints yet. Checkpoints are saved automatically when you apply AI changes.";
			list.append(msg);
			return;
		}

		for (const cp of checkpoints) {
			const item = document.createElement("div");
			item.className = "ai-hist-item";

			const timeEl = document.createElement("span");
			timeEl.className = "ai-hist-time";
			timeEl.textContent = new Date(cp.timestamp).toLocaleString();

			const restoreBtn = document.createElement("button");
			restoreBtn.className = "ai-hist-restore";
			restoreBtn.textContent = "Restore";
			restoreBtn.addEventListener("click", () => {
				if (!window.confirm("Restore this checkpoint? Your current changes will be replaced.")) {
					return;
				}
				options.loadXml(cp.xml);
			});

			item.append(timeEl, restoreBtn);
			list.append(item);
		}
	}

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
