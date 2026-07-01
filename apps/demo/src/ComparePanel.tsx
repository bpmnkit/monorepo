import { useEffect, useRef, useState } from "preact/hooks"
import { BpmnViewer } from "./BpmnViewer.js"

interface ComparePanelProps {
	variant: "with-sdk" | "without-sdk"
	runKey: number
}

const LABELS = {
	"with-sdk": "WITH SDK",
	"without-sdk": "WITHOUT SDK",
}

const LABEL_COLORS = {
	"with-sdk": "var(--bpmnkit-success, #22c55e)",
	"without-sdk": "var(--bpmnkit-danger, #f87171)",
}

export function ComparePanel({ variant, runKey }: ComparePanelProps) {
	const [text, setText] = useState("")
	const [bpmnXml, setBpmnXml] = useState<string | null>(null)
	const [bpmnError, setBpmnError] = useState<string | null>(null)
	const [streaming, setStreaming] = useState(false)
	const codeRef = useRef<HTMLPreElement>(null)
	const eventSourceRef = useRef<EventSource | null>(null)

	useEffect(() => {
		// Reset state on new run
		setText("")
		setBpmnXml(null)
		setBpmnError(null)
		setStreaming(false)

		if (runKey === 0) return

		eventSourceRef.current?.close()

		const es = new EventSource(`/stream/${variant}`)
		eventSourceRef.current = es
		setStreaming(true)

		es.addEventListener("chunk", (e) => {
			const { text: chunk } = JSON.parse(e.data) as { text: string }
			setText((prev) => prev + chunk)
			// Auto-scroll
			if (codeRef.current) {
				codeRef.current.scrollTop = codeRef.current.scrollHeight
			}
		})

		es.addEventListener("done", () => {
			setStreaming(false)
		})

		es.addEventListener("bpmn", (e) => {
			const { xml } = JSON.parse(e.data) as { xml: string }
			setBpmnXml(xml)
		})

		es.addEventListener("error", (e) => {
			if (e instanceof MessageEvent) {
				const { message } = JSON.parse(e.data) as { message: string }
				setBpmnError(message)
			}
			setStreaming(false)
			es.close()
		})

		return () => {
			es.close()
		}
	}, [runKey, variant])

	return (
		<div class="flex h-full" style="border-top: 1px solid var(--bpmnkit-border, #2a2a42);">
			{/* Left column — streaming code */}
			<div
				class="flex flex-col w-1/2"
				style="border-right: 1px solid var(--bpmnkit-border, #2a2a42);"
			>
				<div
					class="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold tracking-widest"
					style={`color: ${LABEL_COLORS[variant]}; border-bottom: 1px solid var(--bpmnkit-border, #2a2a42);`}
				>
					{LABELS[variant]}
					{streaming && (
						<span
							class="inline-block w-2 h-4 ml-1"
							style="background: currentColor; animation: blink 1s step-end infinite;"
						/>
					)}
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

			{/* Right column — BPMN render */}
			<div class="flex-1 p-4" style="background: var(--bpmnkit-bg, #0d0d16);">
				<BpmnViewer xml={bpmnXml} error={bpmnError} />
			</div>
		</div>
	)
}
