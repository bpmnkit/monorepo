import { Modal } from "@cascivo/react"

interface PromptModalProps {
	open: boolean
	onClose: () => void
	title: string
	scenarioPrompt: string
	systemPrompt: string
}

export function PromptModal({
	open,
	onClose,
	title,
	scenarioPrompt,
	systemPrompt,
}: PromptModalProps) {
	return (
		<Modal open={open} onClose={onClose} title={title} size="lg">
			<div class="flex flex-col gap-4 mt-4">
				<div>
					<h3
						class="text-xs font-bold uppercase tracking-wide mb-1"
						style="color: var(--bpmnkit-fg-muted, #8888a8);"
					>
						Scenario Prompt
					</h3>
					<pre
						class="text-xs p-3 rounded overflow-auto max-h-40"
						style="font-family: var(--bpmnkit-font-mono, monospace); background: var(--bpmnkit-surface-2, #1e1e2e); color: var(--bpmnkit-fg, #cdd6f4); white-space: pre-wrap;"
					>
						{scenarioPrompt}
					</pre>
				</div>
				<div>
					<h3
						class="text-xs font-bold uppercase tracking-wide mb-1"
						style="color: var(--bpmnkit-fg-muted, #8888a8);"
					>
						System Prompt
					</h3>
					<pre
						class="text-xs p-3 rounded overflow-auto max-h-80"
						style="font-family: var(--bpmnkit-font-mono, monospace); background: var(--bpmnkit-surface-2, #1e1e2e); color: var(--bpmnkit-fg, #cdd6f4); white-space: pre-wrap;"
					>
						{systemPrompt}
					</pre>
				</div>
			</div>
		</Modal>
	)
}
