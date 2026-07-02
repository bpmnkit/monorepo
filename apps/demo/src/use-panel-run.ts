import { useEffect, useRef, useState } from "preact/hooks"
import type { TokenUsage } from "../shared/recording-types.js"
import type { PanelRunResult, PanelSource } from "./sources.js"

export interface PanelRunState {
	text: string
	bpmnXml: string | null
	bpmnError: string | null
	streaming: boolean
	elapsedMs: number
	usage: TokenUsage | null
}

const INITIAL_STATE: PanelRunState = {
	text: "",
	bpmnXml: null,
	bpmnError: null,
	streaming: false,
	elapsedMs: 0,
	usage: null,
}

export function usePanelRun(
	source: PanelSource | null,
	onFinish?: (result: PanelRunResult) => void,
): PanelRunState {
	const [state, setState] = useState<PanelRunState>(INITIAL_STATE)
	const chunksRef = useRef<{ t: number; text: string }[]>([])
	const startedAtRef = useRef(0)
	const elapsedMsRef = useRef(0)

	useEffect(() => {
		setState(INITIAL_STATE)
		chunksRef.current = []
		elapsedMsRef.current = 0

		if (!source) return

		startedAtRef.current = Date.now()
		setState((prev) => ({ ...prev, streaming: true }))

		const unsubscribe = source.subscribe({
			onChunk: (chunk) => {
				chunksRef.current.push({ t: Date.now() - startedAtRef.current, text: chunk })
				setState((prev) => ({ ...prev, text: prev.text + chunk }))
			},
			onTick: (elapsedMs) => {
				elapsedMsRef.current = elapsedMs
				setState((prev) => ({ ...prev, elapsedMs }))
			},
			onDone: () => {
				setState((prev) => ({ ...prev, streaming: false }))
			},
			onBpmn: (xml, runUsage) => {
				const durationMs = elapsedMsRef.current
				setState((prev) => ({ ...prev, bpmnXml: xml, usage: runUsage, streaming: false }))
				onFinish?.({
					chunks: chunksRef.current,
					durationMs,
					usage: runUsage,
					result: { type: "bpmn", xml },
				})
			},
			onError: (message, runUsage) => {
				const durationMs = elapsedMsRef.current
				setState((prev) => ({ ...prev, bpmnError: message, usage: runUsage, streaming: false }))
				onFinish?.({
					chunks: chunksRef.current,
					durationMs,
					usage: runUsage,
					result: { type: "error", message },
				})
			},
		})

		return () => {
			unsubscribe()
		}
	}, [source, onFinish])

	return state
}
