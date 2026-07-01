import { Badge, Button } from "@cascivo/react"
import { useEffect, useRef, useState } from "preact/hooks"
import type { TokenUsage } from "../shared/recording-types.js"
import { BpmnViewer } from "./BpmnViewer.js"
import { formatTokenCount } from "./format-tokens.js"
import type { PanelRunResult, PanelSource } from "./sources.js"

interface ComparePanelProps {
	variant: "with-sdk" | "without-sdk"
	source: PanelSource | null
	onFinish?: (result: PanelRunResult) => void
	onViewPrompt: () => void
	promptAvailable: boolean
}

const LABELS = {
	"with-sdk": "WITH SDK",
	"without-sdk": "WITHOUT SDK",
} satisfies Record<ComparePanelProps["variant"], string>

const BADGE_VARIANTS = {
	"with-sdk": "success",
	"without-sdk": "destructive",
} satisfies Record<ComparePanelProps["variant"], "success" | "destructive">

export function ComparePanel({
	variant,
	source,
	onFinish,
	onViewPrompt,
	promptAvailable,
}: ComparePanelProps) {
	const [text, setText] = useState("")
	const [bpmnXml, setBpmnXml] = useState<string | null>(null)
	const [bpmnError, setBpmnError] = useState<string | null>(null)
	const [streaming, setStreaming] = useState(false)
	const [elapsedMs, setElapsedMs] = useState(0)
	const [usage, setUsage] = useState<TokenUsage | null>(null)
	const codeRef = useRef<HTMLPreElement>(null)
	const chunksRef = useRef<{ t: number; text: string }[]>([])
	const startedAtRef = useRef(0)

	useEffect(() => {
		setText("")
		setBpmnXml(null)
		setBpmnError(null)
		setElapsedMs(0)
		setUsage(null)
		chunksRef.current = []

		if (!source) {
			setStreaming(false)
			return
		}

		startedAtRef.current = Date.now()
		setStreaming(true)

		const tick = setInterval(() => {
			setElapsedMs(Date.now() - startedAtRef.current)
		}, 100)

		const unsubscribe = source.subscribe({
			onChunk: (chunk) => {
				chunksRef.current.push({ t: Date.now() - startedAtRef.current, text: chunk })
				setText((prev) => prev + chunk)
				if (codeRef.current) {
					codeRef.current.scrollTop = codeRef.current.scrollHeight
				}
			},
			onDone: () => {
				setStreaming(false)
			},
			onBpmn: (xml, runUsage) => {
				const durationMs = Date.now() - startedAtRef.current
				setBpmnXml(xml)
				setUsage(runUsage)
				clearInterval(tick)
				setElapsedMs(durationMs)
				onFinish?.({
					chunks: chunksRef.current,
					durationMs,
					usage: runUsage,
					result: { type: "bpmn", xml },
				})
			},
			onError: (message, runUsage) => {
				const durationMs = Date.now() - startedAtRef.current
				setBpmnError(message)
				setUsage(runUsage)
				setStreaming(false)
				clearInterval(tick)
				setElapsedMs(durationMs)
				onFinish?.({
					chunks: chunksRef.current,
					durationMs,
					usage: runUsage,
					result: { type: "error", message },
				})
			},
		})

		return () => {
			clearInterval(tick)
			unsubscribe()
		}
	}, [source, onFinish])

	return (
		<div class="flex h-full" style="border-top: 1px solid var(--bpmnkit-border, #2a2a42);">
			<div
				class="flex flex-col w-1/2"
				style="border-right: 1px solid var(--bpmnkit-border, #2a2a42);"
			>
				<div
					class="flex items-center justify-between gap-2 px-4 py-2 text-xs"
					style="border-bottom: 1px solid var(--bpmnkit-border, #2a2a42);"
				>
					<span class="flex items-center gap-2">
						<Badge variant={BADGE_VARIANTS[variant]} size="sm">
							{LABELS[variant]}
						</Badge>
						{streaming && (
							<span
								class="inline-block w-2 h-4"
								style="background: currentColor; animation: blink 1s step-end infinite;"
							/>
						)}
					</span>
					<span class="flex items-center gap-3">
						<span style="color: var(--bpmnkit-fg-muted, #8888a8);" class="font-mono">
							{(elapsedMs / 1000).toFixed(1)}s
							{usage &&
								` · ${formatTokenCount(usage.inputTokens)} in / ${formatTokenCount(usage.outputTokens)} out`}
						</span>
						<Button size="sm" variant="ghost" disabled={!promptAvailable} onClick={onViewPrompt}>
							View Prompt
						</Button>
					</span>
				</div>
				<pre
					ref={codeRef}
					class="flex-1 overflow-auto p-4 text-xs leading-relaxed"
					style={`
            font-family: var(--bpmnkit-font-mono, monospace);
            color: var(--bpmnkit-fg, #cdd6f4);
            background: var(--bpmnkit-surface, #161626);
            margin: 0;
            white-space: pre-wrap;
            word-break: break-all;
          `}
				>
					{text}
					{streaming && (
						<span style="display:inline-block;width:8px;height:1em;background:var(--bpmnkit-accent-bright,#89b4fa);vertical-align:text-bottom;animation:blink 1s step-end infinite;" />
					)}
				</pre>
			</div>

			<div class="flex-1 p-4" style="background: var(--bpmnkit-bg, #0d0d16);">
				<BpmnViewer xml={bpmnXml} error={bpmnError} />
			</div>
		</div>
	)
}
