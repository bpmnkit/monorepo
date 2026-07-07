import { parseExpression } from "@bpmnkit/feel"
import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "../bpmn-model.js"
import type { OptimizationFinding } from "./types.js"
import { readZeebeIoMapping } from "./utils.js"

/** Recursively yields every flow element in a process, including inside sub-processes/ad-hoc sub-processes. */
function* walkElements(elements: BpmnFlowElement[]): Generator<BpmnFlowElement> {
	for (const el of elements) {
		yield el
		if (
			el.type === "subProcess" ||
			el.type === "adHocSubProcess" ||
			el.type === "eventSubProcess" ||
			el.type === "transaction"
		) {
			yield* walkElements(el.flowElements)
		}
	}
}

/** Recursively yields every sequence flow, including inside sub-processes/ad-hoc sub-processes. */
function* walkFlows(
	elements: BpmnFlowElement[],
	topLevel: BpmnSequenceFlow[],
): Generator<BpmnSequenceFlow> {
	yield* topLevel
	for (const el of elements) {
		if (
			el.type === "subProcess" ||
			el.type === "adHocSubProcess" ||
			el.type === "eventSubProcess" ||
			el.type === "transaction"
		) {
			yield* walkFlows(el.flowElements, el.sequenceFlows)
		}
	}
}

function checkFeel(
	text: string,
	elementId: string,
	processId: string,
	surface: string,
	findings: OptimizationFinding[],
): void {
	const trimmed = text.trim()
	if (!trimmed.startsWith("=")) return
	const { errors } = parseExpression(trimmed.slice(1))
	for (const err of errors) {
		findings.push({
			id: "feel-syntax/parse-error",
			category: "feel-syntax",
			severity: "error",
			message: `Invalid FEEL expression on ${surface} of "${elementId}": ${err.message}`,
			suggestion: "Fix the FEEL syntax — see the error position for the offending token.",
			processId,
			elementIds: [elementId],
		})
	}
}

/**
 * Parse-validates every FEEL-looking expression (leading "=") in the process:
 * sequence-flow conditions, zeebe:input/output sources, script task
 * expressions, and ad-hoc sub-process completion conditions/outputElement —
 * including inside nested sub-processes. Unlike `feel.ts` (heuristic
 * complexity scoring), this uses the real `@bpmnkit/feel` parser and reports
 * genuine syntax errors, not style suggestions.
 */
export function analyzeFeelSyntax(p: BpmnProcess): OptimizationFinding[] {
	const findings: OptimizationFinding[] = []
	const processId = p.id

	for (const flow of walkFlows(p.flowElements, p.sequenceFlows)) {
		if (flow.conditionExpression?.text) {
			checkFeel(flow.conditionExpression.text, flow.id, processId, "condition", findings)
		}
	}

	for (const el of walkElements(p.flowElements)) {
		const io = readZeebeIoMapping(el.extensionElements)
		if (io) {
			for (const input of io.inputs)
				checkFeel(input.source, el.id, processId, `input "${input.target}"`, findings)
			for (const output of io.outputs)
				checkFeel(output.source, el.id, processId, `output "${output.target}"`, findings)
		}

		const scriptExt = el.extensionElements.find((e) => e.name === "zeebe:script")
		if (scriptExt?.attributes.expression) {
			checkFeel(scriptExt.attributes.expression, el.id, processId, "script expression", findings)
		}

		if (el.type === "adHocSubProcess") {
			if (el.completionCondition?.text) {
				checkFeel(el.completionCondition.text, el.id, processId, "completion condition", findings)
			}
			const adHocExt = el.extensionElements.find((e) => e.name === "zeebe:adHoc")
			if (adHocExt?.attributes.outputElement) {
				checkFeel(adHocExt.attributes.outputElement, el.id, processId, "outputElement", findings)
			}
			if (adHocExt?.attributes.activeElementsCollection) {
				checkFeel(
					adHocExt.attributes.activeElementsCollection,
					el.id,
					processId,
					"activeElementsCollection",
					findings,
				)
			}
		}
	}

	return findings
}
