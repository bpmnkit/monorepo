import { Button, Input, Modal } from "@cascivo/react"
import { useState } from "preact/hooks"
import type { Recording } from "../shared/recording-types.js"

interface SaveRecordingModalProps {
	open: boolean
	onClose: () => void
	defaultName: string
	recordingData: Omit<Recording, "name" | "recordedAt">
}

type SaveStatus =
	| { kind: "idle" }
	| { kind: "saving" }
	| { kind: "success"; slug: string }
	| { kind: "error"; message: string }

export function SaveRecordingModal({
	open,
	onClose,
	defaultName,
	recordingData,
}: SaveRecordingModalProps) {
	const [name, setName] = useState(defaultName)
	const [status, setStatus] = useState<SaveStatus>({ kind: "idle" })

	async function handleSave() {
		setStatus({ kind: "saving" })
		const recording: Recording = { ...recordingData, name, recordedAt: new Date().toISOString() }
		try {
			const res = await fetch("/recordings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(recording),
			})
			const body = (await res.json()) as { slug?: string; error?: string }
			if (res.ok && body.slug) {
				setStatus({ kind: "success", slug: body.slug })
			} else {
				setStatus({ kind: "error", message: body.error ?? `Request failed with ${res.status}` })
			}
		} catch (err) {
			setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) })
		}
	}

	return (
		<Modal open={open} onClose={onClose} title="Save Recording">
			<div class="flex flex-col gap-4 mt-4">
				<Input
					label="Recording name"
					value={name}
					onInput={(e) => setName((e.target as HTMLInputElement).value)}
					disabled={status.kind === "saving" || status.kind === "success"}
				/>
				{status.kind === "success" && (
					<p style="color: var(--bpmnkit-success, #22c55e);" class="text-sm">
						Saved as apps/demo/recordings/{status.slug}.json
					</p>
				)}
				{status.kind === "error" && (
					<p style="color: var(--bpmnkit-danger, #f87171);" class="text-sm">
						{status.message}
					</p>
				)}
				<div class="flex justify-end gap-2">
					<Button variant="secondary" onClick={onClose}>
						Close
					</Button>
					<Button
						variant="primary"
						loading={status.kind === "saving"}
						disabled={status.kind === "success" || name.trim() === ""}
						onClick={handleSave}
					>
						Save
					</Button>
				</div>
			</div>
		</Modal>
	)
}
