import { Badge, Button } from "@cascivo/react"
import { useEffect, useRef } from "preact/hooks"
import type { TokenUsage } from "../shared/recording-types.js"
import { BpmnViewer } from "./BpmnViewer.js"
import { formatTokenCount } from "./format-tokens.js"

interface ComparePanelProps {
	variant: "with-sdk" | "with-sdk-compact" | "without-sdk"
	text: string
	bpmnXml: string | null
	bpmnError: string | null
	streaming: boolean
	elapsedMs: number
	usage: TokenUsage | null
	onViewPrompt: () => void
	promptAvailable: boolean
}

const LABELS = {
	"with-sdk": "WITH SDK",
	"with-sdk-compact": "WITH SDK (COMPACT)",
	"without-sdk": "WITHOUT SDK",
} satisfies Record<ComparePanelProps["variant"], string>

const BADGE_VARIANTS = {
	"with-sdk": "success",
	"with-sdk-compact": "warning",
	"without-sdk": "destructive",
} satisfies Record<ComparePanelProps["variant"], "success" | "warning" | "destructive">

export function ComparePanel({
	variant,
	text,
	bpmnXml,
	bpmnError,
	streaming,
	elapsedMs,
	usage,
	onViewPrompt,
	promptAvailable,
}: ComparePanelProps) {
	const codeRef = useRef<HTMLPreElement>(null)

	// biome-ignore lint/correctness/useExhaustiveDependencies: text is a prop; effect should re-run when it changes
	useEffect(() => {
		if (codeRef.current) {
			codeRef.current.scrollTop = codeRef.current.scrollHeight
		}
	}, [text])

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
