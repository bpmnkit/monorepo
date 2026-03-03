import { saveCheckpoint } from "@bpmn-sdk/canvas-plugin-history";
import { Bpmn, compactify } from "@bpmn-sdk/core";
import type { BpmnDefinitions } from "@bpmn-sdk/core";
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
	action?: string,
	onXml?: (xml: string) => void,
): AsyncGenerator<string> {
	const res = await fetch(`${serverUrl}/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			messages,
			context,
			backend: backend === "auto" ? null : backend,
			action: action ?? null,
		}),
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
					const event = JSON.parse(trimmed) as {
						type: string;
						text?: string;
						message?: string;
						xml?: string;
					};
					if (event.type === "token" && event.text) yield event.text;
					if (event.type === "xml" && event.xml) onXml?.(event.xml);
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
		["gemini", "Gemini"],
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

	const closeBtn = document.createElement("button");
	closeBtn.className = "ai-hdr-btn";
	closeBtn.title = "Close";
	closeBtn.textContent = "×";
	closeBtn.addEventListener("click", () => close());

	actions.append(backendSelect, closeBtn);
	header.append(titleEl, actions);

	// ── Status bar ──
	const statusBar = document.createElement("div");
	statusBar.className = "ai-panel-status";
	statusBar.textContent = "Checking server…";

	// ── Messages ──
	const messagesEl = document.createElement("div");
	messagesEl.className = "ai-messages";

	// ── Quick actions ──
	const quickActions = document.createElement("div");
	quickActions.className = "ai-quick-actions";

	const improveBtn = document.createElement("button");
	improveBtn.className = "ai-quick-btn";
	improveBtn.textContent = "✦ Improve diagram";
	improveBtn.title = "Analyze and improve the current diagram";
	quickActions.append(improveBtn);

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
	panel.append(header, statusBar, messagesEl, quickActions, inputArea);

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
		// Remove any previously appended code element before adding a new one
		statusBar.querySelector("code")?.remove();
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

	function finalizeAiMessage(msgEl: HTMLElement, fullText: string, directXml?: string): void {
		msgEl.classList.remove("ai-msg-cursor");
		msgEl.textContent = "";

		// Render text — highlight JSON code blocks if present, otherwise plain text.
		// In MCP mode the LLM returns plain prose (no JSON block); in fallback mode it
		// returns a CompactDiagram code block. Both cases must support the apply button.
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
		} else {
			msgEl.textContent = fullText;
		}

		// Show the apply button whenever the server produced validated XML —
		// independent of whether the response text contained a JSON code block.
		if (directXml !== undefined) {
			const applyBtn = document.createElement("button");
			applyBtn.className = "ai-msg-apply";
			applyBtn.textContent = "Apply to diagram";
			applyBtn.addEventListener("click", async () => {
				applyBtn.disabled = true;
				applyBtn.textContent = "Applying…";
				try {
					const currentDefs = options.getDefinitions();
					if (currentDefs) {
						const ctx = options.getCurrentContext?.();
						if (ctx) {
							await saveCheckpoint(ctx.projectId, ctx.fileId, Bpmn.export(currentDefs));
						}
					}
					options.loadXml(directXml);
					applyBtn.textContent = "Applied ✓";
				} catch (err) {
					applyBtn.disabled = false;
					applyBtn.textContent = `Apply failed: ${String(err)}`;
				}
			});
			msgEl.append(applyBtn);
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

		// Capture the validated XML that the server produces via core expand+export.
		let resultXml: string | undefined;

		let fullText = "";
		try {
			for await (const token of streamChat(
				options.serverUrl,
				history,
				context,
				backendSelect.value,
				undefined,
				(xml) => {
					resultXml = xml;
				},
			)) {
				fullText += token;
				aiMsgEl.textContent = fullText;
				messagesEl.scrollTop = messagesEl.scrollHeight;
			}
		} catch (err) {
			fullText = err instanceof Error ? err.message : String(err);
		}

		finalizeAiMessage(aiMsgEl, fullText, resultXml);
		history.push({ role: "ai", content: fullText });

		sending = false;
		sendBtn.disabled = false;
		textarea.focus();
	}

	// ── Send with a specific action (quick-action buttons) ──
	async function sendAction(label: string, action: string): Promise<void> {
		if (sending) return;
		const defs = options.getDefinitions();
		if (!defs) return;

		sending = true;
		sendBtn.disabled = true;
		improveBtn.disabled = true;

		const userMsg: ChatMessage = { role: "user", content: label };
		history.push(userMsg);
		addMessage("user", label);

		const aiMsgEl = addMessage("ai", "");
		aiMsgEl.classList.add("ai-msg-cursor");

		const context = compactify(defs);

		// Server will emit a { type: "xml" } event after streaming when it has
		// validated and expanded the CompactDiagram via the core package.
		let resultXml: string | undefined;

		let fullText = "";
		try {
			for await (const token of streamChat(
				options.serverUrl,
				history,
				context,
				backendSelect.value,
				action,
				(xml) => {
					resultXml = xml;
				},
			)) {
				fullText += token;
				aiMsgEl.textContent = fullText;
				messagesEl.scrollTop = messagesEl.scrollHeight;
			}
		} catch (err) {
			fullText = err instanceof Error ? err.message : String(err);
		}

		finalizeAiMessage(aiMsgEl, fullText, resultXml);
		history.push({ role: "ai", content: fullText });

		sending = false;
		sendBtn.disabled = false;
		improveBtn.disabled = false;
		textarea.focus();
	}

	improveBtn.addEventListener("click", () => {
		void sendAction("Improve this diagram", "improve");
	});

	sendBtn.addEventListener("click", () => {
		void send();
	});
	textarea.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			void send();
		}
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
