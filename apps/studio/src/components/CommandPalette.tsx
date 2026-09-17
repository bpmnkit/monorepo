import { BpmnCanvas } from "@bpmnkit/canvas"
import { compactify } from "@bpmnkit/core"
import type { BpmnOperation } from "@bpmnkit/core"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ArrowUpRight, ChevronLeft, Search, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "preact/hooks"
import { useLocation } from "wouter"
import { getProxyUrl } from "../api/client.js"
import { navigateWithTransition } from "../lib/transition.js"
import { useThemeStore } from "../stores/theme.js"
import type { AiBackend, AiMessage, ContextCommand } from "../stores/ui.js"
import { useUiStore } from "../stores/ui.js"

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommandItem {
	id: string
	label: string
	description?: string
	group: string
	action: () => void
	shortcut?: string
	/** If true, executing this item does not close the palette. */
	preventClose?: boolean
}

// ── Matching ──────────────────────────────────────────────────────────────────

function matchesQuery(label: string, query: string): boolean {
	if (!query.trim()) return true
	const q = query.toLowerCase().trim()
	const l = label.toLowerCase()
	if (l.includes(q)) return true
	const tokens = q.split(/\s+/)
	const words = l.split(/[\s\-_/]+/)
	return tokens.every((t) => words.some((w) => w.startsWith(t)))
}

// ── Highlight matched substring ───────────────────────────────────────────────

function HighlightLabel({ label, query }: { label: string; query: string }) {
	const q = query.trim()
	if (!q) return <>{label}</>
	const idx = label.toLowerCase().indexOf(q.toLowerCase())
	if (idx === -1) return <>{label}</>
	return (
		<>
			{label.slice(0, idx)}
			<span className="text-accent">{label.slice(idx, idx + q.length)}</span>
			{label.slice(idx + q.length)}
		</>
	)
}

// ── Keyboard shortcut badge ───────────────────────────────────────────────────

function ShortcutBadge({ shortcut }: { shortcut: string }) {
	const parts = shortcut.split(" ")
	return (
		<span className="flex items-center gap-0.5 shrink-0 ml-4">
			{parts.map((part, i) => (
				<kbd key={String(i)} className="ds-kbd inline-flex h-[18px] items-center">
					{part}
				</kbd>
			))}
		</span>
	)
}

// ── Footer hint ───────────────────────────────────────────────────────────────

function HintKbd({ children }: { children: string }) {
	return <kbd className="ds-kbd inline-flex h-4 items-center">{children}</kbd>
}

// ── Thinking indicator ────────────────────────────────────────────────────────

function ThinkingDots() {
	return (
		<div className="flex items-center gap-1 py-1">
			<span className="h-2 w-2 rounded-full bg-accent animate-bounce [animation-delay:-0.3s]" />
			<span className="h-2 w-2 rounded-full bg-accent animate-bounce [animation-delay:-0.15s]" />
			<span className="h-2 w-2 rounded-full bg-accent animate-bounce" />
		</div>
	)
}

// ── Backend selector ──────────────────────────────────────────────────────────

function BackendSelector() {
	const { aiBackend, aiAvailableBackends, setAiBackend } = useUiStore()

	useEffect(() => {
		const { setAiAvailableBackends } = useUiStore.getState()
		fetch(`${getProxyUrl()}/status`)
			.then((r) => r.json())
			.then((d: { available?: string[] }) => {
				if (Array.isArray(d.available)) setAiAvailableBackends(d.available)
			})
			.catch(() => {})
	}, [])

	const displayName =
		aiBackend === "auto"
			? aiAvailableBackends[0]
				? capitalize(aiAvailableBackends[0])
				: "Auto"
			: capitalize(aiBackend)

	return (
		<div className="relative inline-flex items-center">
			<select
				value={aiBackend}
				onChange={(e) => setAiBackend((e.target as HTMLSelectElement).value as AiBackend)}
				className="ds-field ds-datum cursor-pointer appearance-none py-0.5 pr-5 text-[11px] text-muted hover:text-fg"
				aria-label="Select AI backend"
			>
				<option value="auto">
					Auto ({aiAvailableBackends[0] ? capitalize(aiAvailableBackends[0]) : "?"})
				</option>
				{aiAvailableBackends.map((b) => (
					<option key={b} value={b}>
						{capitalize(b)}
					</option>
				))}
			</select>
			<span className="pointer-events-none absolute right-1.5 text-[9px] text-muted">▾</span>
		</div>
	)
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── BPMN XML Preview ──────────────────────────────────────────────────────────

function XmlPreview({ xml }: { xml: string }) {
	const containerRef = useRef<HTMLDivElement>(null)
	const { theme } = useThemeStore()

	useEffect(() => {
		const container = containerRef.current
		if (!container) return
		const canvas = new BpmnCanvas({
			container,
			theme: theme === "light" ? "light" : "dark",
			grid: false,
			fit: "contain",
		})
		void canvas.load(xml)
		return () => canvas.destroy()
	}, [xml, theme])

	return (
		<div
			ref={containerRef}
			className="ds-box mt-2 overflow-hidden bg-canvas"
			style={{ height: 160 }}
		/>
	)
}

// ── Inline AI Chat ────────────────────────────────────────────────────────────

interface InlineAiChatProps {
	initialQuery: string
	onOpenInSidebar(): void
	onBack(): void
}

function InlineAiChat({ initialQuery, onOpenInSidebar, onBack }: InlineAiChatProps) {
	const { editorAiContext, aiMessages, aiBackend, pushAiMessage, updateAiMessage } = useUiStore()
	const [input, setInput] = useState("")
	const [loading, setLoading] = useState(false)
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLTextAreaElement>(null)

	// biome-ignore lint/correctness/useExhaustiveDependencies: send once on mount with initial query
	useEffect(() => {
		void sendMessage(initialQuery)
	}, [])

	const messageCount = aiMessages.length
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on count change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [messageCount])

	async function sendMessage(text?: string) {
		const msgText = (text ?? input).trim()
		if (!msgText || loading) return

		const userMsg: AiMessage = { id: crypto.randomUUID(), role: "user", content: msgText }
		// Use store snapshot for building the history payload (before adding new messages)
		const historyPayload = useUiStore.getState().aiMessages
		pushAiMessage(userMsg)
		if (!text) setInput("")
		setLoading(true)

		const assistantId = crypto.randomUUID()
		pushAiMessage({ id: assistantId, role: "assistant", content: "" })

		const backendParam = aiBackend === "auto" ? null : aiBackend

		try {
			let url: string
			let body: unknown

			if (editorAiContext) {
				const defs = editorAiContext.getDefinitions()
				const context = defs ? compactify(defs) : null
				url = `${getProxyUrl()}/chat`
				body = {
					messages: [...historyPayload, userMsg].map((m) => ({
						role: m.role === "assistant" ? "ai" : m.role,
						content: m.content,
					})),
					context,
					backend: backendParam,
				}
			} else {
				url = `${getProxyUrl()}/operate/chat`
				body = {
					messages: [...historyPayload, userMsg].map((m) => ({
						role: m.role,
						content: m.content,
					})),
					backend: backendParam,
				}
			}

			const response = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			})

			if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let accumulated = ""
			let xmlReceived: string | null = null

			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				const chunk = decoder.decode(value, { stream: true })
				for (const line of chunk.split("\n")) {
					if (!line.startsWith("data: ")) continue
					try {
						const parsed = JSON.parse(line.slice(6)) as
							| { type: "token"; text: string }
							| { type: "xml"; xml: string }
							| { type: "done" }
							| { type: "error"; message: string }
						if (parsed.type === "done") break
						if (parsed.type === "error") throw new Error(parsed.message)
						if (parsed.type === "xml") xmlReceived = parsed.xml
						if (parsed.type === "token") {
							accumulated += parsed.text
							updateAiMessage(assistantId, { content: accumulated })
						}
					} catch (e) {
						if (e instanceof SyntaxError) continue
						throw e
					}
				}
			}

			if (xmlReceived) updateAiMessage(assistantId, { xml: xmlReceived })
		} catch (err) {
			updateAiMessage(assistantId, {
				content: `Error: ${err instanceof Error ? err.message : String(err)}`,
			})
		} finally {
			setLoading(false)
			setTimeout(() => inputRef.current?.focus(), 50)
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			void sendMessage()
		}
		if (e.key === "Escape") {
			e.preventDefault()
			onBack()
		}
	}

	// Find the last message with xml to show apply button
	const lastXmlMsg = [...aiMessages].reverse().find((m) => m.xml)

	return (
		<div className="flex flex-col" style={{ maxHeight: 520 }}>
			{/* Chat header */}
			<div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
				<button
					type="button"
					onClick={onBack}
					className="text-muted hover:text-fg shrink-0 transition-colors"
					aria-label="Back to commands"
				>
					<ChevronLeft size={16} />
				</button>
				<Sparkles size={13} className="text-accent shrink-0" />
				<span className="ds-eyebrow flex-1">AI Chat</span>
				<BackendSelector />
				<button
					type="button"
					onClick={onOpenInSidebar}
					className="ds-label ml-1 flex shrink-0 items-center gap-1 transition-colors hover:text-fg"
					title="Continue in sidebar"
				>
					<ArrowUpRight size={13} />
					Sidebar
				</button>
			</div>

			{/* Messages */}
			<div className="overflow-y-auto p-3 space-y-2.5 min-h-0" style={{ maxHeight: 340 }}>
				{aiMessages.length === 0 && (
					<p className="ds-lede py-6 text-center text-xs">Ask anything…</p>
				)}
				{aiMessages.map((msg) => (
					<div
						key={msg.id}
						className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
					>
						<div
							className={`max-w-[88%] px-3 py-2 text-sm ${
								msg.role === "user" ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg"
							}`}
						>
							{msg.content && msg.content}
							{!msg.content && loading && msg.role === "assistant" && <ThinkingDots />}
						</div>
						{/* BPMN preview inline */}
						{msg.xml && editorAiContext && (
							<div className="w-full max-w-full mt-1">
								<XmlPreview xml={msg.xml} />
								<div className="flex items-center justify-between mt-1 px-1">
									<span className="ds-label ds-label--micro">Diagram ready</span>
									<button
										type="button"
										onClick={() => msg.xml && editorAiContext.loadXml(msg.xml)}
										className="ds-label ds-label--micro text-accent hover:underline"
									>
										Apply to editor
									</button>
								</div>
							</div>
						)}
					</div>
				))}
				{/* Apply button for last xml if not already shown (non-editor context shouldn't happen but safe) */}
				{lastXmlMsg?.xml && !editorAiContext && (
					<div className="ds-note text-sm">
						<Sparkles size={13} className="shrink-0 text-accent" />
						<span className="flex-1 text-fg text-xs">Diagram ready</span>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Input */}
			<div className="border-t border-border px-3 py-2.5">
				<textarea
					ref={inputRef}
					value={input}
					onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
					onKeyDown={handleKeyDown}
					placeholder="Follow up… (Enter to send)"
					className="ds-field w-full resize-none text-sm"
					rows={2}
					disabled={loading}
				/>
				<div className="mt-1 flex items-center justify-between">
					<span className="ds-label ds-label--micro">Shift+Enter for newline · Esc to go back</span>
					{loading && (
						<span className="ds-label ds-label--micro animate-pulse text-accent">Thinking…</span>
					)}
				</div>
			</div>
		</div>
	)
}

// ── Improve mode helpers ──────────────────────────────────────────────────────

function describeOpInline(op: BpmnOperation): string {
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

// ── Inline Improve Mode ───────────────────────────────────────────────────────

interface InlineImproveModeProps {
	onBack(): void
	onOpenInSidebar(): void
}

function InlineImproveMode({ onBack, onOpenInSidebar }: InlineImproveModeProps) {
	const { editorAiContext } = useUiStore()
	const { theme } = useThemeStore()
	const [text, setText] = useState("")
	const [ops, setOps] = useState<BpmnOperation[]>([])
	const [autoFixCount, setAutoFixCount] = useState(0)
	const [xml, setXml] = useState<string | undefined>(undefined)
	const [streaming, setStreaming] = useState(true)
	const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined)
	const canvasContainerRef = useRef<HTMLDivElement>(null)

	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount
	useEffect(() => {
		if (!editorAiContext) return
		const defs = editorAiContext.getDefinitions()
		if (!defs) return
		const compact = compactify(defs)
		const ctrl = new AbortController()

		async function run() {
			try {
				const res = await fetch(`${getProxyUrl()}/improve`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ context: compact, instruction: null, backend: null }),
					signal: ctrl.signal,
				})
				if (!res.ok || !res.body) throw new Error(`Server returned ${res.status}`)

				const reader = res.body.getReader()
				const decoder = new TextDecoder()
				let buf = ""
				while (true) {
					const { done, value } = await reader.read()
					if (done) break
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
							if (event.type === "token" && event.text) setText((t) => t + (event.text ?? ""))
							if (event.type === "ops") {
								setOps(event.ops ?? [])
								setAutoFixCount(event.autoFixCount ?? 0)
							}
							if (event.type === "xml" && event.xml) setXml(event.xml)
							if (event.type === "error") throw new Error(event.message ?? "AI error")
						} catch (e) {
							if (e instanceof SyntaxError) continue
							throw e
						}
					}
				}
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") return
				setErrorMsg(err instanceof Error ? err.message : String(err))
			} finally {
				setStreaming(false)
			}
		}
		void run()
		return () => ctrl.abort()
	}, [])

	// Mount canvas + highlights when xml arrives
	useEffect(() => {
		if (!xml || !canvasContainerRef.current) return
		const canvas = new BpmnCanvas({
			container: canvasContainerRef.current,
			xml,
			grid: false,
			fit: "contain",
			theme: theme === "light" ? "light" : "dark",
		})

		const changedIds = ops
			.filter(
				(op) =>
					op.op === "rename" ||
					op.op === "update" ||
					op.op === "delete_flow" ||
					op.op === "redirect_flow",
			)
			.map((op) => op.id)
		const newIds = [
			...ops.filter((op) => op.op === "insert").map((op) => op.element.id),
			...ops.filter((op) => op.op === "add_flow" && op.id).map((op) => (op as { id: string }).id),
		]
		requestAnimationFrame(() => {
			if (changedIds.length > 0) canvas.highlight(changedIds, "changed")
			if (newIds.length > 0) canvas.highlight(newIds, "new")
		})

		return () => canvas.destroy()
	}, [xml, theme, ops])

	return (
		<div className="flex flex-col" style={{ maxHeight: 520 }}>
			{/* Header */}
			<div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
				<button
					type="button"
					onClick={onBack}
					className="text-muted hover:text-fg shrink-0 transition-colors"
					aria-label="Back to commands"
				>
					<ChevronLeft size={16} />
				</button>
				<Sparkles size={13} className="text-accent shrink-0" />
				<span className="ds-eyebrow flex-1">Improve Diagram</span>
				<button
					type="button"
					onClick={onOpenInSidebar}
					className="ds-label ml-1 flex shrink-0 items-center gap-1 transition-colors hover:text-fg"
					title="Open AI sidebar"
				>
					<ArrowUpRight size={13} />
					Sidebar
				</button>
			</div>

			{/* Content */}
			<div className="overflow-y-auto p-3 space-y-2.5 min-h-0" style={{ maxHeight: 420 }}>
				{/* Explanation text */}
				{(text || streaming) && (
					<div className="whitespace-pre-wrap border-border border-l-2 bg-surface-2 px-3 py-2 text-fg text-sm">
						{text || <ThinkingDots />}
					</div>
				)}

				{errorMsg && (
					<div className="px-3 py-2 text-sm" style={{ color: "var(--bpmnkit-danger, #dc2626)" }}>
						{errorMsg}
					</div>
				)}

				{/* Diff list */}
				{(autoFixCount > 0 || ops.length > 0) && (
					<div className="ds-box text-xs">
						{autoFixCount > 0 && (
							<div
								className="px-3 py-1.5 border-b border-border"
								style={{
									background: "rgba(22,163,74,0.08)",
									color: "var(--bpmnkit-success, #16a34a)",
								}}
							>
								✓ {autoFixCount} issue{autoFixCount === 1 ? "" : "s"} auto-fixed
							</div>
						)}
						{ops.length > 0 && (
							<ul className="divide-y divide-border/50">
								{ops.map((op, i) => {
									const prefix =
										op.op === "insert" || op.op === "add_flow"
											? "+"
											: op.op === "delete" || op.op === "delete_flow"
												? "−"
												: "~"
									const color =
										prefix === "+"
											? "var(--bpmnkit-success, #16a34a)"
											: prefix === "−"
												? "var(--bpmnkit-danger, #dc2626)"
												: "var(--bpmnkit-warn, #d97706)"
									return (
										<li key={String(i)} className="flex items-start gap-2 px-3 py-1.5 text-fg/80">
											<span className="ds-datum shrink-0 font-bold" style={{ color }}>
												{prefix}
											</span>
											<span>{describeOpInline(op)}</span>
										</li>
									)
								})}
							</ul>
						)}
					</div>
				)}

				{/* Canvas preview */}
				{xml && (
					<div>
						<div
							ref={canvasContainerRef}
							className="ds-box overflow-hidden bg-canvas"
							style={{ height: 160 }}
						/>
						<div className="flex items-center justify-between mt-1 px-0.5">
							<span className="ds-label ds-label--micro">Improved diagram</span>
							<button
								type="button"
								onClick={() => editorAiContext?.loadXml(xml)}
								className="ds-label ds-label--micro text-accent hover:underline"
							>
								Apply to editor
							</button>
						</div>
					</div>
				)}

				{!streaming && !xml && !errorMsg && (
					<p className="ds-lede py-2 text-center text-xs">No changes suggested.</p>
				)}
			</div>
		</div>
	)
}

// ── Main component ────────────────────────────────────────────────────────────

interface CommandPaletteProps {
	onNavigate?: (path: string) => void
}

export function CommandPalette({ onNavigate }: CommandPaletteProps) {
	const {
		commandPaletteOpen,
		closeCommandPalette,
		openAI,
		contextCommands,
		paletteViewStack,
		popPaletteView,
		aiMessages,
		editorAiContext,
	} = useUiStore()
	const [, navigate] = useLocation()
	const [query, setQuery] = useState("")
	const [selectedIdx, setSelectedIdx] = useState(0)
	const [chatMode, setChatMode] = useState(false)
	const [chatQuery, setChatQuery] = useState("")
	const [improveMode, setImproveMode] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLDivElement>(null)

	const nav = onNavigate ?? ((path: string) => navigateWithTransition(path, navigate))

	const staticItems: CommandItem[] = [
		{ id: "dash", label: "Go to Dashboard", group: "Navigation", action: () => nav("/") },
		{
			id: "models",
			label: "Go to Models",
			group: "Navigation",
			action: () => nav("/models"),
			shortcut: "g m",
		},
		{
			id: "defs",
			label: "Go to Definitions",
			group: "Navigation",
			action: () => nav("/definitions"),
			shortcut: "g e",
		},
		{
			id: "insts",
			label: "Go to Instances",
			group: "Navigation",
			action: () => nav("/instances"),
			shortcut: "g i",
		},
		{
			id: "incidents",
			label: "Go to Incidents",
			group: "Navigation",
			action: () => nav("/incidents"),
			shortcut: "g n",
		},
		{
			id: "tasks",
			label: "Go to Tasks",
			group: "Navigation",
			action: () => nav("/tasks"),
			shortcut: "g t",
		},
		{
			id: "decisions",
			label: "Go to Decisions",
			group: "Navigation",
			action: () => nav("/decisions"),
			shortcut: "g c",
		},
		{
			id: "settings",
			label: "Go to Settings",
			group: "Navigation",
			action: () => nav("/settings"),
			shortcut: "g s",
		},
		{
			id: "new-model",
			label: "New Model",
			group: "Actions",
			action: () => nav("/models"),
		},
		{
			id: "ask-ai",
			label: "Ask AI",
			group: "Actions",
			action: () => openAI(),
		},
		...(editorAiContext
			? [
					{
						id: "improve-diagram",
						label: "✦ Improve Diagram",
						group: "AI",
						preventClose: true,
						action: () => setImproveMode(true),
					} satisfies CommandItem,
				]
			: []),
	]

	// ── Current view ─────────────────────────────────────────────────────────

	const topView = paletteViewStack[paletteViewStack.length - 1]
	const isInView = paletteViewStack.length > 0
	const isTextInput = isInView && !!topView?.onConfirm && topView.items.length === 0

	// "/" prefix = command-only mode: strip navigation items
	const isCommandMode = !isInView && query.startsWith("/")
	const effectiveQuery = isCommandMode ? query.slice(1) : query

	const listItems: (CommandItem | ContextCommand)[] = isInView
		? (topView?.items ?? [])
		: isCommandMode
			? [...staticItems.filter((i) => i.group !== "Navigation"), ...contextCommands]
			: [...staticItems, ...contextCommands]

	const filtered = listItems.filter((item) => matchesQuery(item.label, effectiveQuery))

	const trimmedQuery = effectiveQuery.trim()
	// Show Ask AI row in root mode when not in command mode and user has typed something or has history
	const showAskAi =
		!isInView && !isCommandMode && (trimmedQuery.length > 0 || aiMessages.length > 0)

	const totalItems = filtered.length + (showAskAi ? 1 : 0)
	const askAiIdx = filtered.length

	function executeAskAi() {
		// If there's already chat history and no new query, just open chat mode
		setChatQuery(trimmedQuery)
		setChatMode(true)
	}

	function handleOpenInSidebar() {
		openAI()
		closeCommandPalette()
	}

	function handleChatBack() {
		setChatMode(false)
	}

	// ── Focus & reset ─────────────────────────────────────────────────────────

	useEffect(() => {
		if (commandPaletteOpen) {
			setQuery("")
			setSelectedIdx(0)
			setTimeout(() => inputRef.current?.focus(), 10)
		} else {
			// Reset modes on close so re-opening starts fresh
			setChatMode(false)
			setImproveMode(false)
		}
	}, [commandPaletteOpen])

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on view stack depth change
	useEffect(() => {
		setQuery("")
		setSelectedIdx(0)
		setTimeout(() => inputRef.current?.focus(), 10)
	}, [paletteViewStack.length])

	// biome-ignore lint/correctness/useExhaustiveDependencies: selectedIdx triggers the scroll
	useEffect(() => {
		const el = listRef.current?.querySelector('[data-selected="true"]') as HTMLElement | null
		el?.scrollIntoView({ block: "nearest" })
	}, [selectedIdx])

	// ── Execute ───────────────────────────────────────────────────────────────

	function execute(item: CommandItem | ContextCommand) {
		if ("preventClose" in item && item.preventClose) {
			item.action()
			return
		}
		const stackBefore = useUiStore.getState().paletteViewStack.length
		item.action()
		const stackAfter = useUiStore.getState().paletteViewStack.length
		if (stackAfter <= stackBefore) closeCommandPalette()
	}

	function handleConfirm(value: string) {
		if (!topView?.onConfirm) return
		topView.onConfirm(value)
		closeCommandPalette()
	}

	// ── Keyboard ──────────────────────────────────────────────────────────────

	function handleQueryChange(newQuery: string) {
		setQuery(newQuery)
		setSelectedIdx(0)
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			e.preventDefault()
			if (isInView) popPaletteView()
			else closeCommandPalette()
			return
		}
		if (isTextInput) {
			if (e.key === "Enter") {
				e.preventDefault()
				handleConfirm(query)
			}
			return
		}
		if (e.key === "ArrowDown") {
			e.preventDefault()
			setSelectedIdx((i) => Math.min(i + 1, totalItems - 1))
		} else if (e.key === "ArrowUp") {
			e.preventDefault()
			setSelectedIdx((i) => Math.max(i - 1, 0))
		} else if (e.key === "Enter") {
			e.preventDefault()
			if (showAskAi && selectedIdx === askAiIdx) {
				executeAskAi()
			} else {
				const item = filtered[selectedIdx]
				if (item) execute(item)
			}
		}
	}

	// ── Render ────────────────────────────────────────────────────────────────

	const groups = isInView ? [] : Array.from(new Set(filtered.map((i) => i.group)))
	const placeholder = isInView
		? (topView?.placeholder ?? "Search…")
		: isCommandMode
			? "Filter commands…"
			: "Search or type / for commands…"

	return (
		<DialogPrimitive.Root
			open={commandPaletteOpen}
			onOpenChange={(open: boolean) => !open && closeCommandPalette()}
		>
			<DialogPrimitive.Portal>
				{/* Backdrop — above everything including the editor dock (z-9999) */}
				<DialogPrimitive.Overlay className="fixed inset-0 z-[10000] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />

				{/* Panel */}
				<DialogPrimitive.Content
					onKeyDown={chatMode || improveMode ? undefined : handleKeyDown}
					aria-label="Command palette"
					className="fixed top-[16%] left-1/2 z-[10001] w-[calc(100%-2rem)] max-w-[620px] -translate-x-1/2 border border-border bg-surface focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-4 data-[state=closed]:slide-out-to-top-2 duration-200"
				>
					<DialogPrimitive.Title className="sr-only">Command Palette</DialogPrimitive.Title>
					<DialogPrimitive.Description className="sr-only">
						Search and execute commands
					</DialogPrimitive.Description>

					{improveMode ? (
						<InlineImproveMode
							onBack={() => setImproveMode(false)}
							onOpenInSidebar={handleOpenInSidebar}
						/>
					) : chatMode ? (
						<InlineAiChat
							key={chatQuery}
							initialQuery={chatQuery}
							onOpenInSidebar={handleOpenInSidebar}
							onBack={handleChatBack}
						/>
					) : (
						<>
							{/* Search row */}
							<div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
								{isInView ? (
									<button
										type="button"
										onClick={() => popPaletteView()}
										className="text-muted hover:text-fg shrink-0 transition-colors"
										aria-label="Back"
									>
										<ChevronLeft size={16} />
									</button>
								) : (
									<Search size={15} className="text-muted shrink-0" />
								)}
								{isCommandMode && (
									<span className="ds-mark ds-mark--accent shrink-0">Commands</span>
								)}
								<input
									ref={inputRef}
									value={query}
									onInput={(e) => handleQueryChange((e.target as HTMLInputElement).value)}
									placeholder={placeholder}
									className="flex-1 bg-transparent text-sm text-fg placeholder:text-muted outline-none"
									aria-label="Command palette search"
									aria-autocomplete="list"
								/>
								<kbd className="ds-kbd hidden h-5 shrink-0 items-center sm:inline-flex">Esc</kbd>
							</div>

							{/* Command list */}
							{!isTextInput && (
								<div ref={listRef} className="max-h-[380px] overflow-y-auto p-1.5">
									{filtered.length === 0 && !showAskAi && (
										<div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
											<Search size={18} className="text-muted/40" />
											<p className="ds-lede">No results for &ldquo;{query}&rdquo;</p>
										</div>
									)}

									{filtered.length === 0 && showAskAi && (
										<div className="ds-label ds-label--micro select-none px-3 pt-2.5 pb-1">
											No matching commands
										</div>
									)}

									{isInView
										? filtered.map((item, idx) => {
												const isSelected = idx === selectedIdx
												return (
													<button
														key={item.id}
														type="button"
														aria-selected={isSelected}
														data-selected={isSelected}
														onClick={() => execute(item)}
														onMouseEnter={() => setSelectedIdx(idx)}
														className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors ${
															isSelected
																? "border-accent bg-accent/10 text-fg"
																: "border-transparent text-fg hover:bg-bg"
														}`}
													>
														<span className="flex-1 truncate">
															<HighlightLabel label={item.label} query={effectiveQuery} />
														</span>
														{"description" in item && item.description && (
															<span className="ds-label ml-4 shrink-0">{item.description}</span>
														)}
													</button>
												)
											})
										: groups.map((group) => {
												const groupItems = filtered.filter((i) => i.group === group)
												return (
													<div key={group} className="mb-0.5 last:mb-0">
														<div className="ds-label ds-label--micro select-none px-3 pt-2.5 pb-1">
															{group}
														</div>
														{groupItems.map((item) => {
															const idx = filtered.indexOf(item)
															const isSelected = idx === selectedIdx
															return (
																<button
																	key={item.id}
																	type="button"
																	aria-selected={isSelected}
																	data-selected={isSelected}
																	onClick={() => execute(item)}
																	onMouseEnter={() => setSelectedIdx(idx)}
																	className={`flex w-full items-center border-l-2 px-3 py-2 text-left text-sm transition-colors ${
																		isSelected
																			? "border-accent bg-accent/10 text-fg"
																			: "border-transparent text-fg hover:bg-bg"
																	}`}
																>
																	<span className="flex-1 truncate">
																		<HighlightLabel label={item.label} query={effectiveQuery} />
																	</span>
																	{"shortcut" in item && item.shortcut ? (
																		<ShortcutBadge shortcut={item.shortcut} />
																	) : "description" in item && item.description ? (
																		<span className="ds-label ml-4 shrink-0">
																			{item.description}
																		</span>
																	) : null}
																</button>
															)
														})}
													</div>
												)
											})}

									{/* Pinned Ask AI / Continue chat row */}
									{showAskAi && (
										<>
											{filtered.length > 0 && (
												<div className="mx-1.5 my-1 border-t border-border" />
											)}
											<button
												type="button"
												data-selected={selectedIdx === askAiIdx}
												onClick={executeAskAi}
												onMouseEnter={() => setSelectedIdx(askAiIdx)}
												className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left text-sm transition-colors ${
													selectedIdx === askAiIdx
														? "border-accent bg-accent/10 text-fg"
														: "border-transparent text-fg hover:bg-bg"
												}`}
											>
												<Sparkles size={14} className="text-accent shrink-0" />
												<span className="flex-1 truncate">
													{trimmedQuery ? (
														<>
															Ask AI: <span className="text-muted italic">{trimmedQuery}</span>
														</>
													) : (
														<span className="text-muted">Continue AI chat</span>
													)}
												</span>
												{aiMessages.length > 0 && (
													<span className="text-[10px] text-muted shrink-0">
														{aiMessages.length} msg{aiMessages.length !== 1 ? "s" : ""}
													</span>
												)}
											</button>
										</>
									)}
								</div>
							)}

							{/* Text-input mode hint */}
							{isTextInput && (
								<div className="flex items-center gap-1.5 px-4 py-3 text-xs text-muted">
									Press
									<kbd className="ds-kbd inline-flex h-[18px] items-center">↵</kbd>
									to confirm,
									<kbd className="ds-kbd inline-flex h-[18px] items-center">Esc</kbd>
									to go back
								</div>
							)}

							{/* Footer */}
							{!isTextInput && totalItems > 0 && (
								<div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted select-none">
									<span className="flex items-center gap-1">
										<HintKbd>↑</HintKbd>
										<HintKbd>↓</HintKbd>
										Navigate
									</span>
									<span className="flex items-center gap-1">
										<HintKbd>↵</HintKbd>
										Select
									</span>
									{isInView && (
										<span className="flex items-center gap-1">
											<HintKbd>Esc</HintKbd>
											Back
										</span>
									)}
								</div>
							)}
						</>
					)}
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	)
}
