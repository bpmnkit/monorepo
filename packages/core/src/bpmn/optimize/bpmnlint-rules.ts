/**
 * Native equivalents of bpmnlint rules BPMN Kit had no finding for, or whose
 * finding checks only the top-level process or a different set of elements.
 *
 * These are opt-in: nothing here runs unless a `.bpmnlintrc` enables the
 * bpmnlint rule it stands in for (see `../bpmnlint.ts`). The default
 * `casen lint` report is unchanged by their existence — several of them
 * (`no-inclusive-gateway`, `standard-size`, …) are house style rather than
 * correctness, and a team that never asked for them should not see them.
 *
 * Every rule walks every scope — processes and the sub-processes nested in
 * them — because bpmnlint does. Connectivity is read from the sequence flows
 * of each scope rather than from the `<incoming>`/`<outgoing>` children, which
 * hand-written and generated XML routinely omits.
 */

import type {
	BpmnAdHocSubProcess,
	BpmnBounds,
	BpmnDefinitions,
	BpmnDiShape,
	BpmnEventDefinition,
	BpmnEventSubProcess,
	BpmnFlowElement,
	BpmnLane,
	BpmnProcess,
	BpmnSequenceFlow,
	BpmnSubProcess,
	BpmnTransaction,
} from "../bpmn-model.js"
import type { OptimizationCategory, OptimizationFinding } from "./types.js"

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

type SubContainer = BpmnSubProcess | BpmnAdHocSubProcess | BpmnEventSubProcess | BpmnTransaction
type Container = BpmnProcess | SubContainer

interface Scope {
	container: Container
	/** `process` for a top-level process, otherwise the sub-process's element type. */
	kind: "process" | SubContainer["type"]
	/** The top-level process the scope belongs to — what a finding reports as `processId`. */
	processId: string
	executable: boolean
	eventSubProcess: boolean
	/** Outgoing sequence flows per source id, within this scope. */
	bySource: Map<string, BpmnSequenceFlow[]>
	/** Incoming sequence flows per target id, within this scope. */
	byTarget: Map<string, BpmnSequenceFlow[]>
}

function isSubContainer(el: BpmnFlowElement): el is SubContainer {
	return (
		el.type === "subProcess" ||
		el.type === "adHocSubProcess" ||
		el.type === "eventSubProcess" ||
		el.type === "transaction"
	)
}

function isEventSubProcess(el: BpmnFlowElement): boolean {
	return el.type === "eventSubProcess" || (el.type === "subProcess" && el.triggeredByEvent === true)
}

function indexFlows(flows: BpmnSequenceFlow[]): Pick<Scope, "bySource" | "byTarget"> {
	const bySource = new Map<string, BpmnSequenceFlow[]>()
	const byTarget = new Map<string, BpmnSequenceFlow[]>()
	for (const flow of flows) {
		bySource.set(flow.sourceRef, [...(bySource.get(flow.sourceRef) ?? []), flow])
		byTarget.set(flow.targetRef, [...(byTarget.get(flow.targetRef) ?? []), flow])
	}
	return { bySource, byTarget }
}

/** Every process and every sub-process nested in it, outermost first. */
function allScopes(defs: BpmnDefinitions): Scope[] {
	const scopes: Scope[] = []
	const visit = (
		container: Container,
		kind: Scope["kind"],
		eventSubProcess: boolean,
		processId: string,
		executable: boolean,
	) => {
		scopes.push({
			container,
			kind,
			processId,
			executable,
			eventSubProcess,
			...indexFlows(container.sequenceFlows),
		})
		for (const el of container.flowElements) {
			if (isSubContainer(el)) visit(el, el.type, isEventSubProcess(el), processId, executable)
		}
	}
	for (const process of defs.processes) {
		visit(process, "process", false, process.id, process.isExecutable === true)
	}
	return scopes
}

// ---------------------------------------------------------------------------
// Element classification (bpmn-moddle's type hierarchy, flattened)
// ---------------------------------------------------------------------------

const EVENT_TYPES = new Set<BpmnFlowElement["type"]>([
	"startEvent",
	"endEvent",
	"intermediateThrowEvent",
	"intermediateCatchEvent",
	"boundaryEvent",
])

/** `bpmn:Task` and its subtypes — call activities and sub-processes are not tasks. */
const TASK_TYPES = new Set<BpmnFlowElement["type"]>([
	"task",
	"serviceTask",
	"scriptTask",
	"userTask",
	"sendTask",
	"receiveTask",
	"businessRuleTask",
	"manualTask",
])

const GATEWAY_TYPES = new Set<BpmnFlowElement["type"]>([
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
])

function isEvent(el: BpmnFlowElement): boolean {
	return EVENT_TYPES.has(el.type)
}

function isActivity(el: BpmnFlowElement): boolean {
	return TASK_TYPES.has(el.type) || el.type === "callActivity" || isSubContainer(el)
}

function isGateway(el: BpmnFlowElement): boolean {
	return GATEWAY_TYPES.has(el.type)
}

/** `bpmn:FlowNode` — everything except data objects and their references. */
function isFlowNode(el: BpmnFlowElement): boolean {
	return isEvent(el) || isActivity(el) || isGateway(el)
}

function eventDefinitionsOf(el: BpmnFlowElement): BpmnEventDefinition[] {
	return "eventDefinitions" in el ? el.eventDefinitions : []
}

/**
 * The default flow id. Gateways model it; an activity keeps its `default` in
 * `unknownAttributes`, which the parser preserves.
 */
function defaultFlowOf(el: BpmnFlowElement | undefined): string | undefined {
	if (el === undefined) return undefined
	if ("default" in el && el.default !== undefined) return el.default
	return el.unknownAttributes.default
}

function hasCondition(flow: BpmnSequenceFlow): boolean {
	return flow.conditionExpression !== undefined
}

/**
 * The default flow as bpmn-moddle reads it: only activities and exclusive,
 * inclusive and complex gateways have a `default` property. On any other
 * element the attribute is foreign, and bpmnlint does not see it.
 */
function modelledDefaultOf(el: BpmnFlowElement): string | undefined {
	const hasDefault =
		isActivity(el) ||
		el.type === "exclusiveGateway" ||
		el.type === "inclusiveGateway" ||
		el.type === "complexGateway"
	return hasDefault ? defaultFlowOf(el) : undefined
}

/** Has event definitions, all of one type — bpmnlint's `isLinkEvent` and `isCompensationEvent`. */
function onlyDefinitions(el: BpmnFlowElement, type: BpmnEventDefinition["type"]): boolean {
	const defs = eventDefinitionsOf(el)
	return defs.length > 0 && defs.every((d) => d.type === type)
}

function isBlank(name: string | undefined): boolean {
	return (name ?? "").trim() === ""
}

// ---------------------------------------------------------------------------
// Rule plumbing
// ---------------------------------------------------------------------------

interface RuleContext {
	defs: BpmnDefinitions
	scopes: Scope[]
	/** The rule's options from `.bpmnlintrc` (`[severity, options]`), if any. */
	options: unknown
}

interface NativeRule {
	category: OptimizationCategory
	check: (ctx: RuleContext, report: Reporter) => void
}

type Reporter = (
	id: string,
	message: string,
	suggestion: string,
	processId: string,
	elementIds: string[],
) => void

// ---------------------------------------------------------------------------
// Rules — keyed by the bpmnlint rule they implement
// ---------------------------------------------------------------------------

const SUB_SCOPE_KINDS = new Set<Scope["kind"]>(["subProcess", "eventSubProcess", "transaction"])

const RULES: Record<string, NativeRule> = {
	"ad-hoc-sub-process": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				if (scope.kind !== "adHocSubProcess") continue
				for (const el of scope.container.flowElements) {
					if (el.type !== "startEvent" && el.type !== "endEvent") continue
					report(
						"flow/ad-hoc-start-end-event",
						`${el.type === "startEvent" ? "Start" : "End"} event "${el.id}" is not allowed in ad-hoc sub-process "${scope.container.id}".`,
						"Remove it — an ad-hoc sub-process has no start or end events; its activities run on demand.",
						scope.processId,
						[el.id],
					)
				}
			}
		},
	},

	"conditional-event": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				if (!scope.executable) continue
				for (const el of scope.container.flowElements) {
					const def = eventDefinitionsOf(el).find((d) => d.type === "conditional")
					if (def?.type !== "conditional" || (def.condition ?? "").trim() !== "") continue
					report(
						"flow/conditional-event-no-condition",
						`Conditional event "${el.id}" has no condition.`,
						"Add the condition that should trigger the event.",
						scope.processId,
						[el.id],
					)
				}
			}
		},
	},

	// Stands in for `feel/empty-condition` while configured (see `replaces` in
	// `../bpmnlint.ts`), so it shares that finding's category.
	"conditional-flows": {
		category: "feel",
		check({ scopes }, report) {
			for (const scope of scopes) {
				for (const el of scope.container.flowElements) {
					const outgoing = scope.bySource.get(el.id) ?? []
					const defaultFlow = modelledDefaultOf(el)
					if (defaultFlow === undefined && !outgoing.some(hasCondition)) continue
					for (const flow of outgoing) {
						if (hasCondition(flow) || flow.id === defaultFlow) continue
						report(
							"feel/missing-condition",
							`Sequence flow "${flow.id}" leaves "${el.id}", which routes by condition, but has no condition and is not the default flow.`,
							"Add a condition expression, or make this flow the default.",
							scope.processId,
							[flow.id],
						)
					}
				}
			}
		},
	},

	"end-event-required": {
		category: "flow",
		check({ scopes }, report) {
			// Top-level processes are covered by `flow/no-end-event`.
			for (const scope of scopes) {
				if (!SUB_SCOPE_KINDS.has(scope.kind)) continue
				if (scope.container.flowElements.some((el) => el.type === "endEvent")) continue
				report(
					"flow/sub-process-no-end-event",
					`Sub-process "${scope.container.id}" has no end event.`,
					"Add an end event so the sub-process completes explicitly.",
					scope.processId,
					[scope.container.id],
				)
			}
		},
	},

	"event-based-gateway": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				for (const el of scope.container.flowElements) {
					if (el.type !== "eventBasedGateway") continue
					const outgoing = scope.bySource.get(el.id) ?? []
					if (outgoing.length < 2) {
						report(
							"flow/event-gateway-invalid",
							`Event-based gateway "${el.id}" has ${outgoing.length} outgoing flow${outgoing.length === 1 ? "" : "s"}; it needs at least 2.`,
							"Connect the gateway to two or more catch events — it waits for the first of them.",
							scope.processId,
							[el.id],
						)
					}
					for (const flow of outgoing.filter(hasCondition)) {
						report(
							"flow/event-gateway-invalid",
							`Sequence flow "${flow.id}" leaves event-based gateway "${el.id}" with a condition.`,
							"Remove the condition — the event that arrives first decides the path.",
							scope.processId,
							[flow.id],
						)
					}
				}
			}
		},
	},

	"event-sub-process-typed-start-event": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				if (!scope.eventSubProcess) continue
				for (const el of scope.container.flowElements) {
					if (el.type !== "startEvent" || el.eventDefinitions.length > 0) continue
					report(
						"flow/event-sub-process-untyped-start",
						`Start event "${el.id}" of event sub-process "${scope.container.id}" has no event definition.`,
						"Give the start event a trigger (message, timer, error, signal, …).",
						scope.processId,
						[el.id],
					)
				}
			}
		},
	},

	"fake-join": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				for (const el of scope.container.flowElements) {
					if (!isActivity(el) && !isEvent(el)) continue
					// `flow/multi-incoming-task` already covers the top level, except start events.
					if (scope.kind === "process" && el.type !== "startEvent") continue
					const incoming = (scope.byTarget.get(el.id) ?? []).length
					if (incoming <= 1) continue
					report(
						"flow/multi-incoming-task",
						`Element "${el.id}" (${el.type}) has ${incoming} incoming flows, which do not join.`,
						"Join the flows with a gateway before this element.",
						scope.processId,
						[el.id],
					)
				}
			}
		},
	},

	global: {
		category: "pattern",
		check({ defs, scopes }, report) {
			const referenced = new Set<string>()
			for (const scope of scopes) {
				for (const el of scope.container.flowElements) {
					for (const def of eventDefinitionsOf(el)) {
						if (def.type === "error" && def.errorRef) referenced.add(`error:${def.errorRef}`)
						if (def.type === "escalation" && def.escalationRef)
							referenced.add(`escalation:${def.escalationRef}`)
						if (def.type === "message" && def.messageRef)
							referenced.add(`message:${def.messageRef}`)
						if (def.type === "signal" && def.signalRef) referenced.add(`signal:${def.signalRef}`)
					}
					if ((el.type === "sendTask" || el.type === "receiveTask") && el.messageRef) {
						referenced.add(`message:${el.messageRef}`)
					}
				}
			}
			for (const collaboration of defs.collaborations) {
				for (const flow of collaboration.messageFlows) {
					if (flow.messageRef) referenced.add(`message:${flow.messageRef}`)
				}
			}

			const groups: [string, { id: string; name?: string }[]][] = [
				["error", defs.errors],
				["escalation", defs.escalations],
				["message", defs.messages],
				["signal", defs.signals],
			]
			for (const [kind, elements] of groups) {
				for (const element of elements) {
					// bpmnlint's `hasName` is `name?.trim() !== ""`: a missing name attribute
					// passes, and only an empty or blank one is reported.
					if (element.name !== undefined && element.name.trim() === "") {
						report(
							"pattern/global-element",
							`Global ${kind} "${element.id}" has no name.`,
							`Name the ${kind} so the events referring to it say what they mean.`,
							defs.id,
							[element.id],
						)
					}
					if (!referenced.has(`${kind}:${element.id}`)) {
						report(
							"pattern/global-element",
							`Global ${kind} "${element.id}" is not referenced by any element.`,
							`Remove the unused ${kind}, or reference it from the event that should use it.`,
							defs.id,
							[element.id],
						)
					}
					if (elements.filter((other) => other.name === element.name).length > 1) {
						report(
							"pattern/global-element",
							`Global ${kind} "${element.id}" shares its name with another ${kind}.`,
							`Give each ${kind} a unique name, or reuse one ${kind} instead of declaring it twice.`,
							defs.id,
							[element.id],
						)
					}
				}
			}
		},
	},

	"label-required": {
		category: "naming",
		check({ defs, scopes }, report) {
			const missing = (id: string, what: string, processId: string) =>
				report(
					"naming/missing-label",
					`${what} "${id}" has no label.`,
					"Name it, so the diagram says what it does or means.",
					processId,
					[id],
				)
			for (const collaboration of defs.collaborations) {
				for (const participant of collaboration.participants) {
					if (isBlank(participant.name)) missing(participant.id, "Participant", defs.id)
				}
			}
			const lanes = (list: BpmnLane[], processId: string) => {
				for (const lane of list) {
					if (isBlank(lane.name)) missing(lane.id, "Lane", processId)
					if (lane.childLaneSet) lanes(lane.childLaneSet.lanes, processId)
				}
			}
			for (const process of defs.processes) lanes(process.laneSet?.lanes ?? [], process.id)
			for (const scope of scopes) {
				for (const el of scope.container.flowElements) {
					// Sub-processes, parallel and event-based gateways and joins need no label.
					if (!isFlowNode(el) || isSubContainer(el)) continue
					if (el.type === "parallelGateway" || el.type === "eventBasedGateway") continue
					if (isGateway(el) && (scope.bySource.get(el.id) ?? []).length <= 1) continue
					if (isBlank(el.name)) missing(el.id, `${el.type} element`, scope.processId)
				}
				for (const flow of scope.container.sequenceFlows) {
					if (hasCondition(flow) && isBlank(flow.name)) {
						missing(flow.id, "Conditional sequence flow", scope.processId)
					}
				}
			}
		},
	},

	"link-event": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				const links = scope.container.flowElements.flatMap((el) => {
					if (!isEvent(el)) return []
					const def = eventDefinitionsOf(el).find((d) => d.type === "link")
					return def?.type === "link" ? [{ el, name: def.name ?? "" }] : []
				})
				const byName = new Map<string, BpmnFlowElement[]>()
				for (const { el, name } of links) {
					if (name === "") {
						report(
							"flow/link-event-mismatch",
							`Link event "${el.id}" has no link name.`,
							"Name the link — a throw and its catch are paired by name.",
							scope.processId,
							[el.id],
						)
						continue
					}
					byName.set(name, [...(byName.get(name) ?? []), el])
				}
				for (const [name, events] of byName) {
					const isCatch = (el: BpmnFlowElement) =>
						el.type === "intermediateCatchEvent" ||
						el.type === "startEvent" ||
						el.type === "boundaryEvent"
					const catches = events.filter(isCatch)
					if (events.length === 1) {
						const [only] = events as [BpmnFlowElement]
						report(
							"flow/link-event-mismatch",
							`Link ${isCatch(only) ? "throw" : "catch"} event with link name "${name}" is missing in this scope.`,
							"Add the matching link event in the same process or sub-process.",
							scope.processId,
							[only.id],
						)
					} else if (catches.length > 1) {
						for (const el of catches) {
							report(
								"flow/link-event-mismatch",
								`Duplicate link catch event with link name "${name}" in this scope.`,
								"Keep one catch event per link name.",
								scope.processId,
								[el.id],
							)
						}
					} else if (catches.length === 0) {
						for (const el of events) {
							report(
								"flow/link-event-mismatch",
								`Link catch event with link name "${name}" is missing in this scope.`,
								"Add a link catch event with the same name.",
								scope.processId,
								[el.id],
							)
						}
					}
				}
			}
		},
	},

	"no-bpmndi": {
		category: "pattern",
		check({ defs }, report) {
			const drawn = new Set<string>()
			for (const diagram of defs.diagrams) {
				for (const shape of diagram.plane.shapes) drawn.add(shape.bpmnElement)
				for (const edge of diagram.plane.edges) drawn.add(edge.bpmnElement)
			}
			const missing = (id: string, processId: string) => {
				if (drawn.has(id)) return
				report(
					"pattern/missing-di",
					`Element "${id}" has no diagram information (BPMNDI).`,
					"Open and save the file in a modeler, or run `casen bpmn layout`, to draw it.",
					processId,
					[id],
				)
			}
			const lanes = (list: BpmnLane[], processId: string) => {
				for (const lane of list) {
					missing(lane.id, processId)
					if (lane.childLaneSet) lanes(lane.childLaneSet.lanes, processId)
				}
			}
			const container = (c: Container, processId: string) => {
				for (const el of c.flowElements) {
					if (el.type !== "dataObject") missing(el.id, processId)
					if (isSubContainer(el)) container(el, processId)
				}
				for (const flow of c.sequenceFlows) missing(flow.id, processId)
				for (const artifact of [...c.textAnnotations, ...c.associations, ...c.groups]) {
					missing(artifact.id, processId)
				}
			}
			for (const collaboration of defs.collaborations) {
				for (const participant of collaboration.participants) missing(participant.id, defs.id)
				for (const flow of collaboration.messageFlows) missing(flow.id, defs.id)
				for (const artifact of [
					...collaboration.textAnnotations,
					...collaboration.associations,
					...collaboration.groups,
				]) {
					missing(artifact.id, defs.id)
				}
			}
			for (const process of defs.processes) {
				container(process, process.id)
				if (process.laneSet) lanes(process.laneSet.lanes, process.id)
			}
		},
	},

	"no-complex-gateway": {
		category: "pattern",
		check({ scopes }, report) {
			discouraged(scopes, report, "complexGateway", "pattern/complex-gateway", "complex gateway")
		},
	},

	"no-disconnected": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				if (scope.kind === "adHocSubProcess") continue
				for (const el of scope.container.flowElements) {
					const checked =
						TASK_TYPES.has(el.type) || isGateway(el) || isSubContainer(el) || isEvent(el)
					if (!checked || isEventSubProcess(el) || el.isForCompensation === true) continue
					const defs = eventDefinitionsOf(el)
					if (el.type === "boundaryEvent" && defs.length === 1 && defs[0]?.type === "compensate")
						continue
					if ((scope.byTarget.get(el.id) ?? []).length > 0) continue
					if ((scope.bySource.get(el.id) ?? []).length > 0) continue
					report(
						"flow/disconnected",
						`Element "${el.id}" (${el.type}) is not connected to any sequence flow.`,
						"Connect it to the process flow or remove it.",
						scope.processId,
						[el.id],
					)
				}
			}
		},
	},

	"no-duplicate-sequence-flows": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				const seen = new Set<string>()
				for (const flow of scope.container.sequenceFlows) {
					const key = `${flow.sourceRef}#${flow.targetRef}#${flow.conditionExpression?.text ?? ""}`
					if (!seen.has(key)) {
						seen.add(key)
						continue
					}
					report(
						"flow/duplicate-sequence-flow",
						`Sequence flow "${flow.id}" duplicates another flow from "${flow.sourceRef}" to "${flow.targetRef}".`,
						"Remove the duplicate — two identical flows spawn two tokens.",
						scope.processId,
						[flow.id, flow.sourceRef, flow.targetRef],
					)
				}
			}
		},
	},

	"no-gateway-join-fork": {
		category: "flow",
		check({ scopes }, report) {
			// `flow/mixed-gateway` from `optimize()` covers the top level.
			for (const scope of scopes) {
				if (scope.kind === "process") continue
				for (const el of scope.container.flowElements) {
					if (!isGateway(el)) continue
					const incoming = (scope.byTarget.get(el.id) ?? []).length
					const outgoing = (scope.bySource.get(el.id) ?? []).length
					if (incoming <= 1 || outgoing <= 1) continue
					report(
						"flow/mixed-gateway",
						`Gateway "${el.id}" (${el.type}) has ${incoming} incoming and ${outgoing} outgoing flows — it both joins and forks.`,
						"Split it into a joining gateway followed by a forking one.",
						scope.processId,
						[el.id],
					)
				}
			}
		},
	},

	"no-implicit-end": {
		category: "flow",
		check({ defs, scopes }, report) {
			const processes = new Map(defs.processes.map((p) => [p.id, p]))
			for (const scope of scopes) {
				// Activities of an ad-hoc sub-process start and end on demand.
				if (scope.kind === "adHocSubProcess") continue
				// bpmnlint looks for a compensation handler's association in the
				// enclosing process only, not in the sub-process that holds the event.
				const associations = processes.get(scope.processId)?.associations ?? []
				for (const el of scope.container.flowElements) {
					if (!isFlowNode(el) || el.type === "endEvent" || isEventSubProcess(el)) continue
					if (el.type === "intermediateThrowEvent" && onlyDefinitions(el, "link")) continue
					if (isActivity(el) && el.isForCompensation === true) continue
					if (
						el.type === "boundaryEvent" &&
						onlyDefinitions(el, "compensate") &&
						associations.some((a) => a.sourceRef === el.id)
					)
						continue
					if ((scope.bySource.get(el.id) ?? []).length > 0) continue
					report(
						"flow/implicit-end",
						`Element "${el.id}" (${el.type}) has no outgoing sequence flow, so it ends the flow implicitly.`,
						"Connect it to an end event.",
						scope.processId,
						[el.id],
					)
				}
			}
		},
	},

	"no-implicit-start": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				if (scope.kind === "adHocSubProcess") continue
				for (const el of scope.container.flowElements) {
					if (!isFlowNode(el) || isEventSubProcess(el)) continue
					if (el.type === "startEvent" || el.type === "boundaryEvent") continue
					if (el.type === "intermediateCatchEvent" && onlyDefinitions(el, "link")) continue
					if (isActivity(el) && el.isForCompensation === true) continue
					if ((scope.byTarget.get(el.id) ?? []).length > 0) continue
					report(
						"flow/implicit-start",
						`Element "${el.id}" (${el.type}) has no incoming sequence flow, so it starts the flow implicitly.`,
						"Connect it from a start event or an upstream element.",
						scope.processId,
						[el.id],
					)
				}
			}
		},
	},

	"no-implicit-split": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				for (const el of scope.container.flowElements) {
					if (!isActivity(el) && !isEvent(el)) continue
					const defaultFlow = defaultFlowOf(el)
					const unconditional = (scope.bySource.get(el.id) ?? []).filter(
						(flow) => !hasCondition(flow) && flow.id !== defaultFlow,
					)
					if (unconditional.length <= 1) continue
					report(
						"flow/implicit-split",
						`Element "${el.id}" (${el.type}) splits the flow implicitly into ${unconditional.length} unconditional flows.`,
						"Model the split with an explicit parallel gateway.",
						scope.processId,
						[el.id],
					)
				}
			}
		},
	},

	"no-inclusive-gateway": {
		category: "pattern",
		check({ scopes }, report) {
			discouraged(
				scopes,
				report,
				"inclusiveGateway",
				"pattern/inclusive-gateway",
				"inclusive gateway",
			)
		},
	},

	"no-overlapping-elements": {
		category: "pattern",
		check({ defs }, report) {
			checkOverlaps(defs, report)
		},
	},

	"single-blank-start-event": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				const blank = scope.container.flowElements.filter(
					(el) => el.type === "startEvent" && el.eventDefinitions.length === 0,
				)
				if (blank.length <= 1) continue
				const what = scope.kind === "process" ? "Process" : "Sub-process"
				report(
					"flow/multiple-blank-start-events",
					`${what} "${scope.container.id}" has ${blank.length} blank start events.`,
					"Keep one blank start event per scope; give the others a trigger or remove them.",
					scope.processId,
					[scope.container.id],
				)
			}
		},
	},

	"single-event-definition": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				for (const el of scope.container.flowElements) {
					const count = eventDefinitionsOf(el).length
					if (count <= 1) continue
					report(
						"flow/multiple-event-definitions",
						`Event "${el.id}" has ${count} event definitions.`,
						"Keep one event definition per event; split the others into separate events.",
						scope.processId,
						[el.id],
					)
				}
			}
		},
	},

	"standard-size": {
		category: "pattern",
		check({ defs, options }, report) {
			checkStandardSizes(defs, options, report)
		},
	},

	"start-event-required": {
		category: "flow",
		check({ scopes }, report) {
			// Top-level processes are covered by `flow/no-start-event`.
			for (const scope of scopes) {
				if (!SUB_SCOPE_KINDS.has(scope.kind)) continue
				if (scope.container.flowElements.some((el) => el.type === "startEvent")) continue
				report(
					"flow/sub-process-no-start-event",
					`Sub-process "${scope.container.id}" has no start event.`,
					"Add a start event so it is clear where the sub-process begins.",
					scope.processId,
					[scope.container.id],
				)
			}
		},
	},

	"sub-process-blank-start-event": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				if (scope.kind === "process" || scope.eventSubProcess) continue
				for (const el of scope.container.flowElements) {
					if (el.type !== "startEvent" || el.eventDefinitions.length === 0) continue
					report(
						"flow/sub-process-typed-start",
						`Start event "${el.id}" of sub-process "${scope.container.id}" has an event definition.`,
						"A sub-process is entered through its sequence flow — make the start event blank.",
						scope.processId,
						[el.id],
					)
				}
			}
		},
	},

	"superfluous-gateway": {
		category: "flow",
		check({ scopes }, report) {
			// `flow/redundant-gateway` from `optimize()` covers the top level.
			for (const scope of scopes) {
				if (scope.kind === "process") continue
				for (const el of scope.container.flowElements) {
					if (!isGateway(el)) continue
					const incoming = (scope.byTarget.get(el.id) ?? []).length
					const outgoing = (scope.bySource.get(el.id) ?? []).length
					if (incoming !== 1 || outgoing !== 1) continue
					report(
						"flow/redundant-gateway",
						`Gateway "${el.id}" (${el.type}) has only 1 incoming and 1 outgoing flow — it is redundant.`,
						"Remove this gateway and connect its source directly to its target.",
						scope.processId,
						[el.id],
					)
				}
			}
		},
	},

	"superfluous-label": {
		category: "naming",
		check({ scopes }, report) {
			for (const scope of scopes) {
				const byId = new Map(scope.container.flowElements.map((el) => [el.id, el]))
				for (const flow of scope.container.sequenceFlows) {
					if ((flow.name ?? "").trim() === "" || hasCondition(flow)) continue
					const source = byId.get(flow.sourceRef)
					if (defaultFlowOf(source) === flow.id) continue
					const decisionFork =
						(source?.type === "exclusiveGateway" || source?.type === "inclusiveGateway") &&
						(scope.bySource.get(source.id) ?? []).length > 1
					if (decisionFork) continue
					report(
						"naming/superfluous-flow-label",
						`Sequence flow "${flow.id}" is labeled "${flow.name}" but carries no condition.`,
						"Remove the label — only conditional, default and decision-gateway flows need one.",
						scope.processId,
						[flow.id],
					)
				}
			}
		},
	},

	"superfluous-termination": {
		category: "flow",
		check({ scopes }, report) {
			for (const scope of scopes) {
				if (scope.kind === "adHocSubProcess") continue
				const ends = scope.container.flowElements.filter(
					(el) => isFlowNode(el) && (scope.bySource.get(el.id) ?? []).length === 0,
				)
				const isTerminate = (el: BpmnFlowElement) =>
					el.type === "endEvent" && el.eventDefinitions.some((d) => d.type === "terminate")
				const isInterruptingEventSub = (el: BpmnFlowElement) =>
					isEventSubProcess(el) &&
					isSubContainer(el) &&
					el.flowElements.some((c) => c.type === "startEvent" && c.isInterrupting !== false)
				const terminates = ends.filter(isTerminate)
				if (terminates.length !== 1) continue
				if (!ends.every((el) => isTerminate(el) || isInterruptingEventSub(el))) continue
				for (const el of terminates) {
					report(
						"flow/superfluous-termination",
						`Terminate end event "${el.id}" is the only way this scope ends, so terminating is superfluous.`,
						"Use a plain end event.",
						scope.processId,
						[el.id],
					)
				}
			}
		},
	},
}

function discouraged(
	scopes: Scope[],
	report: Reporter,
	type: BpmnFlowElement["type"],
	id: string,
	label: string,
): void {
	for (const scope of scopes) {
		for (const el of scope.container.flowElements) {
			if (el.type !== type) continue
			report(
				id,
				`Element "${el.id}" is a ${label}, which this project's lint configuration discourages.`,
				"Model the routing with exclusive or parallel gateways instead.",
				scope.processId,
				[el.id],
			)
		}
	}
}

// ---------------------------------------------------------------------------
// Geometry rules
// ---------------------------------------------------------------------------

function validBounds(bounds: BpmnBounds | undefined): bounds is BpmnBounds {
	return (
		bounds !== undefined &&
		Number.isFinite(bounds.x) &&
		Number.isFinite(bounds.y) &&
		Number.isFinite(bounds.width) &&
		Number.isFinite(bounds.height)
	)
}

/** Touching counts as a collision, as it does in bpmnlint. */
function collides(a: BpmnBounds, b: BpmnBounds): boolean {
	return (
		a.x + a.width >= b.x && b.x + b.width >= a.x && a.y + a.height >= b.y && b.y + b.height >= a.y
	)
}

function inside(child: BpmnBounds, parent: BpmnBounds): boolean {
	return (
		child.x >= parent.x &&
		child.y >= parent.y &&
		child.x + child.width <= parent.x + parent.width &&
		child.y + child.height <= parent.y + parent.height
	)
}

function shapeIndex(defs: BpmnDefinitions): Map<string, BpmnDiShape> {
	const shapes = new Map<string, BpmnDiShape>()
	for (const diagram of defs.diagrams) {
		for (const shape of diagram.plane.shapes) shapes.set(shape.bpmnElement, shape)
	}
	return shapes
}

function checkOverlaps(defs: BpmnDefinitions, report: Reporter): void {
	const shapes = shapeIndex(defs)
	const overlapping = new Map<string, string>()
	const outside = new Map<string, string>()

	const pairwise = (
		elements: { id: string; attachedToRef?: string }[],
		processId: string,
	): void => {
		for (let i = 0; i < elements.length; i++) {
			const a = elements[i] as { id: string; attachedToRef?: string }
			for (let j = i + 1; j < elements.length; j++) {
				const b = elements[j] as { id: string; attachedToRef?: string }
				// A boundary event sits on its host by design.
				if (a.attachedToRef === b.id || b.attachedToRef === a.id) continue
				const boundsA = shapes.get(a.id)?.bounds
				const boundsB = shapes.get(b.id)?.bounds
				if (!validBounds(boundsA) || !validBounds(boundsB)) continue
				if (!collides(boundsA, boundsB)) continue
				overlapping.set(a.id, processId)
				overlapping.set(b.id, processId)
			}
		}
	}

	const container = (c: Container, processId: string, parent: BpmnBounds | undefined): void => {
		const drawn = c.flowElements.filter((el) => shapes.has(el.id))
		pairwise(drawn, processId)
		for (const el of drawn) {
			// Data store references may sit outside their parent for historical reasons.
			if (el.type === "dataStoreReference") continue
			const bounds = shapes.get(el.id)?.bounds
			if (validBounds(bounds) && validBounds(parent) && !inside(bounds, parent)) {
				outside.set(el.id, processId)
			}
		}
		for (const el of c.flowElements) {
			if (!isSubContainer(el)) continue
			const shape = shapes.get(el.id)
			container(el, processId, shape?.isExpanded === true ? shape.bounds : undefined)
		}
	}

	const participantBounds = new Map<string, BpmnBounds>()
	for (const collaboration of defs.collaborations) {
		pairwise(collaboration.participants, defs.id)
		for (const participant of collaboration.participants) {
			const bounds = shapes.get(participant.id)?.bounds
			if (participant.processRef && bounds) participantBounds.set(participant.processRef, bounds)
		}
	}
	for (const process of defs.processes) {
		container(process, process.id, participantBounds.get(process.id))
	}

	for (const [id, processId] of overlapping) {
		report(
			"pattern/overlapping-elements",
			`Element "${id}" overlaps another element.`,
			"Move the shapes apart so neither hides the other.",
			processId,
			[id],
		)
	}
	for (const [id, processId] of outside) {
		report(
			"pattern/overlapping-elements",
			`Element "${id}" lies outside its parent's boundary.`,
			"Move it inside the pool or sub-process it belongs to.",
			processId,
			[id],
		)
	}
}

type Size = { width?: number; height?: number }

/** bpmn-js's default sizes, as bpmnlint copies them. Overridable per type. */
const DEFAULT_SIZES: Record<string, Size> = {
	"bpmn:Task": { width: 100, height: 80 },
	"bpmn:CallActivity": { width: 100, height: 80 },
	"bpmn:SubProcess": { width: 100, height: 80 },
	"bpmn:Gateway": { width: 50, height: 50 },
	"bpmn:Event": { width: 36, height: 36 },
	"bpmn:DataObjectReference": { width: 36, height: 50 },
	"bpmn:DataStoreReference": { width: 50, height: 50 },
	"bpmn:Participant": { width: 60, height: 60 },
}

function sizeType(el: BpmnFlowElement): string | undefined {
	if (isSubContainer(el)) return "bpmn:SubProcess"
	if (el.type === "callActivity") return "bpmn:CallActivity"
	if (TASK_TYPES.has(el.type)) return "bpmn:Task"
	if (isGateway(el)) return "bpmn:Gateway"
	if (isEvent(el)) return "bpmn:Event"
	if (el.type === "dataObjectReference") return "bpmn:DataObjectReference"
	if (el.type === "dataStoreReference") return "bpmn:DataStoreReference"
	return undefined
}

function checkStandardSizes(defs: BpmnDefinitions, options: unknown, report: Reporter): void {
	const overrides =
		typeof options === "object" && options !== null ? (options as Record<string, unknown>) : {}
	const sizes: Record<string, unknown> = { ...DEFAULT_SIZES, ...overrides }

	const elements = new Map<string, { el: BpmnFlowElement; processId: string }>()
	for (const scope of allScopes(defs)) {
		for (const el of scope.container.flowElements) {
			elements.set(el.id, { el, processId: scope.processId })
		}
	}
	const participants = new Map(
		defs.collaborations.flatMap((c) => c.participants).map((p) => [p.id, p]),
	)

	for (const diagram of defs.diagrams) {
		for (const shape of diagram.plane.shapes) {
			let expected: Size | undefined
			let processId = defs.id
			const participant = participants.get(shape.bpmnElement)
			if (participant !== undefined) {
				// A pool with content follows its content; an empty one has one fixed breadth.
				if (participant.processRef) continue
				const size = sizes["bpmn:Participant"] as Size | undefined
				const horizontal = shape.isHorizontal !== false
				const value = horizontal ? size?.height : size?.width
				if (typeof value !== "number") continue
				expected = horizontal ? { height: value } : { width: value }
			} else {
				const found = elements.get(shape.bpmnElement)
				if (found === undefined) continue
				if (isSubContainer(found.el) && shape.isExpanded === true) continue
				const type = sizeType(found.el)
				const size = type === undefined ? undefined : sizes[type]
				if (typeof size !== "object" || size === null) continue
				expected = size as Size
				processId = found.processId
			}

			const { width, height } = shape.bounds
			const widthOff = typeof expected.width === "number" && width !== expected.width
			const heightOff = typeof expected.height === "number" && height !== expected.height
			if (!widthOff && !heightOff) continue

			const want =
				typeof expected.height !== "number"
					? `width ${expected.width}`
					: typeof expected.width !== "number"
						? `height ${expected.height}`
						: `${expected.width}x${expected.height}`
			report(
				"pattern/non-standard-size",
				`Element "${shape.bpmnElement}" is ${width}x${height}; the standard size is ${want}.`,
				"Resize it to the standard size so diagrams across the project read alike.",
				processId,
				[shape.bpmnElement],
			)
		}
	}
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** The bpmnlint rules this module implements natively. */
export const NATIVE_BPMNLINT_RULES: readonly string[] = Object.keys(RULES)

/**
 * Runs the native equivalents of the given bpmnlint rules.
 *
 * Findings come back at `warning` severity; the caller applies the severity
 * the `.bpmnlintrc` asked for.
 *
 * @param defs - The model to check.
 * @param rules - bpmnlint rule name → that rule's options from the config.
 * @param categories - When given, rules outside these categories are skipped.
 */
export function analyzeBpmnlintRules(
	defs: BpmnDefinitions,
	rules: ReadonlyMap<string, unknown>,
	categories?: readonly OptimizationCategory[],
): OptimizationFinding[] {
	const findings: OptimizationFinding[] = []
	const scopes = allScopes(defs)
	for (const [name, options] of rules) {
		const rule = RULES[name]
		if (rule === undefined) continue
		if (categories !== undefined && !categories.includes(rule.category)) continue
		rule.check({ defs, scopes, options }, (id, message, suggestion, processId, elementIds) => {
			findings.push({
				id,
				category: rule.category,
				severity: "warning",
				message,
				suggestion,
				processId,
				elementIds,
			})
		})
	}
	return findings
}
