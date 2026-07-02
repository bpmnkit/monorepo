import { BpmnCanvas } from "@bpmnkit/canvas"
import { useEffect, useRef } from "preact/hooks"

interface BpmnViewerProps {
	xml: string | null
	error: string | null
}

export function BpmnViewer({ xml, error }: BpmnViewerProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<BpmnCanvas | null>(null)

	useEffect(() => {
		if (!xml || !containerRef.current) return

		canvasRef.current?.destroy()

		canvasRef.current = new BpmnCanvas({
			container: containerRef.current,
			xml,
			theme: "dark",
			grid: false,
			fit: "contain",
		})

		return () => {
			canvasRef.current?.destroy()
			canvasRef.current = null
		}
	}, [xml])

	if (error) {
		return (
			<div
				class="h-full w-full rounded overflow-auto p-4"
				style="color: var(--bpmnkit-danger, #f87171); background: var(--bpmnkit-surface-2, #1e1e2e);"
			>
				<pre
					class="text-xs leading-relaxed"
					style="white-space: pre-wrap; word-break: break-word; margin: 0; font-family: var(--bpmnkit-font-mono, monospace);"
				>
					{error}
				</pre>
			</div>
		)
	}

	if (!xml) {
		return (
			<div
				class="h-full w-full rounded animate-pulse"
				style="background: var(--bpmnkit-surface-2, #1e1e2e);"
			/>
		)
	}

	return (
		<div
			ref={containerRef}
			class="h-full w-full rounded overflow-hidden"
			style="background: var(--bpmnkit-surface, #161626);"
		/>
	)
}
