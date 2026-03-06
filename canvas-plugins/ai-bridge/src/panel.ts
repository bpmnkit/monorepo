import { saveCheckpoint } from "@bpmn-sdk/canvas-plugin-history";
import { Bpmn, compactify } from "@bpmn-sdk/core";
import type { BpmnDefinitions } from "@bpmn-sdk/core";
import { injectAiBridgeStyles } from "./css.js";

const DEFAULT_SERVER = "http://localhost:3033";

export interface NodeContext {
	id: string;
	type: string;
	name?: string;
}

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

interface ContextRef {
	node: NodeContext;
	pinned: boolean;
}

// ── SSE streaming ─────────────────────────────────────────────────────────────

async function* streamChat(
	serverUrl: string,
	messages: ChatMessage[],
	context: unknown,
	backend: string,
	signal: AbortSignal,
	action?: string,
	onXml?: (xml: string) => void,
): AsyncGenerator<string> {
	let res: Response;
	try {
		res = await fetch(`${serverUrl}/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				messages,
				context,
				backend: backend === "auto" ? null : backend,
				action: action ?? null,
			}),
			signal,
		});
	} catch (err) {
		if (err instanceof Error && err.name === "AbortError") return;
		throw err;
	}
	if (!res.ok || !res.body) throw new Error(`Server returned ${res.status}`);

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buf = "";
	try {
		while (!signal.aborted) {
			const { done, value } = await reader.read();
			if (done || signal.aborted) break;
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

// ── Minimal markdown renderer ─────────────────────────────────────────────────
// Safe: all text goes through textContent / createTextNode — no innerHTML.

function renderInline(text: string, container: HTMLElement): void {
	const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g;
	let last = 0;
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop pattern
	while ((match = regex.exec(text)) !== null) {
		if (match.index > last) {
			container.append(document.createTextNode(text.slice(last, match.index)));
		}
		if (match[1] !== undefined) {
			const el = document.createElement("strong");
			el.textContent = match[1];
			container.append(el);
		} else if (match[2] !== undefined) {
			const el = document.createElement("em");
			el.textContent = match[2];
			container.append(el);
		} else if (match[3] !== undefined) {
			const el = document.createElement("code");
			el.className = "ai-md-code";
			el.textContent = match[3];
			container.append(el);
		}
		last = match.index + match[0].length;
	}
	if (last < text.length) {
		container.append(document.createTextNode(text.slice(last)));
	}
}

function renderMarkdown(text: string): DocumentFragment {
	const frag = document.createDocumentFragment();
	// Split on fenced code blocks first so their content is never processed
	const parts = text.split(/(```[\s\S]*?```)/);

	for (const part of parts) {
		if (part.startsWith("```")) {
			const firstNl = part.indexOf("\n");
			const pre = document.createElement("pre");
			pre.className = "ai-msg-code";
			pre.textContent = firstNl !== -1 ? part.slice(firstNl + 1, -3) : part.slice(3, -3);
			frag.append(pre);
			continue;
		}

		// Split by paragraph breaks (one or more blank lines)
		const blocks = part.split(/\n{2,}/);
		for (const block of blocks) {
			const trimmed = block.trim();
			if (!trimmed) continue;
			const lines = trimmed.split("\n");

			// Heading (single line starting with #)
			const headingMatch = /^(#{1,3}) +(.+)/.exec(lines[0] ?? "");
			if (lines.length === 1 && headingMatch) {
				const level = (headingMatch[1]?.length ?? 1) as 1 | 2 | 3;
				const h = document.createElement(`h${level}`);
				h.className = "ai-md-h";
				renderInline(headingMatch[2]?.trim() ?? "", h);
				frag.append(h);
				continue;
			}

			// List block — all lines match bullet or ordered marker
			if (lines.every((l) => /^[-*] /.test(l) || /^\d+\. /.test(l))) {
				const isOrdered = /^\d+\. /.test(lines[0] ?? "");
				const list = document.createElement(isOrdered ? "ol" : "ul");
				list.className = "ai-md-list";
				for (const line of lines) {
					if (!line.trim()) continue;
					const li = document.createElement("li");
					renderInline(line.replace(/^[-*] /, "").replace(/^\d+\. /, ""), li);
					list.append(li);
				}
				frag.append(list);
				continue;
			}

			// Regular paragraph
			const p = document.createElement("p");
			p.className = "ai-md-p";
			renderInline(lines.join("\n"), p);
			frag.append(p);
		}
	}

	return frag;
}

// ── Panel ─────────────────────────────────────────────────────────────────────

const NEW_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8"/><path d="M12 2l2 2-6 6H6v-2l6-6z"/></svg>`;

const EXAMPLE_PROMPTS = [
	"Create a loan approval process with review and decision steps",
	"Add error handling and boundary events to all service tasks",
	"Explain what this process does in plain language",
	"Optimize and simplify this diagram — remove redundant elements",
];

export function createAiPanel(options: PanelOptions): {
	panel: HTMLElement;
	open(): void;
	close(): void;
	setContext(node: NodeContext | null): void;
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

	const clearBtn = document.createElement("button");
	clearBtn.className = "ai-hdr-btn";
	clearBtn.title = "New conversation";
	clearBtn.innerHTML = NEW_ICON;
	clearBtn.addEventListener("click", clearConversation);

	const closeBtn = document.createElement("button");
	closeBtn.className = "ai-hdr-btn";
	closeBtn.title = "Close";
	closeBtn.textContent = "×";
	closeBtn.addEventListener("click", () => close());

	actions.append(backendSelect, clearBtn, closeBtn);
	header.append(titleEl, actions);

	// ── Status bar ──
	const statusBar = document.createElement("div");
	statusBar.className = "ai-panel-status";

	const statusEl = document.createElement("span");
	statusBar.append(statusEl);

	// ── Messages ──
	const messagesEl = document.createElement("div");
	messagesEl.className = "ai-messages";

	// Welcome state (shown when no messages yet)
	const welcomeEl = document.createElement("div");
	welcomeEl.className = "ai-welcome";

	const welcomeTitle = document.createElement("div");
	welcomeTitle.className = "ai-welcome-title";
	welcomeTitle.textContent = "BPMN AI Assistant";

	const welcomeSub = document.createElement("div");
	welcomeSub.className = "ai-welcome-sub";
	welcomeSub.textContent = "Ask me to create, modify, or explain your diagram";

	const examplesEl = document.createElement("div");
	examplesEl.className = "ai-welcome-examples";
	for (const prompt of EXAMPLE_PROMPTS) {
		const btn = document.createElement("button");
		btn.className = "ai-welcome-example";
		btn.textContent = prompt;
		btn.addEventListener("click", () => {
			textarea.value = prompt;
			autoGrow();
			textarea.focus();
		});
		examplesEl.append(btn);
	}

	welcomeEl.append(welcomeTitle, welcomeSub, examplesEl);
	messagesEl.append(welcomeEl);

	// ── Quick actions ──
	const quickActions = document.createElement("div");
	quickActions.className = "ai-quick-actions";

	const improveBtn = document.createElement("button");
	improveBtn.className = "ai-quick-btn";
	improveBtn.textContent = "✦ Improve";
	improveBtn.title = "Analyze and improve the current diagram";

	const explainBtn = document.createElement("button");
	explainBtn.className = "ai-quick-btn";
	explainBtn.textContent = "Explain diagram";
	explainBtn.title = "Explain what this diagram does";

	const explainElementBtn = document.createElement("button");
	explainElementBtn.className = "ai-quick-btn";
	explainElementBtn.textContent = "Explain element";
	explainElementBtn.title = "Select a node in the diagram to explain it";
	explainElementBtn.disabled = true;

	quickActions.append(improveBtn, explainBtn, explainElementBtn);

	// ── Context references (badge strip shown above input when a node is referenced) ──
	const contextRefsEl = document.createElement("div");
	contextRefsEl.className = "ai-context-refs";
	contextRefsEl.style.display = "none";

	// ── Input area ──
	const inputArea = document.createElement("div");
	inputArea.className = "ai-input-area";

	const textarea = document.createElement("textarea");
	textarea.className = "ai-textarea";
	textarea.placeholder = "Ask AI to create or modify the diagram…";
	textarea.rows = 2;

	const stopBtn = document.createElement("button");
	stopBtn.className = "ai-stop-btn";
	stopBtn.textContent = "Stop";
	stopBtn.style.display = "none";
	stopBtn.addEventListener("click", () => _abortCtrl?.abort());

	const sendBtn = document.createElement("button");
	sendBtn.className = "ai-send-btn";
	sendBtn.textContent = "Send";

	inputArea.append(textarea, stopBtn, sendBtn);

	// ── Input hint ──
	const inputHint = document.createElement("div");
	inputHint.className = "ai-input-hint";
	inputHint.textContent = "Enter to send · Shift+Enter for new line";

	panel.append(header, statusBar, messagesEl, quickActions, contextRefsEl, inputArea, inputHint);

	// ── State ──
	const history: ChatMessage[] = [];
	let sending = false;
	let _refs: ContextRef[] = [];
	let _abortCtrl: AbortController | null = null;
	let _hasMessages = false;

	// ── Server status check ──
	async function checkStatus(): Promise<void> {
		statusBar.className = "ai-panel-status";
		statusEl.textContent = "Checking server…";
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

	function showNotRunning(): void {
		statusBar.className = "ai-panel-status ai-panel-status-err";
		statusEl.textContent = "AI server not running. Start with:";
		statusBar.querySelector("code")?.remove();
		const code = document.createElement("code");
		code.textContent = "pnpm ai-server";
		statusBar.append(code);
	}

	// ── UI busy state ──
	function setUiBusy(busy: boolean): void {
		sending = busy;
		sendBtn.style.display = busy ? "none" : "";
		stopBtn.style.display = busy ? "" : "none";
		improveBtn.disabled = busy;
		explainBtn.disabled = busy;
		explainElementBtn.disabled = busy || _refs.length === 0;
	}

	// ── Auto-grow textarea ──
	function autoGrow(): void {
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
	}
	textarea.addEventListener("input", autoGrow);

	// ── Context references ──
	function setContext(node: NodeContext | null): void {
		// Replace unpinned refs; pinned ones survive selection changes
		_refs = _refs.filter((r) => r.pinned);
		if (node && !_refs.some((r) => r.node.id === node.id)) {
			_refs.push({ node, pinned: false });
		}
		renderContextRefs();
		if (!sending) {
			explainElementBtn.disabled = _refs.length === 0;
		}
	}

	function renderContextRefs(): void {
		contextRefsEl.innerHTML = "";

		const singleRef = _refs.length === 1 ? _refs[0] : null;
		explainElementBtn.textContent = singleRef?.node.name
			? `Explain "${singleRef.node.name}"`
			: singleRef
				? `Explain ${singleRef.node.type}`
				: "Explain element";
		explainElementBtn.title = singleRef
			? `Explain the selected ${singleRef.node.type}`
			: "Select a node in the diagram to explain it";

		if (_refs.length === 0) {
			contextRefsEl.style.display = "none";
			return;
		}
		contextRefsEl.style.display = "";

		for (const ref of _refs) {
			const badge = document.createElement("div");
			badge.className = ref.pinned
				? "ai-context-badge ai-context-badge--pinned"
				: "ai-context-badge";
			badge.title = ref.pinned ? `id: ${ref.node.id}` : `Double-click to pin · id: ${ref.node.id}`;

			const label = document.createElement("span");
			label.className = "ai-context-badge__label";
			label.textContent = ref.node.name ? `${ref.node.name} (${ref.node.type})` : ref.node.type;

			badge.addEventListener("dblclick", () => {
				ref.pinned = true;
				renderContextRefs();
			});

			const removeBtn = document.createElement("button");
			removeBtn.className = "ai-context-badge__remove";
			removeBtn.textContent = "×";
			removeBtn.title = "Remove reference";
			removeBtn.addEventListener("click", () => {
				_refs = _refs.filter((r) => r !== ref);
				renderContextRefs();
				if (!sending) explainElementBtn.disabled = _refs.length === 0;
			});

			badge.append(label, removeBtn);
			contextRefsEl.appendChild(badge);
		}
	}

	// ── Message rendering ──
	function ensureMessagesVisible(): void {
		if (!_hasMessages) {
			_hasMessages = true;
			welcomeEl.style.display = "none";
		}
	}

	function addMessage(role: "user" | "ai", content: string, context?: NodeContext[]): HTMLElement {
		ensureMessagesVisible();

		const msg = document.createElement("div");
		msg.className = role === "user" ? "ai-msg ai-msg-user" : "ai-msg ai-msg-ai";

		if (role === "user" && context && context.length > 0) {
			const chipsEl = document.createElement("div");
			chipsEl.className = "ai-msg-chips";
			for (const node of context) {
				const chip = document.createElement("div");
				chip.className = "ai-msg-context-chip";
				chip.textContent = node.name ? `${node.name} (${node.type})` : node.type;
				chip.title = `id: ${node.id}`;
				chipsEl.append(chip);
			}
			msg.append(chipsEl);
			const textEl = document.createElement("div");
			textEl.textContent = content;
			msg.append(textEl);
		} else {
			msg.textContent = content;
		}

		messagesEl.append(msg);
		messagesEl.scrollTop = messagesEl.scrollHeight;
		return msg;
	}

	function finalizeAiMessage(msgEl: HTMLElement, fullText: string, directXml?: string): void {
		msgEl.classList.remove("ai-msg-cursor");
		while (msgEl.firstChild) msgEl.removeChild(msgEl.firstChild);

		// Render as markdown
		msgEl.append(renderMarkdown(fullText));

		// Action row: copy + optional apply
		const actionRow = document.createElement("div");
		actionRow.className = "ai-msg-actions";

		const copyBtn = document.createElement("button");
		copyBtn.className = "ai-msg-copy";
		copyBtn.textContent = "Copy";
		copyBtn.addEventListener("click", () => {
			void navigator.clipboard
				.writeText(fullText)
				.then(() => {
					copyBtn.textContent = "Copied!";
					setTimeout(() => {
						copyBtn.textContent = "Copy";
					}, 2000);
				})
				.catch(() => {
					copyBtn.textContent = "Failed";
					setTimeout(() => {
						copyBtn.textContent = "Copy";
					}, 2000);
				});
		});
		actionRow.append(copyBtn);

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
			actionRow.append(applyBtn);
		}

		msgEl.append(actionRow);
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	// ── Clear conversation ──
	function clearConversation(): void {
		history.length = 0;
		_hasMessages = false;
		for (const child of Array.from(messagesEl.children)) {
			if (child !== welcomeEl) child.remove();
		}
		welcomeEl.style.display = "";
	}

	// ── Core streaming helper ──
	async function runStream(
		messages: ChatMessage[],
		context: unknown,
		action: string | undefined,
		signal: AbortSignal,
		aiMsgEl: HTMLElement,
	): Promise<{ fullText: string; resultXml: string | undefined }> {
		let fullText = "";
		let resultXml: string | undefined;
		try {
			for await (const token of streamChat(
				options.serverUrl,
				messages,
				context,
				backendSelect.value,
				signal,
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
			if (!signal.aborted) {
				fullText = `${fullText ? `${fullText}\n\n` : ""}Error: ${err instanceof Error ? err.message : String(err)}`;
			}
		}
		return { fullText, resultXml };
	}

	// ── Send user message ──
	async function send(): Promise<void> {
		const text = textarea.value.trim();
		if (!text || sending) return;

		_abortCtrl = new AbortController();
		const signal = _abortCtrl.signal;
		setUiBusy(true);
		textarea.value = "";
		textarea.style.height = "";

		const contextNodes = _refs.map((r) => r.node);
		const promptContent =
			contextNodes.length > 0
				? `[Context: ${contextNodes.map((n) => `"${n.name ?? n.type}" (${n.type}, id: ${n.id})`).join(", ")}]\n\n${text}`
				: text;

		const userMsg: ChatMessage = { role: "user", content: promptContent };
		history.push(userMsg);
		addMessage("user", text, contextNodes.length > 0 ? contextNodes : undefined);

		const aiMsgEl = addMessage("ai", "");
		aiMsgEl.classList.add("ai-msg-cursor");

		const defs = options.getDefinitions();
		const diagramContext = defs ? compactify(defs) : null;
		const { fullText, resultXml } = await runStream(
			history,
			diagramContext,
			undefined,
			signal,
			aiMsgEl,
		);

		finalizeAiMessage(aiMsgEl, fullText, resultXml);
		history.push({ role: "ai", content: fullText });

		_abortCtrl = null;
		setUiBusy(false);
		textarea.focus();
	}

	// ── Send a quick action ──
	async function sendAction(label: string, action: string, includeContext = false): Promise<void> {
		if (sending) return;
		const defs = options.getDefinitions();
		if (!defs) return;

		_abortCtrl = new AbortController();
		const signal = _abortCtrl.signal;
		setUiBusy(true);

		const contextNodes = includeContext ? _refs.map((r) => r.node) : [];
		const promptContent =
			contextNodes.length > 0
				? `[Context: ${contextNodes.map((n) => `"${n.name ?? n.type}" (${n.type}, id: ${n.id})`).join(", ")}]\n\n${label}`
				: label;

		const userMsg: ChatMessage = { role: "user", content: promptContent };
		history.push(userMsg);
		addMessage("user", label, contextNodes.length > 0 ? contextNodes : undefined);

		const aiMsgEl = addMessage("ai", "");
		aiMsgEl.classList.add("ai-msg-cursor");

		const context = compactify(defs);
		const { fullText, resultXml } = await runStream(history, context, action, signal, aiMsgEl);

		finalizeAiMessage(aiMsgEl, fullText, resultXml);
		history.push({ role: "ai", content: fullText });

		_abortCtrl = null;
		setUiBusy(false);
		textarea.focus();
	}

	// ── Event wiring ──
	improveBtn.addEventListener("click", () => void sendAction("Improve this diagram", "improve"));
	explainBtn.addEventListener("click", () => void sendAction("Explain this diagram", "explain"));
	explainElementBtn.addEventListener(
		"click",
		() => void sendAction("Explain this element", "explain", true),
	);

	sendBtn.addEventListener("click", () => void send());
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

	return { panel, open, close, setContext };
}

export { DEFAULT_SERVER };
