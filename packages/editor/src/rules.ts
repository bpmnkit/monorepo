import type { BpmnElementType } from "@bpmn-sdk/core"

/**
 * Returns true if a sequence flow from `sourceType` to `targetType` is valid.
 *
 * - endEvent cannot be a source
 * - startEvent cannot be a target
 * - boundaryEvent can only be a source
 */
export function canConnect(sourceType: BpmnElementType, targetType: BpmnElementType): boolean {
	if (sourceType === "endEvent") return false
	if (targetType === "startEvent") return false
	if (targetType === "boundaryEvent") return false
	return true
}
