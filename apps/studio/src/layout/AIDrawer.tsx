import { BpmnCanvas } from "@bpmnkit/canvas"
import { createAiPanel } from "@bpmnkit/plugins/ai-bridge"
import { X } from "lucide-react"
import { useEffect, useRef, useState } from "preact/hooks"
import { useLocation } from "wouter"
import { getProxyUrl } from "../api/client.js"
import { useThemeStore } from "../stores/theme.js"
import type { AiBackend, AiMessage } from "../stores/ui.js"
import { useUiStore } from "../stores/ui.js"

function getContextLabel(path: string): string {
	if (path.startsWith("/definitions/")) return "Definition"
	if (path === "/definitions") return "Definitions"
	if (path.startsWith("/instances/")) return "Instance"
	if (path === "/instances") return "Instances"
	if (path.startsWith("/incidents/")) return "Incident"
	if (path === "/incidents") return "Incidents"
	if (path.startsWith("/models/")) return "Model"
	if (path === "/models") return "Models"
	if (path.startsWith("/tasks/")) return "Task"
	if (path === "/tasks") return "Tasks"
	if (path === "/") return "Dashboard"
	return "Studio"
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
	const { aiBackend, aiAvailableBackends, setAiBackend, setAiAvailableBackends } = useUiStore()

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetch once on mount
	useEffect(() => {
		fetch(`${getProxyUrl()}/status`)
			.then((r) => r.json())
			.then((d: { available?: string[] }) => {
				if (Array.isArray(d.available)) setAiAvailableBackends(d.available)
			})
			.catch(() => {})
	}, [])

	return (
		<div className="relative inline-flex items-center">
			<select
				value={aiBackend}
				onChange={(e) => setAiBackend((e.target as HTMLSelectElement).value as AiBackend)}
				className="ds-field ds-datum cursor-pointer appearance-none py-0.5 pr-5 text-[11px] text-muted hover:text-fg"
				aria-label="Select AI backend"
			>
				<option value="auto">
					Auto (
					{aiAvailableBackends[0]
						? aiAvailableBackends[0].charAt(0).toUpperCase() + aiAvailableBackends[0].slice(1)
						: "?"}
					)
				</option>
				{aiAvailableBackends.map((b) => (
					<option key={b} value={b}>
						{b.charAt(0).toUpperCase() + b.slice(1)}
					</option>
				))}
			</select>
			<span className="pointer-events-none absolute right-1.5 text-[9px] text-muted">▾</span>
		</div>
	)
}

// ── BPMN XML preview ──────────────────────────────────────────────────────────

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

// ── Editor AI panel (mounts createAiPanel docked) ────────────────────────────

function EditorAiPanel({ onClose }: { onClose(): void }) {
	const { editorAiContext, aiInitialPrompt } = useUiStore()
	const containerRef = useRef<HTMLDivElement>(null)

	// biome-ignore lint/correctness/useExhaustiveDependencies: panel created once per context
	useEffect(() => {
		if (!editorAiContext || !containerRef.current) return

		const panel = createAiPanel({
			serverUrl: getProxyUrl(),
			getDefinitions: editorAiContext.getDefinitions,
			loadXml: editorAiContext.loadXml,
			getTheme: editorAiContext.getTheme,
			createCompanionFile: editorAiContext.createCompanionFile,
		})
		panel.panel.classList.add("ai-panel--docked")
		containerRef.current.appendChild(panel.panel)
		panel.open()

		if (aiInitialPrompt) panel.submit(aiInitialPrompt)

		return () => panel.panel.remove()
	}, [editorAiContext])

	return (
		<div className="flex w-full md:w-[360px] flex-col h-full border-l border-border">
			<div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
				<div>
					<div className="ds-eyebrow">AI Assistant</div>
					<div className="ds-datum text-muted text-xs">Talking about: Model</div>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="text-muted hover:text-fg"
					aria-label="Close AI assistant"
				>
					<X size={16} />
				</button>
			</div>
			<div ref={containerRef} className="flex flex-1 flex-col min-h-0 overflow-hidden" />
		</div>
	)
}

// ── General text chat ─────────────────────────────────────────────────────────

function TextChat({ contextLabel, onClose }: { contextLabel: string; onClose(): void }) {
	const {
		aiMessages,
		aiBackend,
		aiInitialPrompt,
		editorAiContext,
		pushAiMessage,
		updateAiMessage,
		clearAiMessages,
	} = useUiStore()
	const [input, setInput] = useState("")
	const [loading, setLoading] = useState(false)
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	// Auto-submit initial prompt once if provided and no existing messages
	// biome-ignore lint/correctness/useExhaustiveDependencies: send once on open
	useEffect(() => {
		if (aiInitialPrompt && aiMessages.length === 0) {
			void sendMessage(aiInitialPrompt)
		} else {
			setTimeout(() => textareaRef.current?.focus(), 50)
		}
	}, [])

	const messageCount = aiMessages.length
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message count change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [messageCount])

	async function sendMessage(text?: string) {
		const msgText = (text ?? input).trim()
		if (!msgText || loading) return

		const userMsg: AiMessage = { id: crypto.randomUUID(), role: "user", content: msgText }
		const historyPayload = useUiStore.getState().aiMessages
		pushAiMessage(userMsg)
		if (!text) setInput("")
		setLoading(true)

		const assistantId = crypto.randomUUID()
		pushAiMessage({ id: assistantId, role: "assistant", content: "" })

		const backendParam = aiBackend === "auto" ? null : aiBackend

		try {
			const response = await fetch(`${getProxyUrl()}/operate/chat`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					messages: [...historyPayload, userMsg].map((m) => ({
						role: m.role,
						content: m.content,
					})),
					backend: backendParam,
				}),
			})

			if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let accumulated = ""

			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				const chunk = decoder.decode(value, { stream: true })
				for (const line of chunk.split("\n")) {
					if (!line.startsWith("data: ")) continue
					const data = line.slice(6)
					try {
						const parsed = JSON.parse(data) as
							| { type: "token"; text: string }
							| { type: "done" }
							| { type: "error"; message: string }
						if (parsed.type === "done") break
						if (parsed.type === "error") throw new Error(parsed.message)
						if (parsed.type === "token") {
							accumulated += parsed.text
							updateAiMessage(assistantId, { content: accumulated })
						}
					} catch (parseErr) {
						if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") {
							throw parseErr
						}
					}
				}
			}
		} catch (err) {
			updateAiMessage(assistantId, {
				content: `Error: ${err instanceof Error ? err.message : String(err)}`,
			})
		} finally {
			setLoading(false)
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			void sendMessage()
		}
	}

	return (
		<div className="flex w-full md:w-[280px] flex-col h-full border-l border-border">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
				<div>
					<div className="ds-eyebrow">AI Assistant</div>
					<div className="ds-datum text-muted text-xs">Talking about: {contextLabel}</div>
				</div>
				<div className="flex items-center gap-1.5">
					<BackendSelector />
					<button
						type="button"
						onClick={onClose}
						className="text-muted hover:text-fg"
						aria-label="Close AI assistant"
					>
						<X size={16} />
					</button>
				</div>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-3 space-y-3" aria-live="polite" aria-atomic="false">
				{aiMessages.length === 0 && (
					<p className="ds-lede mt-8 text-center text-xs">
						Ask anything about your processes, instances, or incidents.
					</p>
				)}
				{aiMessages.map((msg) => (
					<div
						key={msg.id}
						className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
					>
						<div
							className={`max-w-[90%] px-3 py-2 text-sm ${
								msg.role === "user"
									? "border-accent border-r-2 bg-accent/10 text-fg"
									: "border-border border-l-2 bg-surface-2 text-fg"
							}`}
						>
							{msg.content && msg.content}
							{!msg.content && loading && msg.role === "assistant" && <ThinkingDots />}
						</div>
						{msg.xml && editorAiContext && (
							<div className="w-full mt-1">
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
				<div ref={messagesEndRef} />
			</div>

			{/* Input */}
			<div className="border-t border-border p-2">
				<textarea
					ref={textareaRef}
					value={input}
					onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
					onKeyDown={handleKeyDown}
					placeholder="Ask AI… (Enter to send)"
					className="ds-field w-full flex-1 resize-none text-sm"
					rows={2}
					disabled={loading}
					aria-label="Message input"
				/>
				<div className="mt-1 flex justify-between items-center">
					<span className="ds-label ds-label--micro">Shift+Enter for newline</span>
					<div className="flex items-center gap-2">
						{loading && <span className="ds-label animate-pulse text-accent">Thinking…</span>}
						{aiMessages.length > 0 && !loading && (
							<button type="button" onClick={clearAiMessages} className="ds-label hover:text-fg">
								Clear
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

// ── AIDrawer ──────────────────────────────────────────────────────────────────

export function AIDrawer() {
	const { aiOpen, aiInitialMessages, aiMessages, editorAiContext, closeAI } = useUiStore()
	const [location] = useLocation()

	// Editor mode: only when editorAiContext is active and there's no existing conversation
	// (palette chat history in aiMessages takes precedence — show TextChat so the history is visible)
	const isEditorMode = !!editorAiContext && !aiInitialMessages && aiMessages.length === 0

	const contextLabel = getContextLabel(location)

	return (
		<div
			className={`flex flex-col overflow-hidden bg-surface ${aiOpen ? "pointer-events-auto" : "pointer-events-none"} ${
				aiOpen
					? // Mobile: full-screen fixed overlay. Desktop: inline sliding panel.
						"fixed inset-0 z-50 md:relative md:inset-auto md:z-auto md:shrink-0"
					: "hidden md:flex md:shrink-0"
			} md:transition-[max-width] md:duration-300 md:ease-out ${
				isEditorMode
					? aiOpen
						? "md:max-w-[360px]"
						: "md:max-w-0"
					: aiOpen
						? "md:max-w-[280px]"
						: "md:max-w-0"
			}`}
			aria-hidden={!aiOpen}
			role="complementary"
		>
			{isEditorMode ? (
				<EditorAiPanel onClose={closeAI} />
			) : (
				<TextChat
					key={aiInitialMessages ? "with-messages" : "persistent"}
					contextLabel={contextLabel}
					onClose={closeAI}
				/>
			)}
		</div>
	)
}
