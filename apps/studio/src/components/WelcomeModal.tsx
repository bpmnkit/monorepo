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
			<div className="flex flex-col gap-2 pt-2 pb-4">
				<span className="ds-eyebrow flex items-center gap-2">
					<Rocket size={13} />
					Welcome
				</span>
				<h2 className="ds-title text-2xl">BPMN Kit Studio</h2>
				<p className="ds-lede max-w-sm">
					Design, deploy, and monitor BPMN processes for Zeebe workflows.
				</p>
			</div>

			<div className="ds-grid [--ds-col:200px]">
				<button
					type="button"
					onClick={() => void handleOpenExample()}
					className="ds-cell flex flex-col items-start gap-2 border-accent border-l-2 p-5 text-left transition-colors hover:bg-bg"
				>
					<Sparkles size={18} className="text-accent" />
					<span className="text-fg text-sm">Open example process</span>
					<span className="ds-lede text-xs">HTTP request + AI summarise — ready to explore</span>
				</button>
				<button
					type="button"
					onClick={handleStartScratch}
					className="ds-cell flex flex-col items-start gap-2 p-5 text-left transition-colors hover:bg-bg"
				>
					<FilePlus2 size={18} className="text-fg" />
					<span className="text-fg text-sm">Start from scratch</span>
					<span className="ds-lede text-xs">Open the editor and design your own process</span>
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
					className="ds-label transition-colors hover:text-fg"
				>
					Skip for now
				</button>
			</div>
		</Modal>
	)
}
