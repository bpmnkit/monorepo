import type { XmlElement } from "@bpmnkit/core"

/** Parsed Zeebe extension data for a BPMN element. */
export interface ParsedZeebeExt {
	taskDefinition?: { type: string; retries: number }
	ioMapping?: {
		inputs: Array<{ source: string; target: string }>
		outputs: Array<{ source: string; target: string }>
	}
	taskHeaders?: Record<string, string>
	calledDecision?: { decisionId: string; resultVariable: string }
	formDefinition?: { formId: string }
	scriptTask?: { expression: string; resultVariable: string }
	/** JSON string from `camundaModeler:exampleOutputJson` zeebe:property — used in play mode. */
	exampleOutputJson?: string
}

/** Parse extensionElements XmlElement array into a typed Zeebe extension object. */
export function parseZeebeExt(extensionElements: XmlElement[]): ParsedZeebeExt {
	const result: ParsedZeebeExt = {}

	for (const el of extensionElements) {
		switch (el.name) {
			case "zeebe:taskDefinition": {
				const type = el.attributes.type ?? ""
				const retries = Number(el.attributes.retries ?? "3")
				result.taskDefinition = { type, retries }
				break
			}
			case "zeebe:ioMapping": {
				const inputs: Array<{ source: string; target: string }> = []
				const outputs: Array<{ source: string; target: string }> = []
				for (const child of el.children) {
					if (child.name === "zeebe:input") {
						inputs.push({
							source: child.attributes.source ?? "",
							target: child.attributes.target ?? "",
						})
					} else if (child.name === "zeebe:output") {
						outputs.push({
							source: child.attributes.source ?? "",
							target: child.attributes.target ?? "",
						})
					}
				}
				result.ioMapping = { inputs, outputs }
				break
			}
			case "zeebe:taskHeaders": {
				const headers: Record<string, string> = {}
				for (const child of el.children) {
					if (child.name === "zeebe:header") {
						const key = child.attributes.key
						const value = child.attributes.value
						if (key !== undefined) headers[key] = value ?? ""
					}
				}
				result.taskHeaders = headers
				break
			}
			case "zeebe:calledDecision": {
				const decisionId = el.attributes.decisionId ?? ""
				const resultVariable = el.attributes.resultVariable ?? ""
				result.calledDecision = { decisionId, resultVariable }
				break
			}
			case "zeebe:formDefinition": {
				const formId = el.attributes.formId ?? ""
				result.formDefinition = { formId }
				break
			}
			case "zeebe:script": {
				const expression = el.attributes.expression ?? ""
				const resultVariable = el.attributes.resultVariable ?? ""
				result.scriptTask = { expression, resultVariable }
				break
			}
			case "zeebe:properties": {
				for (const child of el.children) {
					if (
						child.name === "zeebe:property" &&
						child.attributes.name === "camundaModeler:exampleOutputJson"
					) {
						result.exampleOutputJson = child.attributes.value
					}
				}
				break
			}
		}
	}

	return result
}
