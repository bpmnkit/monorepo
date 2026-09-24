#!/usr/bin/env node
/**
 * layout-quality — the metrics behind doc/bpmn-auto-layout-evaluation.md.
 *
 * Usage:
 *   pnpm --filter @bpmnkit/core build
 *   node packages/core/scripts/layout-quality.mjs --fixtures <dir> \
 *     [--upstream <path to bpmn-auto-layout/dist/index.js>] [--core <path to core dist/index.js>]
 *
 * The fixture set used in the evaluation is bpmn-io/bpmn-auto-layout's
 * `test/fixtures` at tag v2.0.0-alpha.2 (MIT); it is not vendored here.
 * `--upstream` runs that package on the same inputs for comparison.
 *
 * Every file is laid out from its XML (DI discarded) and measured on the result:
 * - through shapes: connections entering, or running along, a shape other than
 *   their endpoints, the scopes and pools holding them, or a boundary event's host
 * - through own end: connections cutting across their own source or target
 * - crossings: pairwise segment intersections between connections, touching
 *   endpoints included (converging flows count), per plane
 * - deviation: mean element-centre distance from the file's original DI
 *   (`compareLayouts`), absolute and with the two diagrams' origins aligned
 * - area, bends, length, runtime (XML in to XML out, median of 15 runs)
 */
import { readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { performance } from "node:perf_hooks"
import { fileURLToPath, pathToFileURL } from "node:url"

const args = process.argv.slice(2)
const arg = (name) => {
	const i = args.indexOf(name)
	return i === -1 ? undefined : args[i + 1]
}
const fixtures = arg("--fixtures")
if (!fixtures) {
	console.error(
		"usage: layout-quality.mjs --fixtures <dir> [--upstream <module>] [--core <module>]",
	)
	process.exit(1)
}
const corePath = resolve(
	arg("--core") ?? join(fileURLToPath(new URL(".", import.meta.url)), "../dist/index.js"),
)
const { Bpmn, compareLayouts, parseReferenceLayout } = await import(pathToFileURL(corePath).href)
const upstreamPath = arg("--upstream")
const upstream = upstreamPath ? await import(pathToFileURL(resolve(upstreamPath)).href) : null

const CONTAINERS = new Set(["participant", "lane", "group"])

function indexModel(defs) {
	const info = new Map()
	const connection = (kind, c) => info.set(c.id, { kind, source: c.sourceRef, target: c.targetRef })
	const walk = (elements, parent) => {
		for (const el of elements) {
			info.set(el.id, { type: el.type, parent, attachedTo: el.attachedToRef })
			for (const f of el.sequenceFlows ?? []) connection("sequence", f)
			for (const a of el.associations ?? []) connection("association", a)
			for (const t of el.textAnnotations ?? [])
				info.set(t.id, { type: "textAnnotation", parent: el.id })
			if (el.flowElements) walk(el.flowElements, el.id)
		}
	}
	const owner = new Map()
	for (const c of defs.collaborations) {
		for (const p of c.participants) {
			info.set(p.id, { type: "participant" })
			if (p.processRef) owner.set(p.processRef, p.id)
		}
		for (const m of c.messageFlows) connection("message", m)
		for (const a of c.associations) connection("association", a)
		for (const t of c.textAnnotations) info.set(t.id, { type: "textAnnotation" })
		for (const g of c.groups ?? []) info.set(g.id, { type: "group" })
	}
	for (const p of defs.processes) {
		walk(p.flowElements, owner.get(p.id))
		for (const f of p.sequenceFlows) connection("sequence", f)
		for (const a of p.associations) connection("association", a)
		for (const t of p.textAnnotations)
			info.set(t.id, { type: "textAnnotation", parent: owner.get(p.id) })
		for (const g of p.groups ?? []) info.set(g.id, { type: "group" })
		const lanes = (set) => {
			for (const lane of set?.lanes ?? []) {
				info.set(lane.id, { type: "lane" })
				lanes(lane.childLaneSet)
			}
		}
		lanes(p.laneSet)
	}
	return info
}

function related(info, id) {
	const out = new Set([id])
	for (let p = info.get(id)?.parent; p; p = info.get(p)?.parent) out.add(p)
	const host = info.get(id)?.attachedTo
	if (host) out.add(host)
	for (const [k, v] of info) if (v.attachedTo === id) out.add(k)
	return out
}

/** Liang–Barsky against the box grown (negative) or shrunk (positive) by `inset`. */
function segmentHits(a, b, r, inset) {
	const x1 = r.x + inset
	const y1 = r.y + inset
	const x2 = r.x + r.width - inset
	const y2 = r.y + r.height - inset
	if (x2 <= x1 || y2 <= y1) return false
	let t0 = 0
	let t1 = 1
	const p = [a.x - b.x, b.x - a.x, a.y - b.y, b.y - a.y]
	const q = [a.x - x1, x2 - a.x, a.y - y1, y2 - a.y]
	for (let i = 0; i < 4; i++) {
		if (p[i] === 0) {
			if (q[i] <= 0) return false
			continue
		}
		const t = q[i] / p[i]
		if (p[i] < 0) {
			if (t > t1) return false
			if (t > t0) t0 = t
		} else {
			if (t < t0) return false
			if (t < t1) t1 = t
		}
	}
	return t1 - t0 > 1e-9
}

/** Segment intersection with the end points included. */
function segmentsCross(a, b, c, d) {
	const d1x = b.x - a.x
	const d1y = b.y - a.y
	const d2x = d.x - c.x
	const d2y = d.y - c.y
	const den = d1x * d2y - d1y * d2x
	if (Math.abs(den) < 1e-9) return false
	const t = ((c.x - a.x) * d2y - (c.y - a.y) * d2x) / den
	const u = ((c.x - a.x) * d1y - (c.y - a.y) * d1x) / den
	const e1 = 0.01 / Math.hypot(d1x, d1y)
	const e2 = 0.01 / Math.hypot(d2x, d2y)
	return t >= -e1 && t <= 1 + e1 && u >= -e2 && u <= 1 + e2
}

function measure(defs) {
	const info = indexModel(defs)
	const m = { through: 0, ownEnd: 0, crossings: 0, bends: 0, length: 0, area: 0 }
	for (const diagram of defs.diagrams) {
		const shapes = diagram.plane.shapes
		const byId = new Map(shapes.map((s) => [s.bpmnElement, s]))
		const obstacles = shapes.filter((s) => {
			const type = info.get(s.bpmnElement)?.type
			return type !== undefined && !CONTAINERS.has(type)
		})
		const edges = []
		let minX = Number.POSITIVE_INFINITY
		let minY = Number.POSITIVE_INFINITY
		let maxX = Number.NEGATIVE_INFINITY
		let maxY = Number.NEGATIVE_INFINITY
		const grow = (x, y) => {
			minX = Math.min(minX, x)
			minY = Math.min(minY, y)
			maxX = Math.max(maxX, x)
			maxY = Math.max(maxY, y)
		}
		for (const s of shapes) {
			grow(s.bounds.x, s.bounds.y)
			grow(s.bounds.x + s.bounds.width, s.bounds.y + s.bounds.height)
		}
		for (const e of diagram.plane.edges) {
			const c = info.get(e.bpmnElement)
			if (!c?.kind || e.waypoints.length < 2) continue
			edges.push({ ...c, wps: e.waypoints })
			for (const w of e.waypoints) grow(w.x, w.y)
		}
		if (Number.isFinite(minX)) m.area += (maxX - minX) * (maxY - minY)

		for (const e of edges) {
			m.bends += e.wps.length - 2
			const segments = e.wps.slice(1).map((w, i) => [e.wps[i], w])
			for (const [a, b] of segments) m.length += Math.hypot(b.x - a.x, b.y - a.y)
			const exempt = new Set([...related(info, e.source), ...related(info, e.target)])
			if (
				obstacles.some(
					(s) =>
						!exempt.has(s.bpmnElement) &&
						segments.some(([a, b]) => segmentHits(a, b, s.bounds, -1)),
				)
			) {
				m.through++
			}
			const ends = [e.source, e.target]
				.map((id) => byId.get(id))
				.filter((s) => s && !CONTAINERS.has(info.get(s.bpmnElement)?.type))
			if (ends.some((s) => segments.some(([a, b]) => segmentHits(a, b, s.bounds, 3)))) m.ownEnd++
		}
		for (let i = 0; i < edges.length; i++) {
			for (let j = i + 1; j < edges.length; j++) {
				const A = edges[i].wps
				const B = edges[j].wps
				for (let a = 1; a < A.length; a++) {
					for (let b = 1; b < B.length; b++) {
						if (segmentsCross(A[a - 1], A[a], B[b - 1], B[b])) m.crossings++
					}
				}
			}
		}
	}
	return m
}

function deviation(original, laid, aligned) {
	const ref = parseReferenceLayout(original)
	let auto = parseReferenceLayout(laid)
	if (ref.length === 0) return null
	if (aligned && auto.length > 0) {
		const dx = Math.min(...ref.map((p) => p.x)) - Math.min(...auto.map((p) => p.x))
		const dy = Math.min(...ref.map((p) => p.y)) - Math.min(...auto.map((p) => p.y))
		auto = auto.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy, cx: p.cx + dx, cy: p.cy + dy }))
	}
	return compareLayouts(original, ref, auto).avgDistance
}

async function timed(run, xml, runs) {
	const times = []
	let out = ""
	for (let i = 0; i < runs; i++) {
		const start = performance.now()
		out = await run(xml)
		times.push(performance.now() - start)
	}
	times.sort((a, b) => a - b)
	return { out, ms: times[Math.floor(times.length / 2)] }
}

const engines = [{ name: "bpmnkit", run: (xml) => Bpmn.autoLayout(xml), runs: 15 }]
if (upstream) {
	engines.push({
		name: "bpmn-auto-layout",
		run: async (xml) => (await upstream.layoutProcess(xml)).xml,
		runs: 3,
	})
}

const files = readdirSync(fixtures)
	.filter((f) => f.endsWith(".bpmn"))
	.sort()
const xmls = files.map((f) => readFileSync(join(fixtures, f), "utf8"))

const rows = []
for (const engine of engines) {
	for (const xml of xmls.slice(0, 10)) await engine.run(xml)
	const total = { through: 0, ownEnd: 0, crossings: 0, bends: 0, length: 0, area: 0 }
	const devs = []
	const aligned = []
	const times = []
	let failures = 0
	for (const xml of xmls) {
		const original = Bpmn.parse(xml)
		let result
		try {
			result = await timed(engine.run, xml, engine.runs)
		} catch {
			failures++
			continue
		}
		times.push(result.ms)
		const laid = Bpmn.parse(result.out)
		const m = measure(laid)
		for (const k of Object.keys(total)) total[k] += m[k]
		const dev = deviation(original, laid, false)
		if (dev !== null) {
			devs.push(dev)
			aligned.push(deviation(original, laid, true))
		}
	}
	times.sort((a, b) => a - b)
	const pct = (p) => times[Math.max(0, Math.ceil((p / 100) * times.length) - 1)] ?? 0
	const mean = (list) => list.reduce((s, x) => s + x, 0) / Math.max(1, list.length)
	rows.push({
		engine: engine.name,
		files: times.length,
		failures,
		"through shapes": total.through,
		"through own end": total.ownEnd,
		crossings: total.crossings,
		"deviation px": mean(devs).toFixed(1),
		"deviation, origins aligned": mean(aligned).toFixed(1),
		"area Mpx": (total.area / 1e6).toFixed(1),
		bends: total.bends,
		"length kpx": Math.round(total.length / 1000),
		"median ms": pct(50).toFixed(2),
		"p90 ms": pct(90).toFixed(2),
		"max ms": (times[times.length - 1] ?? 0).toFixed(1),
	})
}
console.table(rows)
