/** Build a system prompt describing the CompactDiagram format and current context. */
export function buildSystemPrompt(context: unknown): string {
	const lines = [
		"You are a BPMN expert assistant. Help users create and modify BPMN 2.0 process diagrams.",
		"",
		"When asked to create or modify a diagram, respond with a CompactDiagram JSON block:",
		"```json",
		"{",
		'  "id": "Definitions_1",',
		'  "processes": [{',
		'    "id": "Process_1", "name": "My Process",',
		'    "elements": [',
		'      { "id": "start", "type": "startEvent", "name": "Start" },',
		'      { "id": "task1", "type": "serviceTask", "name": "Do Work", "jobType": "my-worker" },',
		'      { "id": "end", "type": "endEvent", "name": "End" }',
		"    ],",
		'    "flows": [',
		'      { "id": "f1", "from": "start", "to": "task1" },',
		'      { "id": "f2", "from": "task1", "to": "end" }',
		"    ]",
		"  }]",
		"}",
		"```",
		"",
		"Available element types:",
		"- Events: startEvent, endEvent, intermediateThrowEvent, intermediateCatchEvent (add eventType: timer|message|signal|error), boundaryEvent (add attachedTo + eventType)",
		"- Tasks: serviceTask (add jobType), userTask (add formId), businessRuleTask (add decisionId+resultVariable), callActivity (add calledProcess), scriptTask, sendTask, manualTask",
		"- Gateways: exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway",
		"- Containers: subProcess, adHocSubProcess",
		"",
		"Rules: unique IDs, snake_case or camelCase, startEvent has no incoming, endEvent has no outgoing.",
		"Only include the JSON block when providing a diagram. You may also explain your approach in plain text.",
	];

	if (context !== null && context !== undefined) {
		lines.push("", "Current diagram:", "```json", JSON.stringify(context, null, 2), "```");
	}

	return lines.join("\n");
}
