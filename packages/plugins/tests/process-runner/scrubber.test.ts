import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import { BpmnCanvas } from "@bpmnkit/canvas"
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { createProcessRunnerPlugin } from "../../src/process-runner/index.js"

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="d" targetNamespace="x">
  <bpmn:process id="proc" isExecutable="true"><bpmn:startEvent id="s" /></bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="sh" bpmnElement="s"><dc:Bounds x="10" y="10" width="36" height="36"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

type Listener = (event: Record<string, unknown>) => void

/** An engine whose one instance emits whatever the test hands it. */
function scriptedEngine() {
	let listener: Listener | undefined
	return {
		emit: (event: Record<string, unknown>) => listener?.(event),
		engine: {
			deploy: () => {},
			getDeployedProcesses: () => ["proc"],
			start: () => ({
				onChange: (callback: Listener) => {
					listener = callback
					return () => {}
				},
				cancel: () => {},
			}),
		},
	}
}

/** Records what the runner asks the token highlight to draw. */
function recordingHighlight() {
	const calls: Array<[string, unknown]> = []
	return {
		calls,
		plugin: {
			api: {
				trackInstance: () => () => {},
				clear: () => calls.push(["clear", undefined]),
				setError: (id: string) => calls.push(["error", id]),
				setActive: (ids: string[]) => calls.push(["active", [...ids].sort()]),
				addVisited: (ids: string[]) => calls.push(["visited", [...ids].sort()]),
			},
		},
	}
}

describe("process runner timeline scrubber", () => {
	it("redraws the tokens as they stood at the scrubbed event", () => {
		const { emit, engine } = scriptedEngine()
		const highlight = recordingHighlight()
		const container = document.createElement("div")
		document.body.appendChild(container)
		const play = document.createElement("div")
		const runner = createProcessRunnerPlugin({
			engine,
			playContainer: play,
			tokenHighlight: highlight.plugin,
		} as never)
		const probe: CanvasPlugin = { name: "probe", install: (_: CanvasApi) => {} }
		new BpmnCanvas({ container, xml: XML, fit: "none", plugins: [runner, probe] })

		// The host mounts the toolbar; play mode has to be entered before it has a Run button.
		const { toolbar, playButton } = runner as unknown as {
			toolbar: HTMLElement
			playButton: HTMLElement
		}
		playButton.click()
		const run = [...toolbar.querySelectorAll("button")].find((b) => b.textContent === "▶ Run")
		expect(run).toBeDefined()
		run?.click()

		const entered = (id: string) =>
			emit({ type: "element:entered", elementId: id, elementType: "task" })
		const left = (id: string) => emit({ type: "element:left", elementId: id, elementType: "task" })
		entered("s") // 0
		left("s") // 1
		entered("a") // 2
		entered("b") // 3
		left("a") // 4
		entered("c") // 5

		const scrubber = play.querySelector<HTMLInputElement>(".bpmnkit-runner-scrubber")
		expect(scrubber).not.toBeNull()
		if (!scrubber) return
		scrubber.value = "3"
		scrubber.dispatchEvent(new Event("input"))

		const lastClear = highlight.calls.map(([k]) => k).lastIndexOf("clear")
		expect(highlight.calls.slice(lastClear)).toEqual([
			["clear", undefined],
			["visited", ["s"]],
			["active", ["a", "b"]],
		])

		// Back to live: the tokens as the latest event left them.
		;[...play.querySelectorAll("button")].find((b) => b.textContent === "Live")?.click()
		const liveClear = highlight.calls.map(([k]) => k).lastIndexOf("clear")
		expect(highlight.calls.slice(liveClear)).toEqual([
			["clear", undefined],
			["visited", ["a", "s"]],
			["active", ["b", "c"]],
		])
	})
})
