import type {
	BpmnAdHocSubProcess,
	BpmnBoundaryEvent,
	BpmnBusinessRuleTask,
	BpmnCallActivity,
	BpmnComplexGateway,
	BpmnEndEvent,
	BpmnEventBasedGateway,
	BpmnEventSubProcess,
	BpmnExclusiveGateway,
	BpmnFlowElement,
	BpmnInclusiveGateway,
	BpmnIntermediateCatchEvent,
	BpmnIntermediateThrowEvent,
	BpmnManualTask,
	BpmnParallelGateway,
	BpmnReceiveTask,
	BpmnScriptTask,
	BpmnSendTask,
	BpmnServiceTask,
	BpmnStartEvent,
	BpmnSubProcess,
	BpmnTask,
	BpmnTransaction,
	BpmnUserTask,
} from "./bpmn-model.js"

// ── Events ────────────────────────────────────────────────────────────────────

/**
 * Narrows a flow element to {@link BpmnStartEvent}.
 *
 * @example
 * ```typescript
 * for (const el of process.flowElements) {
 *   if (isBpmnStartEvent(el)) {
 *     console.log("start event definitions:", el.eventDefinitions)
 *   }
 * }
 * ```
 */
export function isBpmnStartEvent(el: BpmnFlowElement): el is BpmnStartEvent {
	return el.type === "startEvent"
}

/**
 * Narrows a flow element to {@link BpmnEndEvent}.
 */
export function isBpmnEndEvent(el: BpmnFlowElement): el is BpmnEndEvent {
	return el.type === "endEvent"
}

/**
 * Narrows a flow element to {@link BpmnIntermediateCatchEvent}.
 */
export function isBpmnIntermediateCatchEvent(
	el: BpmnFlowElement,
): el is BpmnIntermediateCatchEvent {
	return el.type === "intermediateCatchEvent"
}

/**
 * Narrows a flow element to {@link BpmnIntermediateThrowEvent}.
 */
export function isBpmnIntermediateThrowEvent(
	el: BpmnFlowElement,
): el is BpmnIntermediateThrowEvent {
	return el.type === "intermediateThrowEvent"
}

/**
 * Narrows a flow element to {@link BpmnBoundaryEvent}.
 */
export function isBpmnBoundaryEvent(el: BpmnFlowElement): el is BpmnBoundaryEvent {
	return el.type === "boundaryEvent"
}

/**
 * Returns `true` for any event element (start, end, intermediate catch/throw, boundary).
 *
 * @example
 * ```typescript
 * const events = process.flowElements.filter(isBpmnEvent)
 * ```
 */
export function isBpmnEvent(
	el: BpmnFlowElement,
): el is
	| BpmnStartEvent
	| BpmnEndEvent
	| BpmnIntermediateCatchEvent
	| BpmnIntermediateThrowEvent
	| BpmnBoundaryEvent {
	return (
		el.type === "startEvent" ||
		el.type === "endEvent" ||
		el.type === "intermediateCatchEvent" ||
		el.type === "intermediateThrowEvent" ||
		el.type === "boundaryEvent"
	)
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

/**
 * Narrows a flow element to {@link BpmnServiceTask}.
 *
 * @example
 * ```typescript
 * const serviceTasks = process.flowElements.filter(isBpmnServiceTask)
 * // serviceTasks is typed as BpmnServiceTask[]
 * ```
 */
export function isBpmnServiceTask(el: BpmnFlowElement): el is BpmnServiceTask {
	return el.type === "serviceTask"
}

/**
 * Narrows a flow element to {@link BpmnUserTask}.
 */
export function isBpmnUserTask(el: BpmnFlowElement): el is BpmnUserTask {
	return el.type === "userTask"
}

/**
 * Narrows a flow element to {@link BpmnScriptTask}.
 */
export function isBpmnScriptTask(el: BpmnFlowElement): el is BpmnScriptTask {
	return el.type === "scriptTask"
}

/**
 * Narrows a flow element to {@link BpmnBusinessRuleTask}.
 */
export function isBpmnBusinessRuleTask(el: BpmnFlowElement): el is BpmnBusinessRuleTask {
	return el.type === "businessRuleTask"
}

/**
 * Narrows a flow element to {@link BpmnCallActivity}.
 */
export function isBpmnCallActivity(el: BpmnFlowElement): el is BpmnCallActivity {
	return el.type === "callActivity"
}

/**
 * Narrows a flow element to {@link BpmnSendTask}.
 */
export function isBpmnSendTask(el: BpmnFlowElement): el is BpmnSendTask {
	return el.type === "sendTask"
}

/**
 * Narrows a flow element to {@link BpmnReceiveTask}.
 */
export function isBpmnReceiveTask(el: BpmnFlowElement): el is BpmnReceiveTask {
	return el.type === "receiveTask"
}

/**
 * Narrows a flow element to {@link BpmnManualTask}.
 */
export function isBpmnManualTask(el: BpmnFlowElement): el is BpmnManualTask {
	return el.type === "manualTask"
}

/**
 * Narrows a flow element to the plain (untyped) {@link BpmnTask}.
 */
export function isBpmnTask(el: BpmnFlowElement): el is BpmnTask {
	return el.type === "task"
}

/**
 * Returns `true` for any activity element (all task and sub-process types, call activity).
 *
 * @example
 * ```typescript
 * const activities = process.flowElements.filter(isBpmnActivity)
 * ```
 */
export function isBpmnActivity(
	el: BpmnFlowElement,
): el is
	| BpmnTask
	| BpmnServiceTask
	| BpmnUserTask
	| BpmnScriptTask
	| BpmnSendTask
	| BpmnReceiveTask
	| BpmnBusinessRuleTask
	| BpmnManualTask
	| BpmnCallActivity
	| BpmnSubProcess
	| BpmnAdHocSubProcess
	| BpmnEventSubProcess
	| BpmnTransaction {
	return (
		el.type === "task" ||
		el.type === "serviceTask" ||
		el.type === "userTask" ||
		el.type === "scriptTask" ||
		el.type === "sendTask" ||
		el.type === "receiveTask" ||
		el.type === "businessRuleTask" ||
		el.type === "manualTask" ||
		el.type === "callActivity" ||
		el.type === "subProcess" ||
		el.type === "adHocSubProcess" ||
		el.type === "eventSubProcess" ||
		el.type === "transaction"
	)
}

// ── Sub-processes ─────────────────────────────────────────────────────────────

/**
 * Narrows a flow element to {@link BpmnSubProcess}.
 */
export function isBpmnSubProcess(el: BpmnFlowElement): el is BpmnSubProcess {
	return el.type === "subProcess"
}

/**
 * Narrows a flow element to {@link BpmnAdHocSubProcess}.
 */
export function isBpmnAdHocSubProcess(el: BpmnFlowElement): el is BpmnAdHocSubProcess {
	return el.type === "adHocSubProcess"
}

/**
 * Narrows a flow element to {@link BpmnEventSubProcess}.
 */
export function isBpmnEventSubProcess(el: BpmnFlowElement): el is BpmnEventSubProcess {
	return el.type === "eventSubProcess"
}

/**
 * Narrows a flow element to {@link BpmnTransaction}.
 */
export function isBpmnTransaction(el: BpmnFlowElement): el is BpmnTransaction {
	return el.type === "transaction"
}

// ── Gateways ──────────────────────────────────────────────────────────────────

/**
 * Narrows a flow element to {@link BpmnExclusiveGateway}.
 */
export function isBpmnExclusiveGateway(el: BpmnFlowElement): el is BpmnExclusiveGateway {
	return el.type === "exclusiveGateway"
}

/**
 * Narrows a flow element to {@link BpmnParallelGateway}.
 */
export function isBpmnParallelGateway(el: BpmnFlowElement): el is BpmnParallelGateway {
	return el.type === "parallelGateway"
}

/**
 * Narrows a flow element to {@link BpmnInclusiveGateway}.
 */
export function isBpmnInclusiveGateway(el: BpmnFlowElement): el is BpmnInclusiveGateway {
	return el.type === "inclusiveGateway"
}

/**
 * Narrows a flow element to {@link BpmnEventBasedGateway}.
 */
export function isBpmnEventBasedGateway(el: BpmnFlowElement): el is BpmnEventBasedGateway {
	return el.type === "eventBasedGateway"
}

/**
 * Narrows a flow element to {@link BpmnComplexGateway}.
 */
export function isBpmnComplexGateway(el: BpmnFlowElement): el is BpmnComplexGateway {
	return el.type === "complexGateway"
}

/**
 * Returns `true` for any gateway element (exclusive, parallel, inclusive, event-based, complex).
 *
 * @example
 * ```typescript
 * const gateways = process.flowElements.filter(isBpmnGateway)
 * ```
 */
export function isBpmnGateway(
	el: BpmnFlowElement,
): el is
	| BpmnExclusiveGateway
	| BpmnParallelGateway
	| BpmnInclusiveGateway
	| BpmnEventBasedGateway
	| BpmnComplexGateway {
	return (
		el.type === "exclusiveGateway" ||
		el.type === "parallelGateway" ||
		el.type === "inclusiveGateway" ||
		el.type === "eventBasedGateway" ||
		el.type === "complexGateway"
	)
}
