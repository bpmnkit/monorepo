import { useState } from "preact/hooks"
import { ComparePanel } from "./ComparePanel.js"

export function App() {
	const [runKey, setRunKey] = useState(0)

	return (
		<div class="flex flex-col h-full">
			{/* Header */}
			<header
				class="flex items-center justify-between px-6 py-3 shrink-0"
				style="border-bottom: 1px solid var(--bpmnkit-border, #2a2a42); background: var(--bpmnkit-surface, #161626);"
			>
				<div class="flex items-center gap-3">
					<span class="font-bold text-lg" style="color: var(--bpmnkit-fg, #cdd6f4);">
						bpmnkit
					</span>
					<span class="text-sm" style="color: var(--bpmnkit-fg-muted, #8888a8);">
						/ AI comparison — Loan Approval Process
					</span>
				</div>
				<button
					type="button"
					onClick={() => setRunKey((k) => k + 1)}
					class="px-4 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-80"
					style="background: var(--bpmnkit-accent, #6b9df7); color: #fff;"
				>
					{runKey === 0 ? "Run Demo" : "Run Again"}
				</button>
			</header>

			{/* Grid — two rows, each 50% height */}
			<main class="flex-1 flex flex-col overflow-hidden">
				<div class="flex-1 overflow-hidden">
					<ComparePanel variant="with-sdk" runKey={runKey} />
				</div>
				<div class="flex-1 overflow-hidden">
					<ComparePanel variant="without-sdk" runKey={runKey} />
				</div>
			</main>
		</div>
	)
}
