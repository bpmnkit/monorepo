// apps/proxy/src/sdk-spec.ts
// Describes functions available in sdk_execute and the CompactDiagram shape.

export const SDK_SPEC = {
	functions: {
		"sdk.parse": {
			description: "Parse BPMN XML into a CompactDiagram JSON string.",
			params: "xml: string",
			returns: "string (CompactDiagram JSON)",
			example: "const compact = sdk.parse(xml)",
		},
		"sdk.exportXml": {
			description: "Convert a CompactDiagram JSON string to BPMN XML with auto-layout applied.",
			params: "compactJson: string",
			returns: "string (BPMN XML)",
			example: "const xml = sdk.exportXml(compact)",
		},
		"sdk.optimize": {
			description:
				"Run the pattern advisor on a CompactDiagram. Returns findings and an optimized diagram.",
			params: "compactJson: string",
			returns: "string (JSON: { diagram: CompactDiagram, findings: Finding[] })",
			example: "const { diagram, findings } = JSON.parse(sdk.optimize(compact))",
		},
		"sdk.layout": {
			description:
				"Apply automatic ELK layout to a CompactDiagram. Returns updated CompactDiagram JSON.",
			params: "compactJson: string",
			returns: "string (CompactDiagram JSON)",
			example: "const laidOut = JSON.parse(sdk.layout(compact))",
		},
		"sdk.analyzeVariables": {
			description:
				"Analyze FEEL variable flow across a process. Identifies undeclared inputs and output variable paths.",
			params: "compactJson: string",
			returns: "string (JSON: VariableFlowAnalysis)",
			example: "const analysis = JSON.parse(sdk.analyzeVariables(compact))",
		},
	},
	compactDiagram: {
		description:
			"Lightweight JSON representation of a BPMN diagram. Input/output format for all sdk functions.",
		shape: {
			processes: [
				{
					id: "string — process id, e.g. 'order-flow'",
					name: "string? — display name",
					elements: [
						{
							id: "string",
							type: "startEvent | endEvent | serviceTask | userTask | businessRuleTask | scriptTask | callActivity | exclusiveGateway | parallelGateway | inclusiveGateway | eventBasedGateway | subProcess | adHocSubProcess | intermediateThrowEvent | intermediateCatchEvent | boundaryEvent",
							name: "string?",
							jobType: "string? — Zeebe job worker type (serviceTask only)",
							decisionId: "string? — DMN decision id (businessRuleTask only)",
							formId: "string? — Camunda form id (userTask only)",
							calledElement: "string? — process id of called process (callActivity only)",
						},
					],
					flows: [
						{
							id: "string",
							sourceRef: "string — source element id",
							targetRef: "string — target element id",
							condition: "string? — FEEL expression (exclusive gateway outgoing flows only)",
						},
					],
				},
			],
		},
	},
} as const
