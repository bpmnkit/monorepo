import { Bpmn, compactify, expand } from "@bpmn-sdk/core";
import type { BpmnDefinitions, CompactDiagram } from "@bpmn-sdk/core";
import type { Checkpoint } from "./checkpoint.js";
import { listCheckpoints, saveCheckpoint } from "./checkpoint.js";
import { injectAiBridgeStyles } from "./css.js";

const DEFAULT_SERVER = "http://localhost:3033";

interface PanelOptions {
	serverUrl: string;
	getDefinitions(): BpmnDefinitions | null;
	loadXml(xml: string): void;
	getCurrentContext?(): { projectId: string; fileId: string } | null;
}

interface ChatMessage {
	role: "user" | "ai";
	content: string;
}

// ── SSE streaming ─────────────────────────────────────────────────────────────

async function* streamChat(
	serverUrl: string,
	messages: ChatMessage[],
	context: unknown,
	backend: string,
): AsyncGenerator<string> {
	const res = await fetch(`${serverUrl}/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ messages, context, backend: backend === "auto" ? null : backend }),
	});
	if (!res.ok || !res.body) throw new Error(`Server returned ${res.status}`);

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buf = "";
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buf += decoder.decode(value, { stream: true });
			const parts = buf.split("\n\n");
			buf = parts.pop() ?? "";
			for (const part of parts) {
				const line = part.startsWith("data: ") ? part.slice(6) : part;
				const trimmed = line.trim();
				if (!trimmed) continue;
				try {
					const event = JSON.parse(trimmed) as { type: string; text?: string; message?: string };
					if (event.type === "token" && event.text) yield event.text;
					if (event.type === "done") return;
					if (event.type === "error") throw new Error(event.message ?? event.text ?? "AI error");
				} catch (e) {
					if (e instanceof SyntaxError) continue;
					throw e;
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}

// ── Compact diagram extraction ────────────────────────────────────────────────

function extractCompactDiagram(text: string): CompactDiagram | null {
	const match = /```json\s*\n([\s\S]*?)\n```/.exec(text);
	if (!match?.[1]) return null;
	try {
		const parsed = JSON.parse(match[1]) as unknown;
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"processes" in parsed &&
			Array.isArray((parsed as Record<string, unknown>).processes)
		) {
			return parsed as CompactDiagram;
		}
	} catch {
		/* invalid JSON */
	}
	return null;
}

// ── History modal ─────────────────────────────────────────────────────────────

function showHistoryModal(checkpoints: Checkpoint[], onRestore: (xml: string) => void): void {
	const overlay = document.createElement("div");
	overlay.className = "ai-hist-overlay";
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) overlay.remove();
	});

	const panel = document.createElement("div");
	panel.className = "ai-hist-panel";

	const header = document.createElement("div");
	header.className = "ai-hist-header";
	const title = document.createElement("span");
	title.textContent = "Checkpoint History";
	const closeBtn = document.createElement("button");
	closeBtn.className = "ai-hdr-btn";
	closeBtn.textContent = "×";
	closeBtn.addEventListener("click", () => overlay.remove());
	header.append(title, closeBtn);

	const list = document.createElement("div");
	list.className = "ai-hist-list";

	if (checkpoints.length === 0) {
		const empty = document.createElement("div");
		empty.className = "ai-hist-empty";
		empty.textContent =
			"No checkpoints saved yet. Checkpoints are created when you apply AI changes.";
		list.append(empty);
	} else {
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
				onRestore(cp.xml);
				overlay.remove();
			});

			item.append(timeEl, restoreBtn);
			list.append(item);
		}
	}

	panel.append(header, list);
	overlay.append(panel);
	document.body.append(overlay);
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function createAiPanel(options: PanelOptions): {
	panel: HTMLElement;
	open(): void;
	close(): void;
} {
	injectAiBridgeStyles();

	const panel = document.createElement("div");
	panel.className = "ai-panel";

	// ── Header ──
	const header = document.createElement("div");
	header.className = "ai-panel-header";

	const titleEl = document.createElement("span");
	titleEl.className = "ai-panel-title";
	titleEl.textContent = "AI Assistant";

	const actions = document.createElement("div");
	actions.className = "ai-panel-header-actions";

	const backendSelect = document.createElement("select");
	backendSelect.className = "ai-backend-select";
	for (const [value, label] of [
		["auto", "Auto"],
		["claude", "Claude"],
		["copilot", "Copilot"],
	] as const) {
		const opt = document.createElement("option");
		opt.value = value;
		opt.textContent = label;
		backendSelect.append(opt);
	}
	backendSelect.value = localStorage.getItem("bpmn-sdk-ai-backend") ?? "auto";
	backendSelect.addEventListener("change", () => {
		localStorage.setItem("bpmn-sdk-ai-backend", backendSelect.value);
	});

	const histBtn = document.createElement("button");
	histBtn.className = "ai-hdr-btn";
	histBtn.title = "Checkpoint history";
	histBtn.textContent = "History";

	const closeBtn = document.createElement("button");
	closeBtn.className = "ai-hdr-btn";
	closeBtn.title = "Close";
	closeBtn.textContent = "×";
	closeBtn.addEventListener("click", () => close());

	actions.append(backendSelect, histBtn, closeBtn);
	header.append(titleEl, actions);

	// ── Status bar ──
	const statusBar = document.createElement("div");
	statusBar.className = "ai-panel-status";
	statusBar.textContent = "Checking server…";

	// ── Messages ──
	const messagesEl = document.createElement("div");
	messagesEl.className = "ai-messages";

	// ── Input area ──
	const inputArea = document.createElement("div");
	inputArea.className = "ai-input-area";

	const textarea = document.createElement("textarea");
	textarea.className = "ai-textarea";
	textarea.placeholder = "Ask AI to create or modify the diagram…";
	textarea.rows = 2;

	const sendBtn = document.createElement("button");
	sendBtn.className = "ai-send-btn";
	sendBtn.textContent = "Send";

	inputArea.append(textarea, sendBtn);
	panel.append(header, statusBar, messagesEl, inputArea);

	// ── State ──
	const history: ChatMessage[] = [];
	let sending = false;

	// ── Server status check ──
	async function checkStatus(): Promise<void> {
		try {
			const res = await fetch(`${options.serverUrl}/status`, { signal: AbortSignal.timeout(3000) });
			const data = (await res.json()) as { ready: boolean; available: string[] };
			if (data.ready) {
				statusBar.className = "ai-panel-status ai-panel-status-ok";
				statusEl.textContent = `Connected · ${data.available.join(", ")} available`;
			} else {
				showNotRunning();
			}
		} catch {
			showNotRunning();
		}
	}

	const statusEl = document.createElement("span");
	statusBar.append(statusEl);

	function showNotRunning(): void {
		statusBar.className = "ai-panel-status ai-panel-status-err";
		statusEl.textContent = "AI server not running. Start with:";
		const code = document.createElement("code");
		code.textContent = "pnpm ai-server";
		statusBar.append(code);
	}

	// ── Message rendering ──
	function addMessage(role: "user" | "ai", content: string): HTMLElement {
		const msg = document.createElement("div");
		msg.className = role === "user" ? "ai-msg ai-msg-user" : "ai-msg ai-msg-ai";
		msg.textContent = content;
		messagesEl.append(msg);
		messagesEl.scrollTop = messagesEl.scrollHeight;
		return msg;
	}

	function finalizeAiMessage(msgEl: HTMLElement, fullText: string): void {
		msgEl.classList.remove("ai-msg-cursor");
		msgEl.textContent = "";

		// Render text with code blocks highlighted
		const jsonMatch = /```json\s*\n([\s\S]*?)\n```/.exec(fullText);
		if (jsonMatch) {
			const before = fullText.slice(0, jsonMatch.index).trim();
			const after = fullText.slice(jsonMatch.index + jsonMatch[0].length).trim();

			if (before) {
				const textEl = document.createElement("div");
				textEl.textContent = before;
				msgEl.append(textEl);
			}

			const codeEl = document.createElement("pre");
			codeEl.className = "ai-msg-code";
			codeEl.textContent = jsonMatch[0];
			msgEl.append(codeEl);

			if (after) {
				const textEl = document.createElement("div");
				textEl.style.marginTop = "6px";
				textEl.textContent = after;
				msgEl.append(textEl);
			}

			// Try to extract and show Apply button
			const compact = extractCompactDiagram(fullText);
			if (compact) {
				const applyBtn = document.createElement("button");
				applyBtn.className = "ai-msg-apply";
				applyBtn.textContent = "Apply to diagram";
				applyBtn.addEventListener("click", async () => {
					applyBtn.disabled = true;
					applyBtn.textContent = "Applying…";
					try {
						// Save checkpoint of current state before applying
						const currentDefs = options.getDefinitions();
						if (currentDefs) {
							const ctx = options.getCurrentContext?.();
							if (ctx) {
								await saveCheckpoint(ctx.projectId, ctx.fileId, Bpmn.export(currentDefs));
							}
						}
						const expanded = expand(compact);
						options.loadXml(Bpmn.export(expanded));
						applyBtn.textContent = "Applied ✓";
					} catch (err) {
						applyBtn.disabled = false;
						applyBtn.textContent = `Apply failed: ${String(err)}`;
					}
				});
				msgEl.append(applyBtn);
			}
		} else {
			msgEl.textContent = fullText;
		}

		messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	// ── Send ──
	async function send(): Promise<void> {
		const text = textarea.value.trim();
		if (!text || sending) return;

		sending = true;
		sendBtn.disabled = true;
		textarea.value = "";

		const userMsg: ChatMessage = { role: "user", content: text };
		history.push(userMsg);
		addMessage("user", text);

		const aiMsgEl = addMessage("ai", "");
		aiMsgEl.classList.add("ai-msg-cursor");

		const defs = options.getDefinitions();
		const context = defs ? compactify(defs) : null;

		let fullText = "";
		try {
			for await (const token of streamChat(
				options.serverUrl,
				history,
				context,
				backendSelect.value,
			)) {
				fullText += token;
				aiMsgEl.textContent = fullText;
				messagesEl.scrollTop = messagesEl.scrollHeight;
			}
		} catch (err) {
			fullText = err instanceof Error ? err.message : String(err);
		}

		finalizeAiMessage(aiMsgEl, fullText);
		history.push({ role: "ai", content: fullText });

		sending = false;
		sendBtn.disabled = false;
		textarea.focus();
	}

	sendBtn.addEventListener("click", () => {
		void send();
	});
	textarea.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			void send();
		}
	});

	// ── History button ──
	histBtn.addEventListener("click", async () => {
		const ctx = options.getCurrentContext?.();
		if (!ctx) {
			showHistoryModal([], options.loadXml);
			return;
		}
		const checkpoints = await listCheckpoints(ctx.projectId, ctx.fileId);
		showHistoryModal(checkpoints, options.loadXml);
	});

	// ── Open/close ──
	function open(): void {
		panel.classList.add("ai-panel-open");
		void checkStatus();
		textarea.focus();
	}

	function close(): void {
		panel.classList.remove("ai-panel-open");
	}

	return { panel, open, close };
}

export { DEFAULT_SERVER };
