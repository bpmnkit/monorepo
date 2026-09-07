import { BpmnCanvas } from "@bpmnkit/canvas"
import { Bpmn, Dmn, Form, compactify, optimize } from "@bpmnkit/core"
import type { BpmnDefinitions, BpmnOperation, CompactDiagram } from "@bpmnkit/core"
import { saveCheckpoint } from "../history/index.js"
import { injectAiBridgeStyles } from "./css.js"

export const DEFAULT_SERVER = "http://localhost:3033"

export interface NodeContext {
	id: string
	type: string
	name?: string
}

export interface PanelOptions {
	serverUrl: string
	getDefinitions(): BpmnDefinitions | null
	loadXml(xml: string): void
	getCurrentContext?(): { projectId: string; fileId: string } | null
	getTheme?(): "dark" | "light"
	/** Called when the user requests creation of a companion DMN or Form file. */
	createCompanionFile?(name: string, type: "dmn" | "form", content: string): Promise<void>
}

interface ChatMessage {
	role: "user" | "ai"
	content: string
}

interface ContextRef {
	node: NodeContext
	pinned: boolean
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
	let res: Response
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
		})
	} catch (err) {
		if (err instanceof Error && err.name === "AbortError") return
		throw err
	}
	if (!res.ok || !res.body) throw new Error(`Server returned ${res.status}`)

	const reader = res.body.getReader()
	const decoder = new TextDecoder()
	let buf = ""
	try {
		while (!signal.aborted) {
			const { done, value } = await reader.read()
			if (done || signal.aborted) break
			buf += decoder.decode(value, { stream: true })
			const parts = buf.split("\n\n")
			buf = parts.pop() ?? ""
			for (const part of parts) {
				const line = part.startsWith("data: ") ? part.slice(6) : part
				const trimmed = line.trim()
				if (!trimmed) continue
				try {
					const event = JSON.parse(trimmed) as {
						type: string
						text?: string
						message?: string
						xml?: string
					}
					if (event.type === "token" && event.text) yield event.text
					if (event.type === "xml" && event.xml) onXml?.(event.xml)
					if (event.type === "done") return
					if (event.type === "error") throw new Error(event.message ?? event.text ?? "AI error")
				} catch (e) {
					if (e instanceof SyntaxError) continue
					throw e
				}
			}
		}
	} finally {
		reader.releaseLock()
	}
}

async function* streamImprove(
	serverUrl: string,
	xml: string,
	backend: string,
	signal: AbortSignal,
	onOps?: (ops: BpmnOperation[], autoFixCount: number) => void,
	onXml?: (xml: string) => void,
): AsyncGenerator<string> {
	let res: Response
	try {
		res = await fetch(`${serverUrl}/improve`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				// The whole model, not a compact projection of it: the server applies
				// the operations to this, so pools, lanes, data wiring and ioMapping
				// detail survive an edit. It compactifies for the prompt itself.
				xml,
				instruction: null,
				backend: backend === "auto" ? null : backend,
			}),
			signal,
		})
	} catch (err) {
		if (err instanceof Error && err.name === "AbortError") return
		throw err
	}
	if (!res.ok || !res.body) throw new Error(`Server returned ${res.status}`)

	const reader = res.body.getReader()
	const decoder = new TextDecoder()
	let buf = ""
	try {
		while (!signal.aborted) {
			const { done, value } = await reader.read()
			if (done || signal.aborted) break
			buf += decoder.decode(value, { stream: true })
			const parts = buf.split("\n\n")
			buf = parts.pop() ?? ""
			for (const part of parts) {
				const line = part.startsWith("data: ") ? part.slice(6) : part
				const trimmed = line.trim()
				if (!trimmed) continue
				try {
					const event = JSON.parse(trimmed) as {
						type: string
						text?: string
						message?: string
						xml?: string
						ops?: BpmnOperation[]
						autoFixCount?: number
					}
					if (event.type === "token" && event.text) yield event.text
					if (event.type === "ops") onOps?.(event.ops ?? [], event.autoFixCount ?? 0)
					if (event.type === "xml" && event.xml) onXml?.(event.xml)
					if (event.type === "done") return
					if (event.type === "error") throw new Error(event.message ?? event.text ?? "AI error")
				} catch (e) {
					if (e instanceof SyntaxError) continue
					throw e
				}
			}
		}
	} finally {
		reader.releaseLock()
	}
}

// ── Approval-request detection ────────────────────────────────────────────────

const APPROVAL_PATTERNS = [
	/\bapprove\b/i,
	/\bapproval\b/i,
	/\bready to apply\b/i,
	/\bonce you confirm\b/i,
	/\bshall I\b/i,
	/\bwould you like me to\b/i,
	/\bwant me to\b/i,
	/\bproceed\?/i,
	/\bgo ahead\?/i,
	/\bconfirm\?/i,
	/ready\?/i,
	/\bgrant permission\b/i,
	/\bneed permission\b/i,
	/\bplease (?:grant|give|allow)\b/i,
	/\bonce you (?:grant|give|allow)\b/i,
]

function looksLikeApprovalRequest(text: string): boolean {
	return APPROVAL_PATTERNS.some((re) => re.test(text))
}

// ── Minimal markdown renderer ─────────────────────────────────────────────────
// Safe: all text goes through textContent / createTextNode — no innerHTML.

function renderInline(text: string, container: HTMLElement): void {
	const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g
	let last = 0
	let match: RegExpExecArray | null
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop pattern
	while ((match = regex.exec(text)) !== null) {
		if (match.index > last) {
			container.append(document.createTextNode(text.slice(last, match.index)))
		}
		if (match[1] !== undefined) {
			const el = document.createElement("strong")
			el.textContent = match[1]
			container.append(el)
		} else if (match[2] !== undefined) {
			const el = document.createElement("em")
			el.textContent = match[2]
			container.append(el)
		} else if (match[3] !== undefined) {
			const el = document.createElement("code")
			el.className = "ai-md-code"
			el.textContent = match[3]
			container.append(el)
		}
		last = match.index + match[0].length
	}
	if (last < text.length) {
		container.append(document.createTextNode(text.slice(last)))
	}
}

function renderMarkdown(text: string): DocumentFragment {
	const frag = document.createDocumentFragment()
	// Split on fenced code blocks first so their content is never processed
	const parts = text.split(/(```[\s\S]*?```)/)

	for (const part of parts) {
		if (part.startsWith("```")) {
			const firstNl = part.indexOf("\n")
			const pre = document.createElement("pre")
			pre.className = "ai-msg-code"
			pre.textContent = firstNl !== -1 ? part.slice(firstNl + 1, -3) : part.slice(3, -3)
			frag.append(pre)
			continue
		}

		// Split by paragraph breaks (one or more blank lines)
		const blocks = part.split(/\n{2,}/)
		for (const block of blocks) {
			const trimmed = block.trim()
			if (!trimmed) continue
			const lines = trimmed.split("\n")

			// Heading (single line starting with #)
			const headingMatch = /^(#{1,3}) +(.+)/.exec(lines[0] ?? "")
			if (lines.length === 1 && headingMatch) {
				const level = (headingMatch[1]?.length ?? 1) as 1 | 2 | 3
				const h = document.createElement(`h${level}`)
				h.className = "ai-md-h"
				renderInline(headingMatch[2]?.trim() ?? "", h)
				frag.append(h)
				continue
			}

			// List block — all lines match bullet or ordered marker
			if (lines.every((l) => /^[-*] /.test(l) || /^\d+\. /.test(l))) {
				const isOrdered = /^\d+\. /.test(lines[0] ?? "")
				const list = document.createElement(isOrdered ? "ol" : "ul")
				list.className = "ai-md-list"
				for (const line of lines) {
					if (!line.trim()) continue
					const li = document.createElement("li")
					renderInline(line.replace(/^[-*] /, "").replace(/^\d+\. /, ""), li)
					list.append(li)
				}
				frag.append(list)
				continue
			}

			// Regular paragraph
			const p = document.createElement("p")
			p.className = "ai-md-p"
			renderInline(lines.join("\n"), p)
			frag.append(p)
		}
	}

	return frag
}

// ── Improve diff helpers ──────────────────────────────────────────────────────

function describeOp(op: BpmnOperation): string {
	switch (op.op) {
		case "rename":
			return `Rename to "${op.name}"`
		case "update":
			return "Update element properties"
		case "delete":
			return "Remove element"
		case "insert":
			return `Add ${op.element.type}${op.element.name ? ` "${op.element.name}"` : ""}`
		case "add_flow":
			return `Add flow: ${op.from} → ${op.to}`
		case "delete_flow":
			return "Remove flow"
		case "redirect_flow":
			return "Redirect flow"
	}
}

function classifyOps(ops: BpmnOperation[]): { changedIds: string[]; newIds: string[] } {
	const changedIds: string[] = []
	const newIds: string[] = []
	for (const op of ops) {
		if (op.op === "rename" || op.op === "update") changedIds.push(op.id)
		else if (op.op === "delete_flow" || op.op === "redirect_flow") changedIds.push(op.id)
		else if (op.op === "insert") newIds.push(op.element.id)
		else if (op.op === "add_flow" && op.id) newIds.push(op.id)
	}
	return { changedIds, newIds }
}

// ── Panel ─────────────────────────────────────────────────────────────────────

const NEW_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8"/><path d="M12 2l2 2-6 6H6v-2l6-6z"/></svg>`

const EXAMPLE_PROMPTS = [
	"Create a loan approval process with review and decision steps",
	"Add error handling and boundary events to all service tasks",
	"Explain what this process does in plain language",
	"Optimize and simplify this diagram — remove redundant elements",
]

// ── Variable flow context builder ─────────────────────────────────────────────

function buildVariableFlowContext(defs: BpmnDefinitions): Record<string, unknown> {
	const report = optimize(defs, { categories: ["data-flow"] })
	const byElement: Record<string, { produces?: string[]; consumes?: string[] }> = {}
	const undefinedVars: string[] = []
	const deadOutputs: string[] = []

	for (const f of report.findings) {
		const elId = f.elementIds[0]
		if (f.id.startsWith("data-flow/role:") && elId !== undefined) {
			byElement[elId] = {
				...(f.produces?.length ? { produces: f.produces } : {}),
				...(f.consumes?.length ? { consumes: f.consumes } : {}),
			}
		} else if (f.id.startsWith("data-flow/undefined-variable:") && f.consumes?.[0] !== undefined) {
			undefinedVars.push(f.consumes[0])
		} else if (f.id.startsWith("data-flow/dead-output:") && f.produces?.[0] !== undefined) {
			deadOutputs.push(f.produces[0])
		}
	}

	return { byElement, undefinedVars, deadOutputs }
}

function buildContext(defs: BpmnDefinitions): Record<string, unknown> {
	return { ...compactify(defs), variableFlow: buildVariableFlowContext(defs) }
}

export function createAiPanel(options: PanelOptions): {
	panel: HTMLElement
	open(): void
	close(): void
	setContext(node: NodeContext | null): void
	submit(prompt: string): void
} {
	injectAiBridgeStyles()

	const panel = document.createElement("div")
	panel.className = "ai-panel"

	// ── Header ──
	const header = document.createElement("div")
	header.className = "ai-panel-header"

	const titleEl = document.createElement("span")
	titleEl.className = "ai-panel-title"
	titleEl.textContent = "AI Assistant"

	const actions = document.createElement("div")
	actions.className = "ai-panel-header-actions"

	const backendSelect = document.createElement("select")
	backendSelect.className = "ai-backend-select"
	for (const [value, label] of [
		["auto", "Auto"],
		["claude", "Claude"],
		["copilot", "Copilot"],
		["gemini", "Gemini"],
	] as const) {
		const opt = document.createElement("option")
		opt.value = value
		opt.textContent = label
		backendSelect.append(opt)
	}
	backendSelect.value = localStorage.getItem("bpmnkit-ai-backend") ?? "auto"
	backendSelect.addEventListener("change", () => {
		localStorage.setItem("bpmnkit-ai-backend", backendSelect.value)
	})

	const clearBtn = document.createElement("button")
	clearBtn.className = "ai-hdr-btn"
	clearBtn.title = "New conversation"
	clearBtn.innerHTML = NEW_ICON
	clearBtn.addEventListener("click", clearConversation)

	const closeBtn = document.createElement("button")
	closeBtn.className = "ai-hdr-btn"
	closeBtn.title = "Close"
	closeBtn.textContent = "×"
	closeBtn.addEventListener("click", () => close())

	actions.append(backendSelect, clearBtn, closeBtn)
	header.append(titleEl, actions)

	// ── Status bar ──
	const statusBar = document.createElement("div")
	statusBar.className = "ai-panel-status"

	const statusEl = document.createElement("span")
	statusBar.append(statusEl)

	// ── Messages ──
	const messagesEl = document.createElement("div")
	messagesEl.className = "ai-messages"

	// Welcome state (shown when no messages yet)
	const welcomeEl = document.createElement("div")
	welcomeEl.className = "ai-welcome"

	const welcomeTitle = document.createElement("div")
	welcomeTitle.className = "ai-welcome-title"
	welcomeTitle.textContent = "BPMN AI Assistant"

	const welcomeSub = document.createElement("div")
	welcomeSub.className = "ai-welcome-sub"
	welcomeSub.textContent = "Ask me to create, modify, or explain your diagram"

	const examplesEl = document.createElement("div")
	examplesEl.className = "ai-welcome-examples"
	for (const prompt of EXAMPLE_PROMPTS) {
		const btn = document.createElement("button")
		btn.className = "ai-welcome-example"
		btn.textContent = prompt
		btn.addEventListener("click", () => {
			textarea.value = prompt
			autoGrow()
			textarea.focus()
		})
		examplesEl.append(btn)
	}

	welcomeEl.append(welcomeTitle, welcomeSub, examplesEl)
	messagesEl.append(welcomeEl)

	// ── Quick actions ──
	const quickActions = document.createElement("div")
	quickActions.className = "ai-quick-actions"

	const improveBtn = document.createElement("button")
	improveBtn.className = "ai-quick-btn"
	improveBtn.textContent = "✦ Improve"
	improveBtn.title = "Analyze and improve the current diagram"

	const explainBtn = document.createElement("button")
	explainBtn.className = "ai-quick-btn"
	explainBtn.textContent = "Explain diagram"
	explainBtn.title = "Explain what this diagram does"

	const explainElementBtn = document.createElement("button")
	explainElementBtn.className = "ai-quick-btn"
	explainElementBtn.textContent = "Explain element"
	explainElementBtn.title = "Select a node in the diagram to explain it"
	explainElementBtn.disabled = true

	quickActions.append(improveBtn, explainBtn, explainElementBtn)

	// ── Context references (badge strip shown above input when a node is referenced) ──
	const contextRefsEl = document.createElement("div")
	contextRefsEl.className = "ai-context-refs"
	contextRefsEl.style.display = "none"

	// ── Input area ──
	const inputArea = document.createElement("div")
	inputArea.className = "ai-input-area"

	const textarea = document.createElement("textarea")
	textarea.className = "ai-textarea"
	textarea.placeholder = "Ask AI to create or modify the diagram…"
	textarea.rows = 2

	const stopBtn = document.createElement("button")
	stopBtn.className = "ai-stop-btn"
	stopBtn.textContent = "Stop"
	stopBtn.style.display = "none"
	stopBtn.addEventListener("click", () => _abortCtrl?.abort())

	const sendBtn = document.createElement("button")
	sendBtn.className = "ai-send-btn"
	sendBtn.textContent = "Send"

	inputArea.append(textarea, stopBtn, sendBtn)

	// ── Input hint ──
	const inputHint = document.createElement("div")
	inputHint.className = "ai-input-hint"
	inputHint.textContent = "Enter to send · Shift+Enter for new line"

	panel.append(header, statusBar, messagesEl, quickActions, contextRefsEl, inputArea, inputHint)

	// ── State ──
	const history: ChatMessage[] = []
	const _previewCanvases: BpmnCanvas[] = []
	let sending = false
	let _refs: ContextRef[] = []
	let _abortCtrl: AbortController | null = null
	let _hasMessages = false

	// ── Server status check ──
	async function checkStatus(): Promise<void> {
		statusBar.className = "ai-panel-status"
		statusEl.textContent = "Checking server…"
		try {
			const res = await fetch(`${options.serverUrl}/status`, { signal: AbortSignal.timeout(3000) })
			const data = (await res.json()) as { ready: boolean; available: string[] }
			if (data.ready) {
				statusBar.className = "ai-panel-status ai-panel-status-ok"
				statusEl.textContent = `Connected · ${data.available.join(", ")} available`
			} else {
				showNotRunning()
			}
		} catch {
			showNotRunning()
		}
	}

	function showNotRunning(): void {
		statusBar.className = "ai-panel-status ai-panel-status-err"
		statusEl.textContent = "AI server not running. Start with:"
		for (const el of Array.from(statusBar.querySelectorAll("code"))) el.remove()
		const code = document.createElement("code")
		code.textContent = "pnpx @bpmnkit/ai-server"
		code.title = "or: npx @bpmnkit/ai-server"
		statusBar.append(code)
	}

	// ── UI busy state ──
	function setUiBusy(busy: boolean): void {
		sending = busy
		sendBtn.style.display = busy ? "none" : ""
		stopBtn.style.display = busy ? "" : "none"
		improveBtn.disabled = busy
		explainBtn.disabled = busy
		explainElementBtn.disabled = busy || _refs.length === 0
	}

	// ── Auto-grow textarea ──
	function autoGrow(): void {
		textarea.style.height = "auto"
		textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
	}
	textarea.addEventListener("input", autoGrow)

	// ── Context references ──
	function setContext(node: NodeContext | null): void {
		// Replace unpinned refs; pinned ones survive selection changes
		_refs = _refs.filter((r) => r.pinned)
		if (node && !_refs.some((r) => r.node.id === node.id)) {
			_refs.push({ node, pinned: false })
		}
		renderContextRefs()
		if (!sending) {
			explainElementBtn.disabled = _refs.length === 0
		}
	}

	function renderContextRefs(): void {
		contextRefsEl.innerHTML = ""

		const singleRef = _refs.length === 1 ? _refs[0] : null
		explainElementBtn.textContent = singleRef?.node.name
			? `Explain "${singleRef.node.name}"`
			: singleRef
				? `Explain ${singleRef.node.type}`
				: "Explain element"
		explainElementBtn.title = singleRef
			? `Explain the selected ${singleRef.node.type}`
			: "Select a node in the diagram to explain it"

		if (_refs.length === 0) {
			contextRefsEl.style.display = "none"
			return
		}
		contextRefsEl.style.display = ""

		for (const ref of _refs) {
			const badge = document.createElement("div")
			badge.className = ref.pinned
				? "ai-context-badge ai-context-badge--pinned"
				: "ai-context-badge"
			badge.title = ref.pinned ? `id: ${ref.node.id}` : `Double-click to pin · id: ${ref.node.id}`

			const label = document.createElement("span")
			label.className = "ai-context-badge__label"
			label.textContent = ref.node.name ? `${ref.node.name} (${ref.node.type})` : ref.node.type

			badge.addEventListener("dblclick", () => {
				ref.pinned = true
				renderContextRefs()
			})

			const removeBtn = document.createElement("button")
			removeBtn.className = "ai-context-badge__remove"
			removeBtn.textContent = "×"
			removeBtn.title = "Remove reference"
			removeBtn.addEventListener("click", () => {
				_refs = _refs.filter((r) => r !== ref)
				renderContextRefs()
				if (!sending) explainElementBtn.disabled = _refs.length === 0
			})

			badge.append(label, removeBtn)
			contextRefsEl.appendChild(badge)
		}
	}

	// ── Message rendering ──
	function ensureMessagesVisible(): void {
		if (!_hasMessages) {
			_hasMessages = true
			welcomeEl.style.display = "none"
		}
	}

	function addMessage(role: "user" | "ai", content: string, context?: NodeContext[]): HTMLElement {
		ensureMessagesVisible()

		const msg = document.createElement("div")
		msg.className = role === "user" ? "ai-msg ai-msg-user" : "ai-msg ai-msg-ai"

		if (role === "user" && context && context.length > 0) {
			const chipsEl = document.createElement("div")
			chipsEl.className = "ai-msg-chips"
			for (const node of context) {
				const chip = document.createElement("div")
				chip.className = "ai-msg-context-chip"
				chip.textContent = node.name ? `${node.name} (${node.type})` : node.type
				chip.title = `id: ${node.id}`
				chipsEl.append(chip)
			}
			msg.append(chipsEl)
			const textEl = document.createElement("div")
			textEl.textContent = content
			msg.append(textEl)
		} else {
			msg.textContent = content
		}

		messagesEl.append(msg)
		messagesEl.scrollTop = messagesEl.scrollHeight
		return msg
	}

	// ── Companion file detection ──────────────────────────────────────────────

	function showCompanionOffer(
		msgEl: HTMLElement,
		xml: string,
		createFn: (name: string, type: "dmn" | "form", content: string) => Promise<void>,
	): void {
		let defs: BpmnDefinitions
		try {
			defs = Bpmn.parse(xml)
		} catch {
			return
		}
		const compact = compactify(defs)

		const dmnRefs: Array<{ decisionId: string; taskName?: string }> = []
		const formRefs: Array<{ formId: string; taskName?: string }> = []
		const seenDecisions = new Set<string>()
		const seenForms = new Set<string>()

		for (const proc of compact.processes) {
			for (const el of proc.elements) {
				if (el.decisionId && !seenDecisions.has(el.decisionId)) {
					seenDecisions.add(el.decisionId)
					dmnRefs.push({ decisionId: el.decisionId, taskName: el.name })
				}
				if (el.formId && !seenForms.has(el.formId)) {
					seenForms.add(el.formId)
					formRefs.push({ formId: el.formId, taskName: el.name })
				}
			}
		}

		if (dmnRefs.length === 0 && formRefs.length === 0) return

		const offer = document.createElement("div")
		offer.className = "ai-companion-offer"

		const title = document.createElement("div")
		title.className = "ai-companion-title"
		title.textContent = "This diagram references external files:"
		offer.append(title)

		function makeRow(label: string, onCreate: () => Promise<void>): void {
			const row = document.createElement("div")
			row.className = "ai-companion-row"
			const labelEl = document.createElement("span")
			labelEl.textContent = label
			const createBtn = document.createElement("button")
			createBtn.className = "ai-companion-create"
			createBtn.textContent = "Create"
			createBtn.addEventListener("click", async () => {
				createBtn.disabled = true
				createBtn.textContent = "Creating…"
				try {
					await onCreate()
					createBtn.textContent = "Created ✓"
				} catch (err) {
					createBtn.disabled = false
					createBtn.textContent = `Failed: ${String(err)}`
				}
			})
			row.append(labelEl, createBtn)
			offer.append(row)
		}

		for (const ref of dmnRefs) {
			const fileName = `${ref.decisionId}.dmn`
			const label = ref.taskName ? `${ref.taskName} → ${fileName}` : fileName
			makeRow(`📊 ${label}`, async () => {
				const dmnDefs = Dmn.createDecisionTable(ref.decisionId)
					.name(ref.taskName ?? ref.decisionId)
					.build()
				const content = Dmn.export(dmnDefs)
				await createFn(fileName, "dmn", content)
			})
		}

		for (const ref of formRefs) {
			const fileName = `${ref.formId}.form`
			const label = ref.taskName ? `${ref.taskName} → ${fileName}` : fileName
			makeRow(`📝 ${label}`, async () => {
				const formDef = Form.makeEmpty(ref.formId)
				const content = Form.export(formDef)
				await createFn(fileName, "form", content)
			})
		}

		msgEl.append(offer)
		messagesEl.scrollTop = messagesEl.scrollHeight
	}

	function finalizeAiMessage(msgEl: HTMLElement, fullText: string, directXml?: string): void {
		msgEl.classList.remove("ai-msg-cursor")
		while (msgEl.firstChild) msgEl.removeChild(msgEl.firstChild)

		// Render as markdown
		msgEl.append(renderMarkdown(fullText))

		// Diagram preview + apply button when XML is available
		if (directXml !== undefined) {
			const previewEl = document.createElement("div")
			previewEl.className = "ai-msg-preview"
			const canvas = new BpmnCanvas({
				container: previewEl,
				xml: directXml,
				grid: false,
				fit: "contain",
				theme: options.getTheme?.() ?? "dark",
			})
			_previewCanvases.push(canvas)
			msgEl.append(previewEl)
		}

		// Action row: copy + optional apply
		const actionRow = document.createElement("div")
		actionRow.className = "ai-msg-actions"

		const copyBtn = document.createElement("button")
		copyBtn.className = "ai-msg-copy"
		copyBtn.textContent = "Copy"
		copyBtn.addEventListener("click", () => {
			void navigator.clipboard
				.writeText(fullText)
				.then(() => {
					copyBtn.textContent = "Copied!"
					setTimeout(() => {
						copyBtn.textContent = "Copy"
					}, 2000)
				})
				.catch(() => {
					copyBtn.textContent = "Failed"
					setTimeout(() => {
						copyBtn.textContent = "Copy"
					}, 2000)
				})
		})
		actionRow.append(copyBtn)

		if (directXml !== undefined) {
			const applyBtn = document.createElement("button")
			applyBtn.className = "ai-msg-apply"
			applyBtn.textContent = "Apply to diagram"
			applyBtn.addEventListener("click", async () => {
				applyBtn.disabled = true
				applyBtn.textContent = "Applying…"
				try {
					const currentDefs = options.getDefinitions()
					if (currentDefs) {
						const ctx = options.getCurrentContext?.()
						if (ctx) {
							await saveCheckpoint(ctx.projectId, ctx.fileId, Bpmn.export(currentDefs))
						}
					}
					options.loadXml(directXml)
					applyBtn.textContent = "Applied ✓"
					// Detect companion file references and offer to create them
					if (options.createCompanionFile) {
						showCompanionOffer(msgEl, directXml, options.createCompanionFile)
					}
				} catch (err) {
					applyBtn.disabled = false
					applyBtn.textContent = `Apply failed: ${String(err)}`
				}
			})
			actionRow.append(applyBtn)
		} else if (looksLikeApprovalRequest(fullText)) {
			const approveBtn = document.createElement("button")
			approveBtn.className = "ai-msg-approve"
			approveBtn.textContent = "✓ Approve"
			approveBtn.addEventListener("click", () => {
				approveBtn.disabled = true
				textarea.value = "Approved, please proceed."
				void send()
			})
			actionRow.append(approveBtn)
		}

		msgEl.append(actionRow)
		messagesEl.scrollTop = messagesEl.scrollHeight
	}

	// ── Finalize improve message (diff view + preview + apply) ──
	function finalizeImproveMessage(
		msgEl: HTMLElement,
		fullText: string,
		ops: BpmnOperation[],
		autoFixCount: number,
		resultXml: string | undefined,
	): void {
		msgEl.classList.remove("ai-msg-cursor")
		while (msgEl.firstChild) msgEl.removeChild(msgEl.firstChild)

		msgEl.append(renderMarkdown(fullText))

		// Diff section: auto-fix summary + AI-suggested operations
		if (autoFixCount > 0 || ops.length > 0) {
			const diffEl = document.createElement("div")
			diffEl.className = "ai-improve-diff"

			if (autoFixCount > 0) {
				const autoFixNote = document.createElement("div")
				autoFixNote.className = "ai-improve-autofix"
				autoFixNote.textContent = `✓ ${autoFixCount} issue${autoFixCount === 1 ? "" : "s"} auto-fixed`
				diffEl.append(autoFixNote)
			}

			if (ops.length > 0) {
				const opsList = document.createElement("ul")
				opsList.className = "ai-improve-ops"
				for (const op of ops) {
					const li = document.createElement("li")
					li.className = `ai-improve-op ai-improve-op--${op.op}`
					li.textContent = describeOp(op)
					opsList.append(li)
				}
				diffEl.append(opsList)
			}

			msgEl.append(diffEl)
		}

		// Canvas preview with highlights for changed/new elements
		if (resultXml !== undefined) {
			const previewEl = document.createElement("div")
			previewEl.className = "ai-msg-preview"
			const canvas = new BpmnCanvas({
				container: previewEl,
				xml: resultXml,
				grid: false,
				fit: "contain",
				theme: options.getTheme?.() ?? "dark",
			})
			_previewCanvases.push(canvas)

			if (ops.length > 0) {
				const { changedIds, newIds } = classifyOps(ops)
				requestAnimationFrame(() => {
					if (changedIds.length > 0) canvas.highlight(changedIds, "changed")
					if (newIds.length > 0) canvas.highlight(newIds, "new")
				})
			}

			msgEl.append(previewEl)
		}

		// Action row: copy + apply
		const actionRow = document.createElement("div")
		actionRow.className = "ai-msg-actions"

		const copyBtn = document.createElement("button")
		copyBtn.className = "ai-msg-copy"
		copyBtn.textContent = "Copy"
		copyBtn.addEventListener("click", () => {
			void navigator.clipboard
				.writeText(fullText)
				.then(() => {
					copyBtn.textContent = "Copied!"
					setTimeout(() => {
						copyBtn.textContent = "Copy"
					}, 2000)
				})
				.catch(() => {
					copyBtn.textContent = "Failed"
					setTimeout(() => {
						copyBtn.textContent = "Copy"
					}, 2000)
				})
		})
		actionRow.append(copyBtn)

		if (resultXml !== undefined) {
			const applyBtn = document.createElement("button")
			applyBtn.className = "ai-msg-apply"
			applyBtn.textContent = "Apply to diagram"
			applyBtn.addEventListener("click", async () => {
				applyBtn.disabled = true
				applyBtn.textContent = "Applying…"
				try {
					const currentDefs = options.getDefinitions()
					if (currentDefs) {
						const ctx = options.getCurrentContext?.()
						if (ctx) {
							await saveCheckpoint(ctx.projectId, ctx.fileId, Bpmn.export(currentDefs))
						}
					}
					options.loadXml(resultXml)
					applyBtn.textContent = "Applied ✓"
					if (options.createCompanionFile) {
						showCompanionOffer(msgEl, resultXml, options.createCompanionFile)
					}
				} catch (err) {
					applyBtn.disabled = false
					applyBtn.textContent = `Apply failed: ${String(err)}`
				}
			})
			actionRow.append(applyBtn)
		}

		msgEl.append(actionRow)
		messagesEl.scrollTop = messagesEl.scrollHeight
	}

	// ── Clear conversation ──
	function clearConversation(): void {
		history.length = 0
		_hasMessages = false
		for (const child of Array.from(messagesEl.children)) {
			if (child !== welcomeEl) child.remove()
		}
		welcomeEl.style.display = ""
		for (const c of _previewCanvases) c.destroy()
		_previewCanvases.length = 0
	}

	// ── Core streaming helper ──
	async function runStream(
		messages: ChatMessage[],
		context: unknown,
		action: string | undefined,
		signal: AbortSignal,
		aiMsgEl: HTMLElement,
	): Promise<{ fullText: string; resultXml: string | undefined }> {
		let fullText = ""
		let resultXml: string | undefined
		try {
			for await (const token of streamChat(
				options.serverUrl,
				messages,
				context,
				backendSelect.value,
				signal,
				action,
				(xml) => {
					resultXml = xml
				},
			)) {
				fullText += token
				aiMsgEl.textContent = fullText
				messagesEl.scrollTop = messagesEl.scrollHeight
			}
		} catch (err) {
			if (!signal.aborted) {
				fullText = `${fullText ? `${fullText}\n\n` : ""}Error: ${err instanceof Error ? err.message : String(err)}`
			}
		}
		return { fullText, resultXml }
	}

	// ── Send user message ──
	async function send(): Promise<void> {
		const text = textarea.value.trim()
		if (!text || sending) return

		_abortCtrl = new AbortController()
		const signal = _abortCtrl.signal
		setUiBusy(true)
		textarea.value = ""
		textarea.style.height = ""

		const contextNodes = _refs.map((r) => r.node)
		const promptContent =
			contextNodes.length > 0
				? `[Context: ${contextNodes.map((n) => `"${n.name ?? n.type}" (${n.type}, id: ${n.id})`).join(", ")}]\n\n${text}`
				: text

		const userMsg: ChatMessage = { role: "user", content: promptContent }
		history.push(userMsg)
		addMessage("user", text, contextNodes.length > 0 ? contextNodes : undefined)

		const aiMsgEl = addMessage("ai", "")
		aiMsgEl.classList.add("ai-msg-cursor")

		const defs = options.getDefinitions()
		const diagramContext = defs ? buildContext(defs) : null
		const { fullText, resultXml } = await runStream(
			history,
			diagramContext,
			undefined,
			signal,
			aiMsgEl,
		)

		finalizeAiMessage(aiMsgEl, fullText, resultXml)
		history.push({ role: "ai", content: fullText })

		_abortCtrl = null
		setUiBusy(false)
		textarea.focus()
	}

	// ── Send a quick action ──
	async function sendAction(label: string, action: string, includeContext = false): Promise<void> {
		if (sending) return
		const defs = options.getDefinitions()
		if (!defs) return

		_abortCtrl = new AbortController()
		const signal = _abortCtrl.signal
		setUiBusy(true)

		const contextNodes = includeContext ? _refs.map((r) => r.node) : []
		const promptContent =
			contextNodes.length > 0
				? `[Context: ${contextNodes.map((n) => `"${n.name ?? n.type}" (${n.type}, id: ${n.id})`).join(", ")}]\n\n${label}`
				: label

		const userMsg: ChatMessage = { role: "user", content: promptContent }
		history.push(userMsg)
		addMessage("user", label, contextNodes.length > 0 ? contextNodes : undefined)

		const aiMsgEl = addMessage("ai", "")
		aiMsgEl.classList.add("ai-msg-cursor")

		const context = buildContext(defs)
		const { fullText, resultXml } = await runStream(history, context, action, signal, aiMsgEl)

		finalizeAiMessage(aiMsgEl, fullText, resultXml)
		history.push({ role: "ai", content: fullText })

		_abortCtrl = null
		setUiBusy(false)
		textarea.focus()
	}

	// ── Improve with /improve endpoint ──
	async function sendImprove(): Promise<void> {
		if (sending) return
		const defs = options.getDefinitions()
		if (!defs) return

		_abortCtrl = new AbortController()
		const signal = _abortCtrl.signal
		setUiBusy(true)

		history.push({ role: "user", content: "Improve this diagram" })
		addMessage("user", "Improve this diagram")

		const aiMsgEl = addMessage("ai", "")
		aiMsgEl.classList.add("ai-msg-cursor")

		let capturedOps: BpmnOperation[] = []
		let capturedAutoFixCount = 0
		let capturedXml: string | undefined

		let fullText = ""
		try {
			for await (const token of streamImprove(
				options.serverUrl,
				Bpmn.export(defs),
				backendSelect.value,
				signal,
				(ops, autoFixCount) => {
					capturedOps = ops
					capturedAutoFixCount = autoFixCount
				},
				(xml) => {
					capturedXml = xml
				},
			)) {
				fullText += token
				aiMsgEl.textContent = fullText
				messagesEl.scrollTop = messagesEl.scrollHeight
			}
		} catch (err) {
			if (!signal.aborted) {
				fullText = `${fullText ? `${fullText}\n\n` : ""}Error: ${err instanceof Error ? err.message : String(err)}`
			}
		}

		finalizeImproveMessage(aiMsgEl, fullText, capturedOps, capturedAutoFixCount, capturedXml)
		history.push({ role: "ai", content: fullText })

		_abortCtrl = null
		setUiBusy(false)
		textarea.focus()
	}

	// ── Event wiring ──
	improveBtn.addEventListener("click", () => void sendImprove())
	explainBtn.addEventListener("click", () => void sendAction("Explain this diagram", "explain"))
	explainElementBtn.addEventListener(
		"click",
		() => void sendAction("Explain this element", "explain", true),
	)

	sendBtn.addEventListener("click", () => void send())
	textarea.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			void send()
		}
	})

	// ── Open/close ──
	function open(): void {
		panel.classList.add("ai-panel-open")
		void checkStatus()
		textarea.focus()
	}

	function close(): void {
		panel.classList.remove("ai-panel-open")
	}

	/** Open the panel, pre-fill the given prompt, and submit it immediately. */
	function submit(prompt: string): void {
		open()
		textarea.value = prompt
		autoGrow()
		void send()
	}

	return { panel, open, close, setContext, submit }
}
