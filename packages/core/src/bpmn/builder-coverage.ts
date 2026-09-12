/**
 * Which fluent-builder method covers each BPMN element type.
 *
 * The fluent builder is hand-written, one method per element type, while
 * `BpmnElementType` grows whenever the model learns a new construct. Nothing
 * connected the two, so types reached the parser, the serialiser, the layout
 * and the compact/JSON path while the builder — the surface most callers and
 * every code-generating agent actually use — silently lacked a method. An agent
 * that cannot say `.manualTask()` edits the XML by hand instead.
 *
 * This table closes that loop. It is a `Record` keyed by `BpmnElementType`, so
 * **adding a member to that union fails `tsc` here until the new type is either
 * given a builder method or exempted with a reason**. The check is compile-time
 * and total; it cannot be forgotten, and it cannot pass by accident.
 *
 * `tests/builder-coverage.test.ts` carries the runtime half: every `method`
 * named here must exist on all three flow builders, and every `exempt` entry
 * must still have no method of that name — so an exemption someone outgrows
 * fails rather than lingers.
 *
 * Run `pnpm --filter @bpmnkit/core check:builder` to print the table.
 */
import type { BpmnElementType } from "./bpmn-model.js"

/** An element type the fluent builder exposes a method for. */
export interface BuilderMethodEntry {
	/** Method name, present on every flow builder. */
	readonly method: string
	/**
	 * The `type` the method stamps, when it differs from the key.
	 *
	 * Only `eventSubProcess` needs this: BPMN 2.0 has no `bpmn:eventSubProcess`
	 * element, so the builder emits the spec form — `subProcess` with
	 * `triggeredByEvent="true"`. The key exists because the parser accepts the
	 * non-standard element and round-trips it.
	 */
	readonly emits?: BpmnElementType
}

/** An element type the fluent builder deliberately has no method for. */
export interface BuilderExemptEntry {
	/** Why a method would be wrong — not merely why one is missing. */
	readonly exempt: string
}

export type BuilderSupport = BuilderMethodEntry | BuilderExemptEntry

/** Narrows a {@link BuilderSupport} to the entries that name a method. */
export function hasBuilderMethod(support: BuilderSupport): support is BuilderMethodEntry {
	return "method" in support
}

/**
 * Data elements are not sequence-flow participants, and the fluent builder has
 * no data-association API. Every builder method appends to the chain and wires
 * a sequence flow from the previous node, so a `.dataObject()` would either
 * emit invalid BPMN or leave an orphan shape. Parsing and serialising keep
 * these types; authoring them is a separate API, not a chain method.
 */
const NOT_A_CHAIN_PARTICIPANT =
	"Connected by data associations, not sequence flows; the chain has nowhere to put it"

/**
 * Every `BpmnElementType`, mapped to the builder method that creates it.
 *
 * Adding a type to the union without adding it here is a compile error.
 */
export const BUILDER_COVERAGE: Record<BpmnElementType, BuilderSupport> = {
	// ---- Events ----
	startEvent: { method: "startEvent" },
	endEvent: { method: "endEvent" },
	intermediateThrowEvent: { method: "intermediateThrowEvent" },
	intermediateCatchEvent: { method: "intermediateCatchEvent" },
	boundaryEvent: { method: "boundaryEvent" },

	// ---- Activities ----
	task: { method: "task" },
	serviceTask: { method: "serviceTask" },
	scriptTask: { method: "scriptTask" },
	userTask: { method: "userTask" },
	sendTask: { method: "sendTask" },
	receiveTask: { method: "receiveTask" },
	businessRuleTask: { method: "businessRuleTask" },
	manualTask: { method: "manualTask" },
	callActivity: { method: "callActivity" },

	// ---- Gateways ----
	exclusiveGateway: { method: "exclusiveGateway" },
	parallelGateway: { method: "parallelGateway" },
	inclusiveGateway: { method: "inclusiveGateway" },
	eventBasedGateway: { method: "eventBasedGateway" },
	complexGateway: { method: "complexGateway" },

	// ---- Containers ----
	subProcess: { method: "subProcess" },
	adHocSubProcess: { method: "adHocSubProcess" },
	eventSubProcess: { method: "eventSubProcess", emits: "subProcess" },
	transaction: { method: "transaction" },

	// ---- Data ----
	dataObject: { exempt: NOT_A_CHAIN_PARTICIPANT },
	dataObjectReference: { exempt: NOT_A_CHAIN_PARTICIPANT },
	dataStoreReference: { exempt: NOT_A_CHAIN_PARTICIPANT },
}

/**
 * The builders the table applies to — every class that builds a flow chain.
 *
 * `DiagramBuilder` is excluded on purpose: it assembles collaborations,
 * participants and message flows, and never adds flow elements itself.
 */
export const FLOW_BUILDER_NAMES = [
	"ProcessBuilder",
	"BranchBuilder",
	"SubProcessContentBuilder",
] as const
