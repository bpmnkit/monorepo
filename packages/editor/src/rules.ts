import { RESIZABLE_TYPES } from "./types.js"

/**
 * BPMN modeling rules — a small, dependency-free rule set matching the intent of
 * bpmn-js's `BpmnRules`. Each predicate answers a single yes/no question and is
 * consulted by the editor (state machine + HUD) before enabling or committing an
 * action, so illegal edits are refused both visually and at commit time.
 */

const ACTIVITY_TYPES: ReadonlySet<string> = new Set([
	"task",
	"serviceTask",
	"userTask",
	"scriptTask",
	"sendTask",
	"receiveTask",
	"businessRuleTask",
	"manualTask",
	"callActivity",
	"subProcess",
	"adHocSubProcess",
	"eventSubProcess",
	"transaction",
])

const CONTAINER_TYPES: ReadonlySet<string> = new Set([
	"process",
	"subProcess",
	"adHocSubProcess",
	"eventSubProcess",
	"transaction",
	"participant",
	"lane",
])

const DATA_TYPES: ReadonlySet<string> = new Set([
	"dataObject",
	"dataObjectReference",
	"dataStoreReference",
])

/** True when `type` is an activity (task family, sub-process, call activity, …). */
export function isActivity(type: string): boolean {
	return ACTIVITY_TYPES.has(type)
}

/** Morph category: two types can be morphed into one another iff they share a category. */
type MorphCategory = "startEvent" | "endEvent" | "intermediateEvent" | "activity" | "gateway"

function morphCategory(type: string): MorphCategory | null {
	if (type.endsWith("Gateway")) return "gateway"
	if (type === "startEvent" || type.endsWith("StartEvent")) return "startEvent"
	if (type === "endEvent" || type.endsWith("EndEvent")) return "endEvent"
	if (
		type === "intermediateCatchEvent" ||
		type === "intermediateThrowEvent" ||
		type.endsWith("CatchEvent") ||
		type.endsWith("ThrowEvent")
	) {
		return "intermediateEvent"
	}
	if (ACTIVITY_TYPES.has(type)) return "activity"
	return null
}

/**
 * Returns true if a sequence flow from `sourceType` to `targetType` is valid.
 *
 * BPMN defaults: an end event has no outgoing flow, a start event has no
 * incoming flow, boundary events attach (they are never a flow *target*), data
 * elements and annotations use associations rather than sequence flows, and an
 * event-based gateway may only target intermediate catch events or receive tasks.
 */
export function canConnect(sourceType: string, targetType: string): boolean {
	// End events never emit, start events never receive.
	if (sourceType === "endEvent" || sourceType.endsWith("EndEvent")) return false
	if (targetType === "startEvent" || targetType.endsWith("StartEvent")) return false
	if (targetType === "boundaryEvent") return false

	// Data elements and text annotations are not sequence-flow endpoints.
	if (DATA_TYPES.has(sourceType) || DATA_TYPES.has(targetType)) return false
	if (sourceType === "textAnnotation" || targetType === "textAnnotation") return false

	// Event-based gateway → intermediate catch event or receive task only.
	if (sourceType === "eventBasedGateway") {
		return targetType === "intermediateCatchEvent" || targetType === "receiveTask"
	}

	return true
}

/** Returns true if a boundary event may attach to a host of `hostType` (activities only). */
export function canAttach(hostType: string): boolean {
	return isActivity(hostType)
}

/**
 * Returns true if a `parentType` container may hold a `childType` element.
 * Containers hold flow nodes; lanes and pools hold flow nodes but not other
 * pools; data/annotation elements and flows are never containers.
 */
export function canContain(parentType: string, childType: string): boolean {
	if (!CONTAINER_TYPES.has(parentType)) return false
	// Pools/lanes and sub-processes never contain a participant (pool).
	if (childType === "participant") return false
	return true
}

/** Returns true if an element of `type` supports interactive resizing. */
export function canResize(type: string): boolean {
	return RESIZABLE_TYPES.has(type)
}

/** Returns true if an element may be morphed from `fromType` into `toType` (same category). */
export function canMorph(fromType: string, toType: string): boolean {
	if (fromType === toType) return false
	const from = morphCategory(fromType)
	return from !== null && from === morphCategory(toType)
}
