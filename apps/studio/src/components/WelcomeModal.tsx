import { Modal } from "@cascivo/react"
import { FilePlus2, Rocket, Sparkles } from "lucide-react"
import { useEffect } from "preact/hooks"
import { useLocation } from "wouter"
import { getOnboardingState, markExampleOpened, markSeen } from "../lib/onboarding.js"
import { useModelsStore } from "../stores/models.js"
import { useUiStore } from "../stores/ui.js"
import { PROCESS_TEMPLATES } from "../templates/index.js"

export function WelcomeModal() {
	const { showWelcomeModal, openWelcomeModal, closeWelcomeModal } = useUiStore()
	const { saveModel } = useModelsStore()
	const [, navigate] = useLocation()

	// Auto-show on first visit
	useEffect(() => {
		if (!getOnboardingState().seen) {
			openWelcomeModal()
		}
	}, [openWelcomeModal])

	function dismiss() {
		markSeen()
		closeWelcomeModal()
	}

	async function handleOpenExample() {
		const tpl = PROCESS_TEMPLATES.find((t) => t.id === "tpl-fetch-summarize-webpage")
		if (!tpl) {
			console.error("onboarding: template tpl-fetch-summarize-webpage not found")
			dismiss()
			return
		}
		markExampleOpened()
		dismiss()
		try {
			const model = await saveModel({
				id: crypto.randomUUID(),
				name: tpl.name,
				type: "bpmn",
				content: tpl.bpmn,
				createdAt: Date.now(),
			})
			navigate(`/models/${model.id}`)
		} catch (err) {
			console.error("onboarding: failed to save example model", err)
		}
	}

	function handleStartScratch() {
		dismiss()
		navigate("/models")
	}

	function handleConnectCluster() {
		dismiss()
		navigate("/settings")
	}

	return (
		<Modal open={showWelcomeModal} onClose={dismiss} className="max-w-lg">
			<div className="flex flex-col items-center text-center gap-3 pt-4 pb-2">
				<div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent/15 mb-1">
					<Rocket size={28} className="text-accent" />
				</div>
				<h2 className="text-2xl font-semibold text-fg">Welcome to BPMNkit Studio</h2>
				<p className="text-sm text-muted max-w-sm">
					Design, deploy, and monitor BPMN processes for Zeebe workflows.
				</p>
			</div>

			<div className="grid grid-cols-2 gap-4 mt-4">
				<button
					type="button"
					onClick={() => void handleOpenExample()}
					className="flex flex-col items-start gap-2 rounded-lg border border-accent bg-accent/10 p-5 text-left hover:bg-accent/15 transition-colors"
				>
					<Sparkles size={20} className="text-accent" />
					<span className="text-sm font-medium text-fg">Open example process</span>
					<span className="text-xs text-muted leading-relaxed">
						HTTP request + AI summarise — ready to explore
					</span>
				</button>
				<button
					type="button"
					onClick={handleStartScratch}
					className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-5 text-left hover:bg-surface-2 transition-colors"
				>
					<FilePlus2 size={20} className="text-fg" />
					<span className="text-sm font-medium text-fg">Start from scratch</span>
					<span className="text-xs text-muted leading-relaxed">
						Open the editor and design your own process
					</span>
				</button>
			</div>

			<div className="mt-4 flex items-center justify-between">
				<button
					type="button"
					onClick={handleConnectCluster}
					className="text-xs text-accent hover:underline"
				>
					Already have a cluster? Connect it →
				</button>
				<button
					type="button"
					onClick={dismiss}
					className="text-xs text-muted hover:text-fg transition-colors"
				>
					Skip for now
				</button>
			</div>
		</Modal>
	)
}
