/**
 * Turning a parsed JSON blob from a browser into an `EditorOp`, or refusing to.
 *
 * `applyOp` is written for the editor, which only ever hands it ops it built
 * itself. The room's ops arrive over a socket from a page anyone with the link
 * can open and a devtools console can rewrite, so something has to stand
 * between the two. This is that thing.
 *
 * It checks shape, not sense: that `kind` is one the editor knows and that each
 * field it will read is the type it expects. Whether the result is a *good*
 * edit — that the ids exist, that nothing is left dangling — is settled after
 * replay by `checkIntegrity`, which can answer it properly because by then the
 * document exists. Splitting it that way keeps this function free of any BPMN
 * knowledge, so it cannot go stale as the model grows.
 *
 * The bound on strings and arrays is not about correctness. An op is a few
 * hundred bytes; anything wildly larger is either a bug or someone probing, and
 * either way the room should not spend a CPU slice on it.
 */
import type { EditorOp } from "@bpmnkit/editor/headless"

/** Longest accepted element id or name. Real ones are a fraction of this. */
const MAX_STRING = 4_000

/** Most elements one op may name — a select-all delete on a large diagram. */
const MAX_LIST = 5_000

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v)

const str = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_STRING

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

const int = (v: unknown): v is number => num(v) && Number.isInteger(v) && v >= 0

const optStr = (v: unknown): boolean => v === undefined || str(v)

const list = (v: unknown, each: (item: unknown) => boolean): boolean =>
	Array.isArray(v) && v.length <= MAX_LIST && v.every(each)

const bounds = (v: unknown): boolean =>
	isObject(v) && num(v.x) && num(v.y) && num(v.width) && num(v.height)

const point = (v: unknown): boolean => isObject(v) && num(v.x) && num(v.y)

const move = (v: unknown): boolean => isObject(v) && str(v.id) && num(v.dx) && num(v.dy)

const PORTS = new Set(["top", "right", "bottom", "left"])

/** Field checks per op kind. Anything not listed here is not an op. */
const SHAPES: Record<string, (op: Json) => boolean> = {
	createShape: (o) =>
		str(o.type) && bounds(o.bounds) && optStr(o.name) && optStr(o.onEdge) && str(o.seed),
	createBoundaryEvent: (o) =>
		str(o.hostId) &&
		(o.eventDefType === null || str(o.eventDefType)) &&
		bounds(o.bounds) &&
		str(o.seed),
	createAnnotation: (o) => bounds(o.bounds) && optStr(o.text) && str(o.seed),
	createAnnotationFor: (o) =>
		str(o.sourceId) && bounds(o.bounds) && bounds(o.sourceBounds) && str(o.seed),
	createConnection: (o) =>
		str(o.sourceId) && str(o.targetId) && list(o.waypoints, point) && str(o.seed),
	createConnected: (o) =>
		str(o.sourceId) &&
		str(o.type) &&
		optStr(o.name) &&
		bounds(o.bounds) &&
		list(o.waypoints, point) &&
		str(o.seed),
	// A clipboard is the editor's own structure, echoed back whole. Its contents
	// go through `checkIntegrity` like anything else, so the shape check here is
	// that it is an object of arrays rather than a recursive re-validation.
	paste: (o) => isObject(o.clipboard) && num(o.offsetX) && num(o.offsetY) && str(o.seed),
	move: (o) =>
		list(o.moves, move) &&
		(o.onEdge === undefined ||
			(isObject(o.onEdge) && str(o.onEdge.edgeId) && str(o.onEdge.shapeId))),
	resize: (o) => str(o.id) && bounds(o.bounds),
	delete: (o) => list(o.ids, str),
	rename: (o) => str(o.id) && str(o.name),
	labelPosition: (o) => str(o.id) && bounds(o.bounds),
	color: (o) => str(o.id) && isObject(o.color),
	changeType: (o) => str(o.id) && str(o.type),
	reconnect: (o) =>
		str(o.edgeId) && typeof o.isStart === "boolean" && str(o.port) && PORTS.has(o.port),
	insertWaypoint: (o) => str(o.edgeId) && int(o.segIdx) && point(o.point),
	moveWaypoint: (o) => str(o.edgeId) && int(o.wpIdx) && point(o.point),
	moveSegment: (o) =>
		str(o.edgeId) && int(o.segIdx) && typeof o.isHoriz === "boolean" && num(o.delta),
	autoLayout: () => true,
	// A whole document, which `checkIntegrity` is the real gate for. Accepting
	// one is not a privilege escalation: the holder could reach any document it
	// describes through ops anyway.
	snapshot: (o) => isObject(o.defs),
}

/** The op this value describes, or `null` when it describes none. */
export function parseOp(value: unknown): EditorOp | null {
	if (!isObject(value) || typeof value.kind !== "string") return null
	const check = SHAPES[value.kind]
	return check?.(value) ? (value as unknown as EditorOp) : null
}
