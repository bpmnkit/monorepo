import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { applyAutoLayout } from "../src/bpmn/auto-layout.js"
import type { BpmnDefinitions, BpmnFlowElement } from "../src/bpmn/bpmn-model.js"
import { Bpmn } from "../src/bpmn/index.js"
import { orderPools } from "../src/layout/collaboration/ordering.js"
import { routeOrthogonal, sidePorts } from "../src/layout/orthogonal.js"
import { repairRoutes } from "../src/layout/repair.js"
import type { Bounds, Waypoint } from "../src/layout/types.js"

/** True when a polyline enters the interior of (or runs along) `box`. */
function crosses(route: Waypoint[], box: Bounds): boolean {
	for (let i = 0; i + 1 < route.length; i++) {
		const a = route[i] as Waypoint
		const b = route[i + 1] as Waypoint
		const minX = Math.min(a.x, b.x)
		const maxX = Math.max(a.x, b.x)
		const minY = Math.min(a.y, b.y)
		const maxY = Math.max(a.y, b.y)
		if (maxX >= box.x && minX <= box.x + box.width && maxY >= box.y && minY <= box.y + box.height)
			return true
	}
	return false
}

function orthogonal(route: Waypoint[]): boolean {
	for (let i = 0; i + 1 < route.length; i++) {
		const a = route[i] as Waypoint
		const b = route[i + 1] as Waypoint
		if (a.x !== b.x && a.y !== b.y) return false
	}
	return true
}

describe("routeOrthogonal", () => {
	const source: Bounds = { x: 0, y: 0, width: 100, height: 80 }
	const target: Bounds = { x: 400, y: 0, width: 100, height: 80 }
	const wall: Bounds = { x: 200, y: -40, width: 100, height: 160 }

	it("goes around a shape standing between the two ends", () => {
		const route = routeOrthogonal({
			from: sidePorts(source),
			to: sidePorts(target),
			obstacles: [wall],
		})
		expect(route).not.toBeNull()
		const r = route as Waypoint[]
		expect(orthogonal(r)).toBe(true)
		expect(crosses(r, wall)).toBe(false)
		const onBorder = (p: Waypoint | undefined, b: Bounds): boolean =>
			p !== undefined &&
			(p.x === b.x || p.x === b.x + b.width || p.y === b.y || p.y === b.y + b.height)
		expect(onBorder(r[0], source)).toBe(true)
		expect(onBorder(r[r.length - 1], target)).toBe(true)
	})

	it("is deterministic", () => {
		const request = { from: sidePorts(source), to: sidePorts(target), obstacles: [wall] }
		expect(routeOrthogonal(request)).toEqual(routeOrthogonal(request))
	})

	it("prefers a detour over cutting across a bundle of existing routes", () => {
		// Five routes cross the straight line between the two shapes at x = 250; a
		// small shape further down offers a corridor beneath them.
		const existing: [Waypoint, Waypoint] = [
			{ x: 250, y: 30 },
			{ x: 250, y: 50 },
		]
		const route = routeOrthogonal({
			from: sidePorts(source, { top: 1000, bottom: 1000, left: 1000 }),
			to: sidePorts(target, { top: 1000, bottom: 1000, right: 1000 }),
			obstacles: [{ x: 240, y: 150, width: 20, height: 20 }],
			crossings: (a, b) =>
				Math.min(a.x, b.x) < existing[0].x &&
				existing[0].x < Math.max(a.x, b.x) &&
				Math.min(existing[0].y, existing[1].y) < a.y &&
				a.y < Math.max(existing[0].y, existing[1].y)
					? 5
					: 0,
		}) as Waypoint[]
		expect(route.length).toBeGreaterThan(2)
		expect(route.every((p) => p.y <= 30 || p.y >= 50 || p.x < 250 || p.x > 250)).toBe(true)
	})

	it("returns null when the target is walled in", () => {
		const walls: Bounds[] = [
			{ x: 360, y: -40, width: 180, height: 20 },
			{ x: 360, y: 100, width: 180, height: 20 },
			{ x: 360, y: -40, width: 20, height: 160 },
			{ x: 520, y: -40, width: 20, height: 160 },
		]
		expect(
			routeOrthogonal({ from: sidePorts(source), to: sidePorts(target), obstacles: walls }),
		).toBeNull()
	})
})

describe("repairRoutes", () => {
	it("re-routes a connection that runs through an unrelated shape, and leaves clear ones alone", () => {
		const shapes = [
			{ id: "A", bounds: { x: 0, y: 0, width: 100, height: 80 }, container: false },
			{ id: "B", bounds: { x: 200, y: 0, width: 100, height: 80 }, container: false },
			{ id: "C", bounds: { x: 400, y: 0, width: 100, height: 80 }, container: false },
			{ id: "Pool", bounds: { x: -50, y: -100, width: 700, height: 300 }, container: true },
		]
		const through = {
			kind: "association" as const,
			sourceRef: "A",
			targetRef: "C",
			waypoints: [
				{ x: 100, y: 40 },
				{ x: 400, y: 40 },
			],
		}
		const clear = {
			kind: "sequence" as const,
			sourceRef: "A",
			targetRef: "B",
			waypoints: [
				{ x: 100, y: 40 },
				{ x: 200, y: 40 },
			],
		}
		const original = clear.waypoints
		repairRoutes(
			shapes,
			[through, clear],
			() => [],
			() => undefined,
		)
		expect(crosses(through.waypoints, shapes[1]?.bounds as Bounds)).toBe(false)
		expect(clear.waypoints).toBe(original)
	})
})

describe("orderPools", () => {
	it("puts a partner pool on the side of the process its message leaves from", () => {
		// Pool 0 talks to pool 1 from its bottom edge and to pool 2 from its top.
		// Travel distance alone ties [1,0,2] with [2,0,1]; depth breaks it.
		const order = orderPools(3, [
			{ from: 0, to: 1, weight: 1, fromDepth: 1 },
			{ from: 0, to: 2, weight: 1, fromDepth: 0 },
		])
		expect(order).toEqual([2, 0, 1])
	})

	it("keeps declaration order among equals when no depth is known", () => {
		const order = orderPools(3, [
			{ from: 0, to: 1, weight: 1 },
			{ from: 0, to: 2, weight: 1 },
		])
		expect(order).toEqual([1, 0, 2])
	})
})

const LANES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d" targetNamespace="t">
  <bpmn:collaboration id="c">
    <bpmn:participant id="Pool" processRef="P" />
  </bpmn:collaboration>
  <bpmn:process id="P">
    <bpmn:laneSet id="ls">
      <bpmn:lane id="Top"><bpmn:flowNodeRef>s</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="Tall">
        <bpmn:flowNodeRef>g</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>a</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>b</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>c</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>j</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Bottom"><bpmn:flowNodeRef>e</bpmn:flowNodeRef></bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="s" />
    <bpmn:parallelGateway id="g" />
    <bpmn:task id="a" />
    <bpmn:task id="b" />
    <bpmn:task id="c" />
    <bpmn:parallelGateway id="j" />
    <bpmn:endEvent id="e" />
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="g" />
    <bpmn:sequenceFlow id="f2" sourceRef="g" targetRef="a" />
    <bpmn:sequenceFlow id="f3" sourceRef="g" targetRef="b" />
    <bpmn:sequenceFlow id="f4" sourceRef="g" targetRef="c" />
    <bpmn:sequenceFlow id="f5" sourceRef="a" targetRef="j" />
    <bpmn:sequenceFlow id="f6" sourceRef="b" targetRef="j" />
    <bpmn:sequenceFlow id="f7" sourceRef="c" targetRef="j" />
    <bpmn:sequenceFlow id="f8" sourceRef="j" targetRef="e" />
  </bpmn:process>
</bpmn:definitions>`

describe("pools with lanes", () => {
	it("frame every lane and element even when the tallest lane is not the first", () => {
		const laid = applyAutoLayout(Bpmn.parse(LANES_XML))
		const shapes = laid.diagrams[0]?.plane.shapes ?? []
		const pool = shapes.find((s) => s.bpmnElement === "Pool")?.bounds as Bounds
		const inside = (b: Bounds): boolean =>
			b.x >= pool.x &&
			b.y >= pool.y &&
			b.x + b.width <= pool.x + pool.width &&
			b.y + b.height <= pool.y + pool.height
		const lanes = shapes.filter((s) => ["Top", "Tall", "Bottom"].includes(s.bpmnElement))
		expect(lanes).toHaveLength(3)
		for (const shape of shapes) expect(inside(shape.bounds), shape.bpmnElement).toBe(true)
		// Lanes tile the pool exactly.
		const laneHeight = lanes.reduce((sum, lane) => sum + lane.bounds.height, 0)
		expect(laneHeight).toBe(pool.height)
		expect(Math.min(...lanes.map((l) => l.bounds.y))).toBe(pool.y)
	})
})

/**
 * Every connection on every plane that passes through, or runs along, a shape
 * other than its endpoints, the scopes and pools containing them, and a
 * boundary event's host.
 */
function routesThroughShapes(defs: BpmnDefinitions): string[] {
	const parent = new Map<string, string>()
	const host = new Map<string, string>()
	const ends = new Map<string, [string, string]>()
	const containers = new Set<string>()
	const walk = (elements: BpmnFlowElement[], owner: string): void => {
		for (const el of elements) {
			parent.set(el.id, owner)
			if (el.type === "boundaryEvent") host.set(el.id, el.attachedToRef)
			const scope = el as unknown as {
				flowElements?: BpmnFlowElement[]
				sequenceFlows?: Array<{ id: string; sourceRef: string; targetRef: string }>
			}
			for (const f of scope.sequenceFlows ?? []) ends.set(f.id, [f.sourceRef, f.targetRef])
			if (scope.flowElements) walk(scope.flowElements, el.id)
		}
	}
	const owner = new Map<string, string>()
	for (const c of defs.collaborations) {
		for (const p of c.participants) {
			containers.add(p.id)
			if (p.processRef) owner.set(p.processRef, p.id)
		}
		for (const m of c.messageFlows) ends.set(m.id, [m.sourceRef, m.targetRef])
		for (const a of c.associations) ends.set(a.id, [a.sourceRef, a.targetRef])
		for (const g of c.groups) containers.add(g.id)
	}
	for (const p of defs.processes) {
		walk(p.flowElements, owner.get(p.id) ?? p.id)
		for (const f of p.sequenceFlows) ends.set(f.id, [f.sourceRef, f.targetRef])
		for (const a of p.associations) ends.set(a.id, [a.sourceRef, a.targetRef])
		for (const g of p.groups) containers.add(g.id)
		const lanes = (set: typeof p.laneSet): void => {
			for (const lane of set?.lanes ?? []) {
				containers.add(lane.id)
				lanes(lane.childLaneSet)
			}
		}
		lanes(p.laneSet)
	}
	const related = (id: string): string[] => {
		const out = [id]
		for (const [event, h] of host) if (h === id) out.push(event)
		const h = host.get(id)
		if (h) out.push(h)
		for (let q = parent.get(id); q !== undefined; q = parent.get(q)) out.push(q)
		return out
	}

	const hits: string[] = []
	for (const diagram of defs.diagrams) {
		const shapes = diagram.plane.shapes.filter((s) => !containers.has(s.bpmnElement))
		for (const edge of diagram.plane.edges) {
			const pair = ends.get(edge.bpmnElement)
			if (!pair) continue
			const exempt = new Set([...related(pair[0]), ...related(pair[1])])
			const hit = shapes.find(
				(s) => !exempt.has(s.bpmnElement) && touchesInterior(edge.waypoints, s.bounds),
			)
			if (hit) hits.push(`${edge.bpmnElement} -> ${hit.bpmnElement}`)
			// Its own endpoints it may only dock on: shrunk by 3 (2 net of the
			// 1px growth in touchesInterior) so the docking point itself is outside.
			for (const own of shapes.filter(
				(s) => s.bpmnElement === pair[0] || s.bpmnElement === pair[1],
			)) {
				const b = own.bounds
				const core = { x: b.x + 3, y: b.y + 3, width: b.width - 6, height: b.height - 6 }
				if (touchesInterior(edge.waypoints, core))
					hits.push(`${edge.bpmnElement} -> own ${own.bpmnElement}`)
			}
		}
	}
	return hits
}

/**
 * Whether a polyline enters a box grown by one pixel — so running along an
 * outline counts — sampled per pixel, which is exact enough for DI coordinates.
 */
function touchesInterior(route: Waypoint[], b: Bounds): boolean {
	for (let i = 0; i + 1 < route.length; i++) {
		const p = route[i] as Waypoint
		const q = route[i + 1] as Waypoint
		const steps = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y)))
		for (let k = 0; k <= steps; k++) {
			const x = p.x + ((q.x - p.x) * k) / steps
			const y = p.y + ((q.y - p.y) * k) / steps
			if (x > b.x - 1 && x < b.x + b.width + 1 && y > b.y - 1 && y < b.y + b.height + 1) return true
		}
	}
	return false
}

describe("auto-layout over the round-trip corpus", () => {
	const dir = join(import.meta.dirname, "fixtures/roundtrip")
	const files = readdirSync(dir).filter((f) => f.endsWith(".bpmn"))

	it.each(files)("%s routes no connection through a shape", (file) => {
		const laid = applyAutoLayout(Bpmn.parse(readFileSync(join(dir, file), "utf8")))
		expect(routesThroughShapes(laid)).toEqual([])
	})
})
