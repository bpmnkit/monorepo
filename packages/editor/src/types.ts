import type { CanvasEvents, CanvasOptions } from "@bpmn-sdk/canvas"
import type { BpmnDefinitions } from "@bpmn-sdk/core"

export type CreateShapeType =
	| "startEvent"
	| "messageStartEvent"
	| "timerStartEvent"
	| "conditionalStartEvent"
	| "signalStartEvent"
	| "endEvent"
	| "messageEndEvent"
	| "escalationEndEvent"
	| "errorEndEvent"
	| "compensationEndEvent"
	| "signalEndEvent"
	| "terminateEndEvent"
	| "intermediateThrowEvent"
	| "intermediateCatchEvent"
	| "messageCatchEvent"
	| "messageThrowEvent"
	| "timerCatchEvent"
	| "escalationThrowEvent"
	| "conditionalCatchEvent"
	| "linkCatchEvent"
	| "linkThrowEvent"
	| "compensationThrowEvent"
	| "signalCatchEvent"
	| "signalThrowEvent"
	| "task"
	| "serviceTask"
	| "userTask"
	| "scriptTask"
	| "sendTask"
	| "receiveTask"
	| "businessRuleTask"
	| "manualTask"
	| "callActivity"
	| "subProcess"
	| "adHocSubProcess"
	| "transaction"
	| "exclusiveGateway"
	| "parallelGateway"
	| "inclusiveGateway"
	| "eventBasedGateway"
	| "complexGateway"
	| "textAnnotation"

/** Element types that support resize handles. */
export const RESIZABLE_TYPES: ReadonlySet<string> = new Set([
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
	"transaction",
	"textAnnotation",
])

export type Tool = "select" | "pan" | "space" | `create:${CreateShapeType}`

export type HandleDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"
export type PortDir = "top" | "right" | "bottom" | "left"

export type EditorOptions = CanvasOptions & {
	/**
	 * When true, the editor reads the initial theme from
	 * `localStorage.getItem("bpmn-theme")` and persists theme changes back to
	 * localStorage automatically. The stored key is `"bpmn-theme"`.
	 */
	persistTheme?: boolean
}

export interface EditorEvents extends CanvasEvents {
	"diagram:change": (defs: BpmnDefinitions) => void
	"editor:select": (ids: string[]) => void
	"editor:tool": (tool: Tool) => void
	"editor:drag": (dragging: boolean) => void
}

/** Label position options for events and gateways (external labels). */
export type LabelPosition =
	| "bottom"
	| "top"
	| "left"
	| "right"
	| "bottom-left"
	| "bottom-right"
	| "top-left"
	| "top-right"

export type HitResult =
	| { type: "canvas" }
	| { type: "shape"; id: string }
	| { type: "handle"; shapeId: string; handle: HandleDir }
	| { type: "port"; shapeId: string; port: PortDir }
	| { type: "edge"; id: string }
	| { type: "edge-endpoint"; edgeId: string; isStart: boolean }
	| { type: "edge-segment"; id: string; segIdx: number; isHoriz: boolean; projPt: DiagPoint }
	| { type: "edge-waypoint"; id: string; wpIdx: number; pt: DiagPoint }

export interface DiagPoint {
	x: number
	y: number
}
