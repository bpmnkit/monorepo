import { generateId } from "../../types/id-generator.js";
import type {
	BpmnDefinitions,
	BpmnEndEvent,
	BpmnProcess,
	BpmnSequenceFlow,
} from "../bpmn-model.js";
import type { OptimizationFinding, ResolvedOptions } from "./types.js";
import {
	buildFlowIndex,
	findDiPlane,
	findProcess,
	insertElement,
	insertFlow,
	isEndEvent,
	isGateway,
	isStartEvent,
	reachableFrom,
	removeElement,
	removeFlow,
} from "./utils.js";

export function analyzeFlow(p: BpmnProcess, _opts: ResolvedOptions): OptimizationFinding[] {
	const findings: OptimizationFinding[] = [];
	const processId = p.id;
	const { bySource, byTarget } = buildFlowIndex(p);

	// Start IDs for BFS reachability
	const startIds = p.flowElements.filter((e) => isStartEvent(e.type)).map((e) => e.id);

	// flow/no-end-event
	const endEvents = p.flowElements.filter((e) => isEndEvent(e.type));
	if (endEvents.length === 0) {
		findings.push({
			id: "flow/no-end-event",
			category: "flow",
			severity: "warning",
			message: `Process "${processId}" has no end event.`,
			suggestion: "Add an end event to properly terminate the process.",
			processId,
			elementIds: [],
		});
	}

	// BFS reachability from start events
	const reachable = reachableFrom(startIds, bySource);

	for (const el of p.flowElements) {
		// flow/unreachable
		if (!reachable.has(el.id)) {
			findings.push({
				id: "flow/unreachable",
				category: "flow",
				severity: "error",
				message: `Element "${el.id}" (${el.type}) is not reachable from any start event.`,
				suggestion: "Connect this element to the process flow or remove it.",
				processId,
				elementIds: [el.id],
			});
		}

		// flow/dead-end: non-end-event with 0 outgoing flows
		const outflows = bySource.get(el.id) ?? [];
		if (!isEndEvent(el.type) && outflows.length === 0) {
			const deadEndId = el.id;
			findings.push({
				id: "flow/dead-end",
				category: "flow",
				severity: "warning",
				message: `Element "${el.id}" (${el.type}) has no outgoing sequence flows.`,
				suggestion: "Connect this element to a downstream element or an end event.",
				processId,
				elementIds: [el.id],
				applyFix: (defs: BpmnDefinitions) => {
					const proc = findProcess(defs, processId);
					if (!proc) return { description: "Process not found" };

					const endEventId = generateId("EndEvent");
					const flowId = generateId("Flow");

					const endEvent: BpmnEndEvent = {
						type: "endEvent",
						id: endEventId,
						incoming: [flowId],
						outgoing: [],
						extensionElements: [],
						unknownAttributes: {},
						eventDefinitions: [],
					};

					const newFlow: BpmnSequenceFlow = {
						id: flowId,
						sourceRef: deadEndId,
						targetRef: endEventId,
						extensionElements: [],
						unknownAttributes: {},
					};

					// Update outgoing on dead-end element
					const deadEl = proc.flowElements.find((e) => e.id === deadEndId);
					if (deadEl) {
						deadEl.outgoing.push(flowId);
					}

					insertElement(proc, endEvent);
					insertFlow(proc, newFlow);

					// Update diagram if plane exists
					const plane = findDiPlane(defs, processId);
					if (plane) {
						const srcShape = plane.shapes.find((s) => s.bpmnElement === deadEndId);
						const srcRight = srcShape ? srcShape.bounds.x + srcShape.bounds.width : 300;
						const srcMidY = srcShape ? srcShape.bounds.y + srcShape.bounds.height / 2 : 220;
						const endX = srcShape ? srcShape.bounds.x + srcShape.bounds.width + 150 : 450;
						const endY = srcMidY - 18;

						plane.shapes.push({
							id: `${endEventId}_di`,
							bpmnElement: endEventId,
							bounds: { x: endX, y: endY, width: 36, height: 36 },
							unknownAttributes: {},
						});
						plane.edges.push({
							id: `${flowId}_di`,
							bpmnElement: flowId,
							waypoints: [
								{ x: srcRight, y: srcMidY },
								{ x: endX, y: srcMidY },
							],
							unknownAttributes: {},
						});
					}

					return { description: `Added end event "${endEventId}" connected from "${deadEndId}"` };
				},
			});
		}

		// flow/redundant-gateway: gateway with exactly 1 incoming AND 1 outgoing
		if (isGateway(el.type)) {
			const inflows = byTarget.get(el.id) ?? [];
			if (inflows.length === 1 && outflows.length === 1) {
				const gwId = el.id;
				const inFlowId = inflows[0]?.id ?? "";
				const outFlowId = outflows[0]?.id ?? "";

				findings.push({
					id: "flow/redundant-gateway",
					category: "flow",
					severity: "info",
					message: `Gateway "${el.id}" (${el.type}) has only 1 incoming and 1 outgoing flow — it is redundant.`,
					suggestion: "Remove this gateway and connect its source directly to its target.",
					processId,
					elementIds: [el.id],
					applyFix: (defs: BpmnDefinitions) => {
						const proc = findProcess(defs, processId);
						if (!proc) return { description: "Process not found" };

						// Find the two flows
						const inFlow = proc.sequenceFlows.find((f) => f.id === inFlowId);
						const outFlow = proc.sequenceFlows.find((f) => f.id === outFlowId);
						if (!inFlow || !outFlow) return { description: "Flows not found" };

						const srcId = inFlow.sourceRef;
						const tgtId = outFlow.targetRef;
						const newFlowId = generateId("Flow");

						// Remove gateway and its two flows
						removeElement(proc, gwId);
						removeFlow(proc, inFlowId);
						removeFlow(proc, outFlowId);

						// Update outgoing/incoming on connected elements
						const srcEl = proc.flowElements.find((e) => e.id === srcId);
						if (srcEl) {
							srcEl.outgoing = srcEl.outgoing.filter((id) => id !== inFlowId);
							srcEl.outgoing.push(newFlowId);
						}
						const tgtEl = proc.flowElements.find((e) => e.id === tgtId);
						if (tgtEl) {
							tgtEl.incoming = tgtEl.incoming.filter((id) => id !== outFlowId);
							tgtEl.incoming.push(newFlowId);
						}

						const newFlow: BpmnSequenceFlow = {
							id: newFlowId,
							sourceRef: srcId,
							targetRef: tgtId,
							extensionElements: [],
							unknownAttributes: {},
						};
						insertFlow(proc, newFlow);

						// Update diagram
						const plane = findDiPlane(defs, processId);
						if (plane) {
							plane.shapes = plane.shapes.filter((s) => s.bpmnElement !== gwId);
							plane.edges = plane.edges.filter(
								(e) => e.bpmnElement !== inFlowId && e.bpmnElement !== outFlowId,
							);

							const srcShape = plane.shapes.find((s) => s.bpmnElement === srcId);
							const tgtShape = plane.shapes.find((s) => s.bpmnElement === tgtId);
							if (srcShape && tgtShape) {
								plane.edges.push({
									id: `${newFlowId}_di`,
									bpmnElement: newFlowId,
									waypoints: [
										{
											x: srcShape.bounds.x + srcShape.bounds.width,
											y: srcShape.bounds.y + srcShape.bounds.height / 2,
										},
										{
											x: tgtShape.bounds.x,
											y: tgtShape.bounds.y + tgtShape.bounds.height / 2,
										},
									],
									unknownAttributes: {},
								});
							}
						}

						return {
							description: `Removed redundant gateway "${gwId}" and connected "${srcId}" → "${tgtId}"`,
						};
					},
				});
			}
		}

		// flow/empty-subprocess
		if (el.type === "subProcess" || el.type === "adHocSubProcess" || el.type === "transaction") {
			if (el.flowElements.length === 0) {
				findings.push({
					id: "flow/empty-subprocess",
					category: "flow",
					severity: "warning",
					message: `Sub-process "${el.id}" (${el.type}) contains no flow elements.`,
					suggestion: "Add flow elements inside the sub-process or remove it.",
					processId,
					elementIds: [el.id],
				});
			}
		}
	}

	return findings;
}
