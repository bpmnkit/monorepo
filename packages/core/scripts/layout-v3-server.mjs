#!/usr/bin/env node
/**
 * v3 layout pipeline visualizer.
 *
 * Shows the v3 layout engine step by step.  Step 1 highlights atomic segments
 * (linear runs of non-junction nodes between gateways / start / end events).
 * Each segment is colored distinctly; click a segment in the right panel to
 * highlight it on the graph.
 *
 * Usage:
 *   node packages/core/scripts/layout-v3-server.mjs <file.bpmn>
 */
import { createServer } from "node:http"
import { readFileSync, watch } from "node:fs"
import { resolve } from "node:path"
import { Bpmn } from "../dist/index.js"
import { ELEMENT_SIZES } from "../dist/layout/types.js"
import {
	detectBackEdges,
	findAtomicSegments,
	computeTopoDepths,
} from "../dist/layout/v3/segments.js"
import { findSegmentGroups } from "../dist/layout/v3/groups.js"
import { layoutGroup } from "../dist/layout/v3/layout-group.js"
import { findProcessFlow } from "../dist/layout/v3/process-flow.js"
import { layoutProcess } from "../dist/layout/v3/layout-process.js"
import { assembleFullLayout } from "../dist/layout/v3/layout-full.js"
import { findAllPaths } from "../dist/layout/v3/paths.js"
import { layoutWithTracks, TRACK_HEIGHT } from "../dist/layout/v3/layout-tracks.js"
import { layoutWithColumns, COLUMN_WIDTH } from "../dist/layout/v3/layout-columns.js"
import { layoutWithPaths } from "../dist/layout/v3/layout-paths.js"
import { layoutWithAnnotations } from "../dist/layout/v3/layout-annotations.js"

const [, , inputArg] = process.argv
if (!inputArg) {
	console.error("Usage: node layout-v3-server.mjs <file.bpmn>")
	process.exit(1)
}
const inputPath = resolve(process.cwd(), inputArg)

// ── Helpers ────────────────────────────────────────────────────────────────────

function nodeSize(type) {
	return ELEMENT_SIZES[type] ?? { width: 100, height: 80 }
}

function buildFwdAdj(sequenceFlows, backEdgeIds) {
	const outAdj = new Map()
	const inAdj = new Map()
	for (const f of sequenceFlows) {
		if (backEdgeIds.has(f.id)) continue
		outAdj.set(f.sourceRef, [...(outAdj.get(f.sourceRef) ?? []), f.targetRef])
		inAdj.set(f.targetRef, [...(inAdj.get(f.targetRef) ?? []), f.sourceRef])
	}
	return { outAdj, inAdj }
}

// ── Pipeline ───────────────────────────────────────────────────────────────────

function getData() {
	try {
		const xml = readFileSync(inputPath, "utf8")
		const defs = Bpmn.parse(xml)
		const proc = defs.processes[0]
		if (!proc) return { error: "No process found" }

		const flowNodes = proc.flowElements
		const sequenceFlows = proc.sequenceFlows
		const steps = []

		const snap = (backEdgeIds, segments, topoDepths, segmentOf) => {
			const nodes = flowNodes.map((n) => {
				const sz = nodeSize(n.type)
				return {
					id: n.id,
					type: n.type,
					label: n.name ?? null,
					width: sz.width,
					height: sz.height,
					topoDepth: topoDepths?.get(n.id) ?? 0,
					segmentId: segmentOf?.get(n.id) ?? null,
				}
			})
			const edges = sequenceFlows.map((f) => ({
				id: f.id,
				sourceId: f.sourceRef,
				targetId: f.targetRef,
				isBackEdge: backEdgeIds ? backEdgeIds.has(f.id) : false,
				label: f.name ?? null,
			}))
			return { nodes, edges, segments: segments ?? null }
		}

		// ── Step 0: BPMN Parsed ──────────────────────────────────────────────
		// Compute basic topo depths for display ordering
		const { outAdj: outRaw, inAdj: inRaw } = buildFwdAdj(sequenceFlows, new Set())
		const rawDepths = computeTopoDepths(flowNodes, outRaw, inRaw)

		steps.push({
			name: "BPMN Parsed",
			desc: `${flowNodes.length} flow elements and ${sequenceFlows.length} sequence flows parsed from XML. No layout computed yet.`,
			...snap(null, null, rawDepths, null),
		})

		// ── Step 1: Back-edges Detected ──────────────────────────────────────
		const backEdgeIds = detectBackEdges(flowNodes, sequenceFlows)
		const { outAdj, inAdj } = buildFwdAdj(sequenceFlows, backEdgeIds)
		const topoDepths = computeTopoDepths(flowNodes, outAdj, inAdj)

		steps.push({
			name: "Back-edges Detected",
			desc: `${backEdgeIds.size} back-edge(s) found (shown in orange). These loop-creating edges are excluded from the forward graph before segment detection.`,
			...snap(backEdgeIds, null, topoDepths, null),
		})

		// ── Step 2: Atomic Segments Found ────────────────────────────────────
		const segments = findAtomicSegments(flowNodes, sequenceFlows, backEdgeIds)

		const segmentOf = new Map()
		for (const seg of segments) {
			for (const id of seg.nodeIds) segmentOf.set(id, seg.id)
		}

		// Annotate segments with a human-readable label for the panel
		const annotated = segments.map((seg) => {
			const labels = seg.nodeIds
				.map((id) => flowNodes.find((n) => n.id === id)?.name ?? null)
				.filter(Boolean)
			return {
				...seg,
				label: labels.length > 0 ? labels.join(" → ") : `(${seg.nodeIds.length} nodes)`,
			}
		})

		const isJunction = (id) =>
			(inAdj.get(id)?.length ?? 0) !== 1 || (outAdj.get(id)?.length ?? 0) !== 1
		const junctionCount = flowNodes.filter((n) => isJunction(n.id)).length

		steps.push({
			name: "Atomic Segments Found",
			desc: `${segments.length} atomic segment(s) found between ${junctionCount} junction nodes (gateways, start/end events). Each segment can be sized and laid out independently. Select a segment in the right panel to highlight it.`,
			...snap(backEdgeIds, annotated, topoDepths, segmentOf),
		})

		// ── Step 3: Segment Groups ────────────────────────────────────────────
		const groups = findSegmentGroups(segments, flowNodes, sequenceFlows, backEdgeIds)

		// Annotate groups with display labels
		const groupsAnnotated = groups.map((g) => {
			if (g.kind === "gateway-pair") {
				const splitLabel = flowNodes.find((n) => n.id === g.splitId)?.name ?? g.splitId ?? "?"
				const joinLabel = flowNodes.find((n) => n.id === g.joinId)?.name ?? g.joinId ?? "?"
				return {
					...g,
					label: `${splitLabel} → ${joinLabel}`,
					splitLabel,
					joinLabel,
				}
			} else {
				const hostLabel = flowNodes.find((n) => n.id === g.hostNodeId)?.name ?? g.hostNodeId ?? ""
				const eventLabel = flowNodes.find((n) => n.id === g.eventNodeId)?.name ?? g.eventNodeId ?? "event"
				return {
					...g,
					label: hostLabel ? `${hostLabel} [${eventLabel}]` : `${eventLabel}`,
					hostLabel,
					eventLabel,
				}
			}
		})

		const topLevelGroupIds = new Set(groups.map((g) => g.id))
		for (const g of groups) {
			for (const cId of g.childGroupIds) topLevelGroupIds.delete(cId)
		}

		steps.push({
			name: "Segment Groups",
			desc: `${groups.length} group(s) built: ${groups.filter((g) => g.kind === "gateway-pair").length} gateway-pair, ${groups.filter((g) => g.kind === "event-attachment").length} event-attachment. Select a group in the right panel to highlight it and its children.`,
			...snap(backEdgeIds, annotated, topoDepths, segmentOf),
			groups: groupsAnnotated,
			topLevelGroupIds: [...topLevelGroupIds],
		})

		// ── Step 4: Group Layouts ──────────────────────────────────────────────────
		const groupLayouts = {}
		for (const g of groups) {
			groupLayouts[g.id] = layoutGroup(g, segments, flowNodes, sequenceFlows)
		}

		steps.push({
			name: "Group Layouts",
			desc: `Relative coordinates computed for all ${groups.length} group(s). Click a group in the right panel to preview its standalone layout.`,
			...snap(backEdgeIds, annotated, topoDepths, segmentOf),
			groups: groupsAnnotated,
			topLevelGroupIds: [...topLevelGroupIds],
			groupLayouts,
		})

		// ── Step 5: Process Flow ───────────────────────────────────────────────────
		const processFlow = findProcessFlow(segments, groups, topoDepths)

		const processFlowAnnotated = processFlow.elements.map((el) => {
			if (el.kind === "segment") {
				const seg = annotated.find((s) => s.id === el.id)
				return { ...el, label: seg?.label ?? el.id, segmentData: seg ?? null }
			}
			const g = groupsAnnotated.find((g) => g.id === el.id)
			return { ...el, label: g?.label ?? el.id, groupData: g ?? null }
		})

		const nConn = processFlow.elements.filter((e) => e.kind === "segment").length
		const nGrp  = processFlow.elements.filter((e) => e.kind === "group").length

		steps.push({
			name: "Process Flow",
			desc: `${processFlow.elements.length} top-level element(s): ${nConn} connector segment(s) and ${nGrp} top-level group(s). Select an element in the right panel to highlight it.`,
			...snap(backEdgeIds, annotated, topoDepths, segmentOf),
			groups: groupsAnnotated,
			topLevelGroupIds: [...topLevelGroupIds],
			groupLayouts,
			processFlow: processFlowAnnotated,
		})

		// ── Step 6: Process Layout ─────────────────────────────────────────────────
		const glMap = new Map(Object.entries(groupLayouts))
		const processLayout = layoutProcess(processFlow, glMap, segments)
		const fullLayout = assembleFullLayout(processLayout, glMap, segments, flowNodes, groups, sequenceFlows, backEdgeIds)

		steps.push({
			name: "Process Layout",
			desc: `Full process: ${Math.round(processLayout.width)}×${Math.round(processLayout.height)}px across ${processFlow.elements.length} element(s). Click an element to preview its standalone layout.`,
			...snap(backEdgeIds, annotated, topoDepths, segmentOf),
			groups: groupsAnnotated,
			topLevelGroupIds: [...topLevelGroupIds],
			groupLayouts,
			processFlow: processFlowAnnotated,
			processLayout,
			fullLayout,
		})

		// ── Step 7: Full Layout ────────────────────────────────────────────────────
		const paths = findAllPaths(flowNodes, sequenceFlows, backEdgeIds)

		// Annotate paths with start/end node labels for the panel
		const pathsAnnotated = paths.map((p, i) => {
			const startLabel = flowNodes.find((n) => n.id === p.nodeIds[0])?.name ?? p.nodeIds[0] ?? "?"
			const endLabel = flowNodes.find((n) => n.id === p.nodeIds[p.nodeIds.length - 1])?.name ?? p.nodeIds[p.nodeIds.length - 1] ?? "?"
			return { ...p, index: i, startLabel, endLabel }
		})

		steps.push({
			name: "Full Layout",
			desc: `${fullLayout.nodes.length} node(s) placed at absolute coordinates. ${paths.length} path(s) enumerated${paths.length >= 50 ? " (capped at 50)" : ""}. Select a path in the right panel to highlight it.`,
			...snap(backEdgeIds, annotated, topoDepths, segmentOf),
			groups: groupsAnnotated,
			topLevelGroupIds: [...topLevelGroupIds],
			groupLayouts,
			processFlow: processFlowAnnotated,
			processLayout,
			fullLayout,
			paths: pathsAnnotated,
		})

		// ── Step 8: Track Layout ───────────────────────────────────────────────────
		const trackLayout = layoutWithTracks(fullLayout, groups, segments, flowNodes, sequenceFlows, backEdgeIds)

		steps.push({
			name: "Track Layout",
			desc: `${trackLayout.nodes.length} node(s) positioned across ${trackLayout.trackBands.length} track(s). Tracks assign vertical rows to parallel branches — most-element branch shares the gateway's track, others alternate above/below.`,
			...snap(backEdgeIds, annotated, topoDepths, segmentOf),
			groups: groupsAnnotated,
			topLevelGroupIds: [...topLevelGroupIds],
			groupLayouts,
			processFlow: processFlowAnnotated,
			processLayout,
			fullLayout,
			trackLayout,
		})

		// ── Step 9: Column Layout ──────────────────────────────────────────────────────
		const columnLayout = layoutWithColumns(trackLayout, flowNodes, sequenceFlows, backEdgeIds)

		steps.push({
			name: "Column Layout",
			desc: `${columnLayout.nodes.length} node(s) snapped to ${columnLayout.columnBands.length} column(s) of ${COLUMN_WIDTH}px each. Larger elements span multiple columns; direct paths between nodes are kept clear.`,
			...snap(backEdgeIds, annotated, topoDepths, segmentOf),
			groups: groupsAnnotated,
			topLevelGroupIds: [...topLevelGroupIds],
			groupLayouts,
			processFlow: processFlowAnnotated,
			processLayout,
			fullLayout,
			trackLayout,
			columnLayout,
		})

		// ── Step 10: Path Layout ──────────────────────────────────────────────────────
		const pathLayout = layoutWithPaths(columnLayout, trackLayout, flowNodes, sequenceFlows, backEdgeIds)

		steps.push({
			name: "Path Layout",
			desc: `${pathLayout.edges.length} edge(s) routed: ${pathLayout.edges.filter((e) => e.kind === "straight").length} straight, ${pathLayout.edges.filter((e) => e.kind === "L").length} L-path, ${pathLayout.edges.filter((e) => e.kind === "Z").length} Z-path, ${pathLayout.edges.filter((e) => e.kind === "U").length} U-path.`,
			...snap(backEdgeIds, annotated, topoDepths, segmentOf),
			groups: groupsAnnotated,
			topLevelGroupIds: [...topLevelGroupIds],
			groupLayouts,
			processFlow: processFlowAnnotated,
			processLayout,
			fullLayout,
			trackLayout,
			columnLayout,
			pathLayout,
		})

		// ── Step 11: Annotation Layout ────────────────────────────────────────────────
		const textAnnotations = proc.textAnnotations ?? []
		const associations = proc.associations ?? []
		const annotationLayout = layoutWithAnnotations(pathLayout, textAnnotations, associations)

		steps.push({
			name: "Annotation Layout",
			desc: `${annotationLayout.annotationNodes.length} annotation(s) placed out of ${textAnnotations.length} total.`,
			...snap(backEdgeIds, annotated, topoDepths, segmentOf),
			groups: groupsAnnotated,
			topLevelGroupIds: [...topLevelGroupIds],
			groupLayouts,
			processFlow: processFlowAnnotated,
			processLayout,
			fullLayout,
			trackLayout,
			columnLayout,
			pathLayout,
			annotationLayout,
		})

		return { steps, filename: inputArg }
	} catch (err) {
		return { error: String(err?.message ?? err) }
	}
}

// ── SSE ────────────────────────────────────────────────────────────────────────

const clients = new Set()
function broadcast() {
	for (const res of clients) res.write("data: update\n\n")
}

let debounce = null
watch(inputPath, () => {
	clearTimeout(debounce)
	debounce = setTimeout(() => {
		console.log("[watch] reloading…")
		broadcast()
	}, 150)
})

// ── CSS ────────────────────────────────────────────────────────────────────────

const CSS = /* css */ `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }
body { font-family: monospace; font-size: 12px; background: #0a0a12; color: #bbb; display: flex; flex-direction: column; }

#header { flex: 0 0 auto; padding: 8px 14px; background: #0f0f1a; border-bottom: 1px solid #1e1e30; font-size: 11px; color: #555; display: flex; gap: 16px; align-items: center; }
#header .title { color: #8888a8; }
#header.stale .title { color: #7f1d1d; }

#body { flex: 1 1 0; display: flex; overflow: hidden; }

/* ── step list ───────────────────────────────────────────────────────────── */
#steps { flex: 0 0 200px; overflow-y: auto; border-right: 1px solid #1e1e30; padding: 8px 0; }
.step { padding: 7px 12px; cursor: pointer; border-left: 3px solid transparent; line-height: 1.3; }
.step:hover { background: #131320; }
.step.active { border-left-color: #6b9df7; background: #0f1525; color: #cdd6f4; }
.step-num { color: #555; font-size: 10px; margin-right: 4px; }
.step-name { font-size: 11px; }

/* ── main ────────────────────────────────────────────────────────────────── */
#main { flex: 1 1 0; display: flex; flex-direction: column; overflow: hidden; }
#desc { flex: 0 0 auto; padding: 6px 14px; background: #0d0d1a; border-bottom: 1px solid #1a1a28; font-size: 11px; color: #6666a0; min-height: 32px; display: flex; align-items: center; gap: 12px; }
#desc-text { flex: 1; line-height: 1.4; }
#view-toggle { display: none; flex: 0 0 auto; padding: 3px 10px; font-size: 10px; font-family: monospace; background: #0f0f1a; border: 1px solid #2a2a42; border-radius: 4px; color: #6666a0; cursor: pointer; white-space: nowrap; }
#view-toggle:hover { border-color: #6b9df7; color: #6b9df7; }
#view-toggle.active { border-color: #6b9df7; color: #6b9df7; background: #0a1525; }
#canvas { flex: 1 1 0; overflow: hidden; position: relative; cursor: grab; user-select: none; }
#canvas:active { cursor: grabbing; }
#canvas svg { position: absolute; top: 0; left: 0; }

/* ── segment panel ───────────────────────────────────────────────────────── */
#seg-panel { flex: 0 0 290px; border-left: 1px solid #1e1e30; overflow-y: auto; display: flex; flex-direction: column; }
#seg-panel-header { padding: 8px 12px; background: #0d0d1a; border-bottom: 1px solid #1a1a28; font-size: 11px; color: #555; flex: 0 0 auto; }
#seg-list { flex: 1 1 0; overflow-y: auto; padding: 4px 0; }
.seg-item { padding: 6px 12px; cursor: pointer; border-left: 3px solid transparent; line-height: 1.4; }
.seg-item:hover { background: #131320; }
.seg-item.active { background: #0e1520; }
.seg-title { font-size: 11px; display: flex; align-items: center; gap: 6px; }
.seg-dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
.seg-meta { font-size: 10px; color: #444; margin-top: 2px; padding-left: 16px; }
.seg-nodes { font-size: 10px; color: #3a3a5a; margin-top: 2px; padding-left: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── group tree ──────────────────────────────────────────────────────────── */
.grp-node { padding: 0; }
.grp-header { padding: 6px 10px 6px 12px; cursor: pointer; border-left: 3px solid transparent; display: flex; align-items: flex-start; gap: 6px; }
.grp-header:hover { background: #131320; }
.grp-header.active { background: #0e1520; border-left-color: #eab308; }
.grp-badge { font-size: 9px; padding: 1px 4px; border-radius: 3px; flex: 0 0 auto; margin-top: 2px; font-weight: 700; }
.grp-badge.gw { background: #2a2000; color: #eab308; }
.grp-badge.ev { background: #150a2a; color: #a78bfa; }
.grp-label { font-size: 11px; color: #8888a8; flex: 1; line-height: 1.4; }
.grp-children { padding-left: 16px; border-left: 1px solid #1e1e30; margin-left: 14px; }
.grp-seg-item { padding: 4px 10px 4px 12px; cursor: pointer; border-left: 3px solid transparent; display: flex; align-items: center; gap: 6px; }
.grp-seg-item:hover { background: #131320; }
.grp-seg-item.active { background: #0e1520; }
.grp-seg-dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
.grp-seg-id { font-size: 10px; color: #3a3a5a; }
.grp-seg-label { font-size: 10px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 185px; }

/* ── process panel ───────────────────────────────────────────────────────── */
.proc-item { padding: 6px 10px 6px 12px; cursor: pointer; border-left: 3px solid transparent; display: flex; align-items: flex-start; gap: 6px; }
.proc-item:hover { background: #131320; }
.proc-item.active { background: #0e1520; }
.proc-badge { font-size: 9px; padding: 1px 4px; border-radius: 3px; flex: 0 0 auto; margin-top: 2px; font-weight: 700; }
.proc-badge.cs { background: #0a1525; color: #60a5fa; }
.proc-badge.gw { background: #2a2000; color: #eab308; }
.proc-badge.ev { background: #150a2a; color: #a78bfa; }
.proc-badge.path { background: #001a1a; color: #22d3ee; }
.path-loop-badge { font-size: 9px; color: #f97316; margin-left: 5px; }
.proc-label { font-size: 11px; color: #8888a8; flex: 1; line-height: 1.4; }
.proc-meta { font-size: 10px; color: #3a3a5a; padding-top: 2px; }

.error { color: #f87171; padding: 20px; }
`

// ── Client JS ─────────────────────────────────────────────────────────────────

const CLIENT_JS = /* js */ `
// ── Constants ─────────────────────────────────────────────────────────────────
const STEP_X = 180   // horizontal spacing per topo-depth unit
const LANE_H = 140   // vertical spacing per lane
const PAD   = 60     // canvas padding

// Segment color palette
const PALETTE = [
  '#6b9df7','#2dd4bf','#a78bfa','#fb923c','#f472b6',
  '#4ade80','#facc15','#60a5fa','#f87171','#34d399',
  '#818cf8','#fb7185','#38bdf8','#a3e635','#fbbf24',
]
function segColor(idx) { return PALETTE[idx % PALETTE.length] }

// ── Helpers ───────────────────────────────────────────────────────────────────
function isEvent(t) { return t && t.includes('Event') }
function isGateway(t) { return t && (t.includes('Gateway') || t === 'complexGateway') }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

// ── Virtual layout (no real coordinates) ─────────────────────────────────────
//
// x = topoDepth * STEP_X + PAD
// y = assigned lane * LANE_H + PAD
//
// Lane assignment:
//   1. Process junctions in topological order.
//   2. For each junction, assign its outgoing segments to consecutive lanes.
//   3. The first outgoing segment inherits the junction's lane.
//   4. Junction y = mean of its adjacent segments' lanes.

function computeLayout(data) {
  const { nodes, edges, segments } = data
  if (!nodes) return { nodePos: new Map(), junctionLane: new Map() }

  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const outFwd = new Map()
  const inFwd  = new Map()
  for (const e of (edges ?? [])) {
    if (e.isBackEdge) continue
    outFwd.set(e.sourceId, [...(outFwd.get(e.sourceId) ?? []), e.targetId])
    inFwd.set(e.targetId, [...(inFwd.get(e.targetId) ?? []), e.sourceId])
  }

  const isJunction = id => {
    const o = outFwd.get(id)?.length ?? 0
    const i = inFwd.get(id)?.length  ?? 0
    return i !== 1 || o !== 1
  }

  // Segment metadata
  const segOf    = new Map()  // nodeId → segment index
  const segFroms = new Map()  // fromId → segment index[]
  if (segments) {
    segments.forEach((seg, si) => {
      for (const id of seg.nodeIds) segOf.set(id, si)
      if (seg.fromId) {
        const arr = segFroms.get(seg.fromId) ?? []
        arr.push(si)
        segFroms.set(seg.fromId, arr)
      }
    })
  }

  // Assign lanes to segments
  const segLane = new Map()  // segIdx → lane
  let nextLane = 0

  // Sort junctions by topoDepth
  const junctions = nodes
    .filter(n => isJunction(n.id))
    .sort((a, b) => a.topoDepth - b.topoDepth)

  for (const jn of junctions) {
    const outSegs = segFroms.get(jn.id) ?? []
    if (outSegs.length === 0) continue

    // Find the lane of the segment feeding INTO this junction (continuation lane)
    let jLane = null
    for (const e of (edges ?? [])) {
      if (e.targetId !== jn.id || e.isBackEdge) continue
      const si = segOf.get(e.sourceId)
      if (si !== undefined && segLane.has(si)) { jLane = segLane.get(si); break }
    }

    // Assign lanes to outgoing segments
    let startLane = jLane ?? nextLane
    for (let i = 0; i < outSegs.length; i++) {
      const si = outSegs[i]
      if (!segLane.has(si)) {
        segLane.set(si, i === 0 ? startLane : nextLane++)
        if (i === 0 && startLane === nextLane - 1) {} // startLane already allocated above
        else if (i === 0) nextLane = Math.max(nextLane, startLane + 1)
      }
    }
  }

  // Assign segment nodes to their lane (use midpoint for multi-node segments)
  const nodeLane = new Map()
  if (segments) {
    segments.forEach((seg, si) => {
      const lane = segLane.has(si) ? segLane.get(si) : (nextLane++)
      for (const id of seg.nodeIds) nodeLane.set(id, lane)
    })
  }

  // Junction lanes = mean of adjacent segment lanes (or 0 if isolated)
  const junctionLane = new Map()
  for (const jn of nodes) {
    if (!isJunction(jn.id)) continue
    const lanes = []
    for (const e of (edges ?? [])) {
      if (e.isBackEdge) continue
      if (e.sourceId === jn.id || e.targetId === jn.id) {
        const otherId = e.sourceId === jn.id ? e.targetId : e.sourceId
        const l = nodeLane.get(otherId)
        if (l !== undefined) lanes.push(l)
      }
    }
    junctionLane.set(jn.id, lanes.length > 0 ? lanes.reduce((a,b)=>a+b,0)/lanes.length : 0)
  }

  // Final positions
  const nodePos = new Map()
  for (const n of nodes) {
    const lane = nodeLane.has(n.id) ? nodeLane.get(n.id) : (junctionLane.get(n.id) ?? 0)
    nodePos.set(n.id, {
      x: n.topoDepth * STEP_X + PAD - n.width / 2,
      y: lane * LANE_H + PAD - n.height / 2,
    })
  }

  return { nodePos, junctionLane, segLane, segOf, nodeLane }
}

// ── SVG rendering ─────────────────────────────────────────────────────────────

function nodeStroke(n, activeSegId, segOf) {
  if (activeSegId && segOf) {
    const si = segOf.get(n.id)
    if (si === undefined) return '#1e1e30'  // junction: dim
    const segIdx = typeof si === 'number' ? si : 0
    return activeSegId === si ? segColor(segIdx) : '#1a1a28'
  }
  if (isEvent(n.type)) return n.type.startsWith('start') ? '#22c55e' : '#ef4444'
  if (isGateway(n.type)) return '#eab308'
  return '#3a3a5a'
}
function nodeFill(n, activeSegId, segOf, segments) {
  if (activeSegId !== null && segOf) {
    const si = segOf.get(n.id)
    if (si === undefined) return '#0d0d18'  // junction when something else active
    const seg = segments?.[si]
    const col = segColor(si)
    return si === activeSegId ? col + '22' : '#0d0d18'
  }
  if (n.segmentId === null) return '#0d0d18'  // junction node
  const si = segments?.findIndex(s => s.id === n.segmentId) ?? -1
  return si >= 0 ? segColor(si) + '18' : '#111120'
}

function svgNode(n, pos, activeSegId, segOf, segments, dimmed) {
  const { x, y } = pos
  const w = n.width, h = n.height
  const cx = x + w/2, cy = y + h/2
  const stroke = nodeStroke(n, activeSegId, segOf)
  const fill   = nodeFill(n, activeSegId, segOf, segments)
  const opacity = dimmed ? 0.15
    : (activeSegId !== null && segOf && segOf.get(n.id) !== activeSegId && segOf.get(n.id) !== undefined) ? 0.3 : 1

  let shape
  if (isEvent(n.type)) {
    const r = Math.min(w,h)/2
    shape = \`<circle cx="\${cx}" cy="\${cy}" r="\${r}" fill="\${fill}" stroke="\${stroke}" stroke-width="1.5" opacity="\${opacity}"/>\`
  } else if (isGateway(n.type)) {
    shape = \`<polygon points="\${cx},\${y} \${x+w},\${cy} \${cx},\${y+h} \${x},\${cy}" fill="\${fill}" stroke="\${stroke}" stroke-width="1.5" opacity="\${opacity}"/>\`
  } else {
    shape = \`<rect x="\${x}" y="\${y}" width="\${w}" height="\${h}" rx="4" fill="\${fill}" stroke="\${stroke}" stroke-width="1" opacity="\${opacity}"/>\`
  }

  let label = ''
  if (n.label) {
    const maxChars = Math.max(10, Math.floor(w / 7))
    const words = n.label.split(' ')
    const lines = []
    let line = ''
    for (const wd of words) {
      if (line && (line+' '+wd).length > maxChars) { lines.push(line); line = wd }
      else line = line ? line+' '+wd : wd
    }
    if (line) lines.push(line)
    const small = isEvent(n.type) || isGateway(n.type)
    const baseY = small ? y + h + 14 : cy - (lines.length-1)*7
    label = lines.map((l,i) =>
      \`<text x="\${cx}" y="\${baseY+i*14}" text-anchor="middle" font-size="10" fill="#666" font-family="monospace" opacity="\${opacity}" pointer-events="none">\${esc(l)}</text>\`
    ).join('')
  }
  return shape + label
}

function svgEdge(e, nodeMap, nodePos) {
  const src = nodePos.get(e.sourceId)
  const tgt = nodePos.get(e.targetId)
  const sn  = nodeMap.get(e.sourceId)
  const tn  = nodeMap.get(e.targetId)
  if (!src || !tgt || !sn || !tn) return ''
  const sx = src.x + sn.width/2,  sy = src.y + sn.height/2
  const tx = tgt.x + tn.width/2,  ty = tgt.y + tn.height/2
  const mx = (sx+tx)/2
  const stroke = e.isBackEdge ? '#f97316' : '#2a2a40'
  const dash   = e.isBackEdge ? '5,3' : 'none'
  return \`<path d="M\${sx},\${sy} C\${mx},\${sy} \${mx},\${ty} \${tx},\${ty}" fill="none" stroke="\${stroke}" stroke-width="1" stroke-dasharray="\${dash}" marker-end="url(#arr\${e.isBackEdge?'-back':''})"/>\`
}

function svgSegmentOverlay(seg, segIdx, nodeMap, nodePos, isActive, isDimmed) {
  // Draw a rounded rectangle behind the segment nodes
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
  for (const id of seg.nodeIds) {
    const p = nodePos.get(id), n = nodeMap.get(id)
    if (!p||!n) continue
    minX=Math.min(minX,p.x-8); minY=Math.min(minY,p.y-8)
    maxX=Math.max(maxX,p.x+n.width+8); maxY=Math.max(maxY,p.y+n.height+8)
  }
  if (!isFinite(minX)) return ''
  const col = segColor(segIdx)
  const opacity = isDimmed ? 0.02 : (isActive ? 0.18 : 0.07)
  const strokeOp = isDimmed ? 0.04 : (isActive ? 0.6 : 0.2)
  return \`<rect x="\${minX}" y="\${minY}" width="\${maxX-minX}" height="\${maxY-minY}" rx="6" fill="\${col}" fill-opacity="\${opacity}" stroke="\${col}" stroke-opacity="\${strokeOp}" stroke-width="1"/>\`
}

function svgGroupOverlay(group, allGroups, segments, nodeMap, nodePos, isActive) {
  const gMap = new Map(allGroups.map(g => [g.id, g]))
  const allSegIds = new Set()
  function collect(g) {
    for (const sid of (g.segmentIds || [])) allSegIds.add(sid)
    for (const cid of (g.childGroupIds || [])) { const c = gMap.get(cid); if (c) collect(c) }
  }
  collect(group)
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
  for (const segId of allSegIds) {
    const seg = segments.find(s => s.id === segId)
    if (!seg) continue
    for (const id of seg.nodeIds) {
      const p = nodePos.get(id), n = nodeMap.get(id)
      if (!p||!n) continue
      minX=Math.min(minX,p.x-18); minY=Math.min(minY,p.y-18)
      maxX=Math.max(maxX,p.x+n.width+18); maxY=Math.max(maxY,p.y+n.height+18)
    }
  }
  if (!isFinite(minX)) return ''
  const col = group.kind === 'gateway-pair' ? '#eab308' : '#a78bfa'
  const fillOp = isActive ? 0.1 : 0.03
  const strokeOp = isActive ? 0.7 : 0.15
  return \`<rect x="\${minX}" y="\${minY}" width="\${maxX-minX}" height="\${maxY-minY}" rx="10" fill="\${col}" fill-opacity="\${fillOp}" stroke="\${col}" stroke-opacity="\${strokeOp}" stroke-width="1.5" stroke-dasharray="6,3"/>\`
}

// ── State & render ────────────────────────────────────────────────────────────
let currentData = null
let currentStep = 0
let activeSegIdx = null   // index into segments array (null = all)
let activeGroupId = null  // group id string (null = all)
let activePath = null     // index into paths array (null = all)
let showRealLayout = false
let scale = 1, panX = 0, panY = 0
let dragging = false, lastMX = 0, lastMY = 0

// Toggle button wired up after DOM ready
const viewToggleBtn = document.getElementById('view-toggle')
viewToggleBtn.onclick = () => {
  showRealLayout = !showRealLayout
  viewToggleBtn.textContent = showRealLayout ? 'boxes' : 'elements'
  viewToggleBtn.classList.toggle('active', showRealLayout)
  scale=1; panX=0; panY=0; render()
}

function renderGroupDetail(canvas, layout, step) {
  const nodes = step.nodes || []
  const edges = step.edges || []
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const PAD = 60
  const nodePos = new Map()
  for (const nl of layout.nodes) nodePos.set(nl.id, { x: nl.x + PAD, y: nl.y + PAD })
  const layoutEdgeIds = new Set(layout.edges.map(e => e.id))

  const W = layout.width + PAD * 2
  const H = layout.height + PAD * 2
  const cW = canvas.clientWidth || 800, cH = canvas.clientHeight || 600

  let svgBody = \`<defs>
    <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#3a3a5a"/></marker>
    <marker id="arr-back" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#f97316"/></marker>
  </defs>\`

  for (const e of edges) {
    if (layoutEdgeIds.has(e.id)) svgBody += svgEdge(e, nodeMap, nodePos)
  }
  for (const nl of layout.nodes) {
    const n = nodeMap.get(nl.id), pos = nodePos.get(nl.id)
    if (n && pos) svgBody += svgNode(n, pos, null, null, null, false)
  }

  // Boundary-node glow rings (split/join or event/host)
  const activeGrp = (step.groups || []).find(g => g.id === activeGroupId)
  if (activeGrp) {
    const bc = activeGrp.kind === 'gateway-pair' ? '#eab308' : '#a78bfa'
    const boundaryIds = [activeGrp.splitId, activeGrp.joinId, activeGrp.eventNodeId, activeGrp.hostNodeId].filter(Boolean)
    const pad = 7
    for (const id of boundaryIds) {
      const n = nodeMap.get(id), pos = nodePos.get(id)
      if (!n || !pos) continue
      const { x, y } = pos, w = n.width, h = n.height, cx = x+w/2, cy = y+h/2
      if (isEvent(n.type)) {
        svgBody += \`<circle cx="\${cx}" cy="\${cy}" r="\${Math.min(w,h)/2+pad}" fill="none" stroke="\${bc}" stroke-width="2.5" stroke-opacity="0.9"/>\`
      } else if (isGateway(n.type)) {
        svgBody += \`<polygon points="\${cx},\${y-pad} \${x+w+pad},\${cy} \${cx},\${y+h+pad} \${x-pad},\${cy}" fill="none" stroke="\${bc}" stroke-width="2.5" stroke-opacity="0.9"/>\`
      } else {
        svgBody += \`<rect x="\${x-pad}" y="\${y-pad}" width="\${w+pad*2}" height="\${h+pad*2}" rx="8" fill="none" stroke="\${bc}" stroke-width="2.5" stroke-opacity="0.9"/>\`
      }
    }
  }

  canvas.innerHTML = \`<svg xmlns="http://www.w3.org/2000/svg" width="\${cW}" height="\${cH}" style="background:#0a0a12">
    <g id="diagram" transform="translate(\${panX},\${panY}) scale(\${scale})">\${svgBody}</g>
  </svg>\`

  if (scale === 1 && panX === 0 && panY === 0) {
    const fit = Math.min(cW/W, cH/H, 1)
    scale = fit
    panX = (cW - W*fit)/2
    panY = (cH - H*fit)/2
    applyTransform()
  }
  setupPanZoom(canvas)
}

// ── Process layout rendering ───────────────────────────────────────────────────

function svgProcessBox(pl, label, kind, grpKind, isActive) {
  const { x, y, width: w, height: h } = pl
  let stroke, fill, badgeCol, badgeTxt
  if (kind === 'segment') {
    stroke='#60a5fa'; fill='#0a1525'; badgeCol='#60a5fa'; badgeTxt='CS'
  } else if (grpKind === 'gateway-pair') {
    stroke='#eab308'; fill='#2a2000'; badgeCol='#eab308'; badgeTxt='GW'
  } else {
    stroke='#a78bfa'; fill='#150a2a'; badgeCol='#a78bfa'; badgeTxt='EV'
  }
  const fOp = isActive ? 0.45 : 0.2, sOp = isActive ? 1 : 0.45, sw = isActive ? 2 : 1
  let out = \`<rect x="\${x}" y="\${y}" width="\${w}" height="\${h}" rx="8" fill="\${fill}" fill-opacity="\${fOp}" stroke="\${stroke}" stroke-opacity="\${sOp}" stroke-width="\${sw}"/>\`
  // badge
  out += \`<text x="\${x+8}" y="\${y+14}" font-size="9" fill="\${badgeCol}" font-family="monospace" font-weight="bold" opacity="0.9">[\${badgeTxt}]</text>\`
  // label, word-wrapped to two lines max
  const maxChars = Math.max(10, Math.floor(w / 7))
  const words = (label || '').split(' ')
  const lines = []; let line = ''
  for (const wd of words) {
    if (line && (line+' '+wd).length > maxChars) { lines.push(line); line = wd } else line = line ? line+' '+wd : wd
  }
  if (line) lines.push(line)
  const linesShown = lines.slice(0,2)
  const baseY = y + h/2 - (linesShown.length-1)*8
  for (let i=0; i<linesShown.length; i++) {
    out += \`<text x="\${x+w/2}" y="\${baseY+i*16}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#cdd6f4" font-family="monospace" pointer-events="none">\${esc(linesShown[i])}</text>\`
  }
  // size annotation
  out += \`<text x="\${x+w-6}" y="\${y+h-6}" text-anchor="end" font-size="9" fill="#444" font-family="monospace">\${Math.round(w)}×\${Math.round(h)}</text>\`
  return out
}

function renderProcessLayout(canvas, step) {
  const pl = step.processLayout
  if (!pl || pl.placements.length === 0) {
    canvas.innerHTML = '<div style="padding:20px;color:#444;font-size:11px">No process layout data.</div>'
    return
  }
  const PAD = 60
  const W = pl.width + PAD * 2, H = pl.height + PAD * 2
  const cW = canvas.clientWidth || 800, cH = canvas.clientHeight || 600

  let svgBody = \`<defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 z" fill="#3a3a5a"/></marker>
  </defs>\`

  // Arrows between boxes
  for (let i=0; i<pl.placements.length-1; i++) {
    const a = pl.placements[i], b = pl.placements[i+1]
    const sx = a.x+a.width+PAD, sy = a.y+a.height/2+PAD
    const tx = b.x+PAD,         ty = b.y+b.height/2+PAD
    const mx = (sx+tx)/2
    svgBody += \`<path d="M\${sx},\${sy} C\${mx},\${sy} \${mx},\${ty} \${tx},\${ty}" fill="none" stroke="#2a2a40" stroke-width="1.5" marker-end="url(#arr)"/>\`
  }

  // Boxes
  const pf = step.processFlow || []
  for (const p of pl.placements) {
    const el = pf.find(e => e.id === p.id)
    const grpKind = el?.groupData?.kind ?? ''
    const label = el?.label ?? p.id
    const isActive = p.kind === 'group' ? activeGroupId === p.id : activeSegIdx === (step.segments||[]).findIndex(s=>s.id===p.id)
    const shifted = { ...p, x: p.x + PAD, y: p.y + PAD }
    svgBody += svgProcessBox(shifted, label, p.kind, grpKind, isActive)
  }

  canvas.innerHTML = \`<svg xmlns="http://www.w3.org/2000/svg" width="\${cW}" height="\${cH}" style="background:#0a0a12">
    <g id="diagram" transform="translate(\${panX},\${panY}) scale(\${scale})">\${svgBody}</g>
  </svg>\`

  if (scale === 1 && panX === 0 && panY === 0) {
    const fit = Math.min(cW/W, cH/H, 1)
    scale=fit; panX=(cW-W*fit)/2; panY=(cH-H*fit)/2; applyTransform()
  }
  setupPanZoom(canvas)
}

function renderConnectorDetail(canvas, seg, step) {
  const nodes = step.nodes || []
  const edges = step.edges || []
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const PAD = 60, GAP = 40
  const segEdgeIds = new Set(seg.edgeIds || [])

  // Build node positions: horizontal line
  const nids = seg.nodeIds || []
  const nodePos = new Map()
  let nx = PAD
  for (const nid of nids) {
    const n = nodeMap.get(nid)
    const w = n?.width ?? 100, h = n?.height ?? 80
    nodePos.set(nid, { x: nx, y: PAD })
    nx += w + GAP
  }
  const W = nx - GAP + PAD
  const maxH = nids.reduce((acc, nid) => { const n = nodeMap.get(nid); return Math.max(acc, n?.height ?? 80) }, 60) + PAD * 2
  // center each node vertically
  for (const [id, pos] of nodePos) {
    const n = nodeMap.get(id); const h = n?.height ?? 80
    pos.y = maxH / 2 - h / 2
  }

  const cW = canvas.clientWidth || 800, cH = canvas.clientHeight || 600
  let svgBody = \`<defs>
    <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#3a3a5a"/></marker>
  </defs>\`

  for (const e of edges) { if (segEdgeIds.has(e.id)) svgBody += svgEdge(e, nodeMap, nodePos) }
  for (const nid of nids) {
    const n = nodeMap.get(nid), pos = nodePos.get(nid)
    if (n && pos) svgBody += svgNode(n, pos, null, null, null, false)
  }

  canvas.innerHTML = \`<svg xmlns="http://www.w3.org/2000/svg" width="\${cW}" height="\${cH}" style="background:#0a0a12">
    <g id="diagram" transform="translate(\${panX},\${panY}) scale(\${scale})">\${svgBody}</g>
  </svg>\`
  if (scale === 1 && panX === 0 && panY === 0) {
    const fit = Math.min(cW/W, cH/maxH, 1)
    scale=fit; panX=(cW-W*fit)/2; panY=(cH-maxH*fit)/2; applyTransform()
  }
  setupPanZoom(canvas)
}

// ── Track layout rendering ─────────────────────────────────────────────────────

function renderTrackLayout(canvas, step) {
  const tl = step.trackLayout
  const fl = step.fullLayout
  const nodes = step.nodes || []
  const edges = step.edges || []
  if (!tl || tl.nodes.length === 0) {
    canvas.innerHTML = '<div style="padding:20px;color:#444;font-size:11px">No track layout data.</div>'
    return
  }

  const PAD = 60
  const TH = ${TRACK_HEIGHT}
  const nodePos = new Map(tl.nodes.map(nl => [nl.id, { x: nl.x + PAD, y: nl.y + PAD }]))
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const W = tl.width + PAD * 2, H = tl.height + PAD * 2
  const cW = canvas.clientWidth || 800, cH = canvas.clientHeight || 600

  let svgBody = \`<defs>
    <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#3a3a5a"/></marker>
    <marker id="arr-back" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#f97316"/></marker>
  </defs>\`

  // Track bands
  for (const band of tl.trackBands) {
    const by = band.y + PAD
    const isMain = band.track === 0
    const isBack = tl.backTrack !== null && band.track === tl.backTrack
    const fill = isMain ? '#0f0f22' : isBack ? '#1a0f00' : (band.track < 0 ? '#0a180a' : '#180a0a')
    const lineCol = isMain ? '#2a2a44' : isBack ? '#3a2000' : '#1e2a1e'
    const textCol = isMain ? '#3a3a6a' : isBack ? '#6a4000' : '#2a3a2a'
    svgBody += \`<rect x="0" y="\${by}" width="\${W}" height="\${TH}" fill="\${fill}" opacity="0.6"/>\`
    svgBody += \`<line x1="0" y1="\${by}" x2="\${W}" y2="\${by}" stroke="\${lineCol}" stroke-width="1"/>\`
    const trackLabel = isMain ? 'main' : isBack ? 'back' : (band.track < 0 ? \`T\${band.track}\` : \`T+\${band.track}\`)
    svgBody += \`<text x="6" y="\${by + 14}" font-size="10" fill="\${textCol}" font-family="monospace">\${trackLabel}</text>\`
  }

  // Edges
  for (const e of edges) {
    const src = nodeMap.get(e.sourceId), tgt = nodeMap.get(e.targetId)
    const sp = nodePos.get(e.sourceId), tp = nodePos.get(e.targetId)
    if (!src || !tgt || !sp || !tp) continue
    if (e.isBackEdge) {
      const sx=sp.x+src.width, sy=sp.y+src.height/2
      const tx=tp.x, ty=tp.y+tgt.height/2
      const my=Math.min(sy,ty)-60
      svgBody += \`<path d="M\${sx},\${sy} C\${sx+40},\${my} \${tx-40},\${my} \${tx},\${ty}" fill="none" stroke="#f97316" stroke-opacity="0.6" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arr-back)"/>\`
    } else {
      const sx=sp.x+src.width, sy=sp.y+src.height/2
      const tx=tp.x, ty=tp.y+tgt.height/2
      const mx=(sx+tx)/2
      svgBody += \`<path d="M\${sx},\${sy} C\${mx},\${sy} \${mx},\${ty} \${tx},\${ty}" fill="none" stroke="#3a3a5a" stroke-width="1.5" marker-end="url(#arr)"/>\`
    }
  }

  // Nodes
  for (const nl of tl.nodes) {
    const n = nodeMap.get(nl.id)
    const pos = nodePos.get(nl.id)
    if (!n || !pos) continue
    svgBody += svgNode(n, pos, null, null, null, false)
  }

  canvas.innerHTML = \`<svg xmlns="http://www.w3.org/2000/svg" width="\${cW}" height="\${cH}" style="background:#0a0a12">
    <g id="diagram" transform="translate(\${panX},\${panY}) scale(\${scale})">\${svgBody}</g>
  </svg>\`

  if (scale === 1 && panX === 0 && panY === 0) {
    const fit = Math.min(cW/W, cH/H, 1)
    scale=fit; panX=(cW-W*fit)/2; panY=(cH-H*fit)/2; applyTransform()
  }
  setupPanZoom(canvas)
}

// ── Column layout rendering ────────────────────────────────────────────────────

function renderColumnLayout(canvas, step) {
  const cl = step.columnLayout
  const tl = step.trackLayout
  const nodes = step.nodes || []
  const edges = step.edges || []
  if (!cl || cl.nodes.length === 0) {
    canvas.innerHTML = '<div style="padding:20px;color:#444;font-size:11px">No column layout data.</div>'
    return
  }

  const PAD = 60
  const TH = ${TRACK_HEIGHT}
  const CW_COL = ${COLUMN_WIDTH}
  const nodePos = new Map(cl.nodes.map(nl => [nl.id, { x: nl.x + PAD, y: nl.y + PAD }]))
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const W = cl.width + PAD * 2, H = cl.height + PAD * 2
  const cW = canvas.clientWidth || 800, cH = canvas.clientHeight || 600

  let svgBody = \`<defs>
    <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#3a3a5a"/></marker>
    <marker id="arr-back" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#f97316"/></marker>
  </defs>\`

  // Track bands (horizontal)
  if (tl) {
    for (const band of tl.trackBands) {
      const by = band.y + PAD
      const isMain = band.track === 0
      const isBack = tl.backTrack !== null && band.track === tl.backTrack
      const fill = isMain ? '#0f0f22' : isBack ? '#1a0f00' : (band.track < 0 ? '#0a180a' : '#180a0a')
      const lineCol = isMain ? '#2a2a44' : isBack ? '#3a2000' : '#1e2a1e'
      const textCol = isMain ? '#3a3a6a' : isBack ? '#6a4000' : '#2a3a2a'
      svgBody += \`<rect x="0" y="\${by}" width="\${W}" height="\${TH}" fill="\${fill}" opacity="0.6"/>\`
      svgBody += \`<line x1="0" y1="\${by}" x2="\${W}" y2="\${by}" stroke="\${lineCol}" stroke-width="1"/>\`
      const trackLabel = isMain ? 'main' : isBack ? 'back' : (band.track < 0 ? \`T\${band.track}\` : \`T+\${band.track}\`)
      svgBody += \`<text x="6" y="\${by + 14}" font-size="10" fill="\${textCol}" font-family="monospace">\${trackLabel}</text>\`
    }
  }

  // Column bands (vertical)
  for (const band of cl.columnBands) {
    const bx = band.x + PAD
    const fill = band.column % 2 === 0 ? '#131320' : '#0d0d1c'
    svgBody += \`<rect x="\${bx}" y="0" width="\${CW_COL}" height="\${H}" fill="\${fill}" opacity="0.5"/>\`
    svgBody += \`<line x1="\${bx}" y1="0" x2="\${bx}" y2="\${H}" stroke="#1e1e30" stroke-width="1"/>\`
    svgBody += \`<text x="\${bx + CW_COL / 2}" y="14" text-anchor="middle" font-size="10" fill="#2a2a44" font-family="monospace">C\${band.column}</text>\`
  }
  if (cl.columnBands.length > 0) {
    const last = cl.columnBands[cl.columnBands.length - 1]
    const bx = last.x + last.width + PAD
    svgBody += \`<line x1="\${bx}" y1="0" x2="\${bx}" y2="\${H}" stroke="#1e1e30" stroke-width="1"/>\`
  }

  // Edges
  for (const e of edges) {
    const src = nodeMap.get(e.sourceId), tgt = nodeMap.get(e.targetId)
    const sp = nodePos.get(e.sourceId), tp = nodePos.get(e.targetId)
    if (!src || !tgt || !sp || !tp) continue
    if (e.isBackEdge) {
      const sx=sp.x+src.width, sy=sp.y+src.height/2
      const tx=tp.x, ty=tp.y+tgt.height/2
      const my=Math.min(sy,ty)-60
      svgBody += \`<path d="M\${sx},\${sy} C\${sx+40},\${my} \${tx-40},\${my} \${tx},\${ty}" fill="none" stroke="#f97316" stroke-opacity="0.6" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arr-back)"/>\`
    } else {
      const sx=sp.x+src.width, sy=sp.y+src.height/2
      const tx=tp.x, ty=tp.y+tgt.height/2
      const mx=(sx+tx)/2
      svgBody += \`<path d="M\${sx},\${sy} C\${mx},\${sy} \${mx},\${ty} \${tx},\${ty}" fill="none" stroke="#3a3a5a" stroke-width="1.5" marker-end="url(#arr)"/>\`
    }
  }

  // Nodes
  for (const nl of cl.nodes) {
    const n = nodeMap.get(nl.id), pos = nodePos.get(nl.id)
    if (!n || !pos) continue
    svgBody += svgNode(n, pos, null, null, null, false)
  }

  canvas.innerHTML = \`<svg xmlns="http://www.w3.org/2000/svg" width="\${cW}" height="\${cH}" style="background:#0a0a12">
    <g id="diagram" transform="translate(\${panX},\${panY}) scale(\${scale})">\${svgBody}</g>
  </svg>\`

  if (scale === 1 && panX === 0 && panY === 0) {
    const fit = Math.min(cW/W, cH/H, 1)
    scale=fit; panX=(cW-W*fit)/2; panY=(cH-H*fit)/2; applyTransform()
  }
  setupPanZoom(canvas)
}

// ── Path layout rendering ──────────────────────────────────────────────────────

function renderPathLayout(canvas, step) {
  const pl = step.pathLayout
  const tl = step.trackLayout
  const cl = step.columnLayout
  const nodes = step.nodes || []
  if (!pl || pl.nodes.length === 0) {
    canvas.innerHTML = '<div style="padding:20px;color:#444;font-size:11px">No path layout data.</div>'
    return
  }

  const PAD = 60
  const TH = ${TRACK_HEIGHT}
  const CW_COL = ${COLUMN_WIDTH}
  const nodePos = new Map(pl.nodes.map(nl => [nl.id, { x: nl.x + PAD, y: nl.y + PAD }]))
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const W = pl.width + PAD * 2, H = pl.height + PAD * 2
  const cW = canvas.clientWidth || 800, cH = canvas.clientHeight || 600

  // Kind colors
  const kindColor = { straight: '#3a3a6a', L: '#2a4a6a', Z: '#4a2a6a', U: '#6a3a1a' }

  let svgBody = \`<defs>
    <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#4a4a7a"/></marker>
    <marker id="arr-back" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#f97316"/></marker>
    <marker id="arr-U" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#f97316"/></marker>
  </defs>\`

  // Track bands
  if (tl) {
    for (const band of tl.trackBands) {
      const by = band.y + PAD
      const isMain = band.track === 0
      const isBack = tl.backTrack !== null && band.track === tl.backTrack
      const fill = isMain ? '#0f0f22' : isBack ? '#1a0f00' : (band.track < 0 ? '#0a180a' : '#180a0a')
      const lineCol = isMain ? '#2a2a44' : isBack ? '#3a2000' : '#1e2a1e'
      const textCol = isMain ? '#3a3a6a' : isBack ? '#6a4000' : '#2a3a2a'
      svgBody += \`<rect x="0" y="\${by}" width="\${W}" height="\${TH}" fill="\${fill}" opacity="0.6"/>\`
      svgBody += \`<line x1="0" y1="\${by}" x2="\${W}" y2="\${by}" stroke="\${lineCol}" stroke-width="1"/>\`
      const trackLabel = isMain ? 'main' : isBack ? 'back' : (band.track < 0 ? \`T\${band.track}\` : \`T+\${band.track}\`)
      svgBody += \`<text x="6" y="\${by + 14}" font-size="10" fill="\${textCol}" font-family="monospace">\${trackLabel}</text>\`
    }
  }

  // Column bands
  if (cl) {
    for (const band of cl.columnBands) {
      const bx = band.x + PAD
      const fill = band.column % 2 === 0 ? '#131320' : '#0d0d1c'
      svgBody += \`<rect x="\${bx}" y="0" width="\${CW_COL}" height="\${H}" fill="\${fill}" opacity="0.4"/>\`
      svgBody += \`<line x1="\${bx}" y1="0" x2="\${bx}" y2="\${H}" stroke="#1a1a2a" stroke-width="1"/>\`
      svgBody += \`<text x="\${bx + CW_COL / 2}" y="14" text-anchor="middle" font-size="10" fill="#22223a" font-family="monospace">C\${band.column}</text>\`
    }
    if (cl.columnBands.length > 0) {
      const last = cl.columnBands[cl.columnBands.length - 1]
      const bx = last.x + last.width + PAD
      svgBody += \`<line x1="\${bx}" y1="0" x2="\${bx}" y2="\${H}" stroke="#1a1a2a" stroke-width="1"/>\`
    }
  }

  // Routed edges (polyline of waypoints)
  for (const edge of pl.edges) {
    if (!edge.points || edge.points.length < 2) continue
    const isU = edge.kind === 'U'
    const stroke = isU ? '#f97316' : (kindColor[edge.kind] ?? '#3a3a6a')
    const dash = isU ? '5,3' : 'none'
    const opacity = isU ? 0.7 : 0.9
    const pts = edge.points.map(p => \`\${p.x + PAD},\${p.y + PAD}\`).join(' ')
    const marker = isU ? 'arr-U' : 'arr'
    svgBody += \`<polyline points="\${pts}" fill="none" stroke="\${stroke}" stroke-width="1.5" stroke-opacity="\${opacity}" stroke-dasharray="\${dash}" marker-end="url(#\${marker})"/>\`
  }

  // Nodes on top
  for (const nl of pl.nodes) {
    const n = nodeMap.get(nl.id), pos = nodePos.get(nl.id)
    if (!n || !pos) continue
    svgBody += svgNode(n, pos, null, null, null, false)
  }

  canvas.innerHTML = \`<svg xmlns="http://www.w3.org/2000/svg" width="\${cW}" height="\${cH}" style="background:#0a0a12">
    <g id="diagram" transform="translate(\${panX},\${panY}) scale(\${scale})">\${svgBody}</g>
  </svg>\`

  if (scale === 1 && panX === 0 && panY === 0) {
    const fit = Math.min(cW/W, cH/H, 1)
    scale=fit; panX=(cW-W*fit)/2; panY=(cH-H*fit)/2; applyTransform()
  }
  setupPanZoom(canvas)
}

// ── Full layout rendering ──────────────────────────────────────────────────────

function renderFullLayout(canvas, step) {
  const fl = step.fullLayout
  const nodes = step.nodes || []
  const edges = step.edges || []
  if (!fl || fl.nodes.length === 0) {
    canvas.innerHTML = '<div style="padding:20px;color:#444;font-size:11px">No full layout data.</div>'
    return
  }

  const PAD = 60
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const nodePos = new Map(fl.nodes.map(nl => [nl.id, { x: nl.x + PAD, y: nl.y + PAD }]))

  // Active path highlighting
  const path = activePath !== null ? step.paths?.[activePath] : null
  const pathNodeSet = path ? new Set(path.nodeIds) : null
  const pathEdgeSet = path ? new Set(path.edgeIds) : null

  const W = fl.width + PAD * 2, H = fl.height + PAD * 2
  const cW = canvas.clientWidth || 800, cH = canvas.clientHeight || 600

  let svgBody = \`<defs>
    <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#3a3a5a"/></marker>
    <marker id="arr-back" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#f97316"/></marker>
    <marker id="arr-path" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#22d3ee"/></marker>
  </defs>\`

  // Edges
  for (const e of edges) {
    const src = nodeMap.get(e.sourceId), tgt = nodeMap.get(e.targetId)
    const sp = nodePos.get(e.sourceId), tp = nodePos.get(e.targetId)
    if (!src || !tgt || !sp || !tp) continue
    const onPath = pathEdgeSet ? pathEdgeSet.has(e.id) : false
    const dim = pathEdgeSet && !onPath
    if (e.isBackEdge) {
      const sx=sp.x+src.width, sy=sp.y+src.height/2
      const tx=tp.x, ty=tp.y+tgt.height/2
      const my=Math.min(sy,ty)-60
      svgBody += \`<path d="M\${sx},\${sy} C\${sx+40},\${my} \${tx-40},\${my} \${tx},\${ty}" fill="none" stroke="#f97316" stroke-opacity="\${dim?0.1:0.6}" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arr-back)"/>\`
    } else {
      const sx=sp.x+src.width, sy=sp.y+src.height/2
      const tx=tp.x, ty=tp.y+tgt.height/2
      const mx=(sx+tx)/2
      const col = onPath ? '#22d3ee' : '#3a3a5a'
      const sw = onPath ? 2 : 1.5
      const op = dim ? 0.1 : 1
      const marker = onPath ? 'arr-path' : 'arr'
      svgBody += \`<path d="M\${sx},\${sy} C\${mx},\${sy} \${mx},\${ty} \${tx},\${ty}" fill="none" stroke="\${col}" stroke-opacity="\${op}" stroke-width="\${sw}" marker-end="url(#\${marker})"/>\`
    }
  }

  // Nodes
  for (const nl of fl.nodes) {
    const n = nodeMap.get(nl.id), pos = nodePos.get(nl.id)
    if (!n || !pos) continue
    const onPath = pathNodeSet ? pathNodeSet.has(nl.id) : false
    const dim = pathNodeSet ? !onPath : false
    svgBody += svgNode(n, pos, null, null, null, dim)
    if (onPath) {
      const { x, y } = pos, w = nl.width, h = nl.height, cx = x+w/2, cy = y+h/2
      if (isEvent(n.type)) {
        svgBody += \`<circle cx="\${cx}" cy="\${cy}" r="\${Math.min(w,h)/2+5}" fill="none" stroke="#22d3ee" stroke-width="2" stroke-opacity="0.8"/>\`
      } else if (isGateway(n.type)) {
        svgBody += \`<polygon points="\${cx},\${y-5} \${x+w+5},\${cy} \${cx},\${y+h+5} \${x-5},\${cy}" fill="none" stroke="#22d3ee" stroke-width="2" stroke-opacity="0.8"/>\`
      } else {
        svgBody += \`<rect x="\${x-5}" y="\${y-5}" width="\${w+10}" height="\${h+10}" rx="8" fill="none" stroke="#22d3ee" stroke-width="2" stroke-opacity="0.8"/>\`
      }
    }
  }

  // Loop indicator
  if (path?.hasLoop) {
    svgBody += \`<text x="8" y="18" font-size="11" fill="#f97316" font-family="monospace" font-weight="bold">⟲ loop</text>\`
  }

  canvas.innerHTML = \`<svg xmlns="http://www.w3.org/2000/svg" width="\${cW}" height="\${cH}" style="background:#0a0a12">
    <g id="diagram" transform="translate(\${panX},\${panY}) scale(\${scale})">\${svgBody}</g>
  </svg>\`

  if (scale === 1 && panX === 0 && panY === 0) {
    const fit = Math.min(cW/W, cH/H, 1)
    scale=fit; panX=(cW-W*fit)/2; panY=(cH-H*fit)/2; applyTransform()
  }
  setupPanZoom(canvas)
}

// ── Annotation layout rendering ───────────────────────────────────────────────

function renderAnnotationLayout(canvas, step) {
  const al = step.annotationLayout
  const pl = step.pathLayout
  const tl = step.trackLayout
  const cl = step.columnLayout
  const nodes = step.nodes || []
  if (!al || !pl || pl.nodes.length === 0) {
    canvas.innerHTML = '<div style="padding:20px;color:#444;font-size:11px">No annotation layout data.</div>'
    return
  }

  const PAD = 60
  const TH = ${TRACK_HEIGHT}
  const CW_COL = ${COLUMN_WIDTH}
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const nodePos = new Map(pl.nodes.map(nl => [nl.id, { x: nl.x + PAD, y: nl.y + PAD }]))

  const W = al.width + PAD * 2, H = al.height + PAD * 2
  const cW = canvas.clientWidth || 800, cH = canvas.clientHeight || 600

  const kindColor = { straight: '#3a3a6a', L: '#2a4a6a', Z: '#4a2a6a', U: '#6a3a1a' }

  let svgBody = \`<defs>
    <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#4a4a7a"/></marker>
    <marker id="arr-U" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#f97316"/></marker>
  </defs>\`

  // Track bands
  if (tl) {
    for (const band of tl.trackBands) {
      const by = band.y + PAD
      const isMain = band.track === 0
      const isBack = tl.backTrack !== null && band.track === tl.backTrack
      const fill = isMain ? '#0f0f22' : isBack ? '#1a0f00' : (band.track < 0 ? '#0a180a' : '#180a0a')
      const lineCol = isMain ? '#2a2a44' : isBack ? '#3a2000' : '#1e2a1e'
      svgBody += \`<rect x="0" y="\${by}" width="\${W}" height="\${TH}" fill="\${fill}" opacity="0.6"/>\`
      svgBody += \`<line x1="0" y1="\${by}" x2="\${W}" y2="\${by}" stroke="\${lineCol}" stroke-width="1"/>\`
    }
  }

  // Column bands
  if (cl) {
    for (const band of cl.columnBands) {
      const bx = band.x + PAD
      const fill = band.column % 2 === 0 ? '#131320' : '#0d0d1c'
      svgBody += \`<rect x="\${bx}" y="0" width="\${CW_COL}" height="\${H}" fill="\${fill}" opacity="0.4"/>\`
      svgBody += \`<line x1="\${bx}" y1="0" x2="\${bx}" y2="\${H}" stroke="#1a1a2a" stroke-width="1"/>\`
    }
  }

  // Sequence flow edges
  for (const edge of pl.edges) {
    if (!edge.points || edge.points.length < 2) continue
    const isU = edge.kind === 'U'
    const stroke = isU ? '#f97316' : (kindColor[edge.kind] ?? '#3a3a6a')
    const dash = isU ? '5,3' : 'none'
    const pts = edge.points.map(p => \`\${p.x + PAD},\${p.y + PAD}\`).join(' ')
    svgBody += \`<polyline points="\${pts}" fill="none" stroke="\${stroke}" stroke-width="1.5" stroke-opacity="0.7" stroke-dasharray="\${dash}" marker-end="url(#arr)"/>\`
  }

  // Association edges (dashed)
  for (const ae of al.annotationEdges) {
    if (!ae.points || ae.points.length < 2) continue
    const pts = ae.points.map(p => \`\${p.x + PAD},\${p.y + PAD}\`).join(' ')
    svgBody += \`<polyline points="\${pts}" fill="none" stroke="#6a6a9a" stroke-width="1.5" stroke-dasharray="6,3" stroke-opacity="0.9"/>\`
  }

  // Flow nodes
  for (const nl of pl.nodes) {
    const n = nodeMap.get(nl.id), pos = nodePos.get(nl.id)
    if (!n || !pos) continue
    svgBody += svgNode(n, pos, null, null, null, false)
  }

  // Annotation boxes
  for (const an of al.annotationNodes) {
    const ax = an.x + PAD, ay = an.y + PAD
    svgBody += \`<rect x="\${ax}" y="\${ay}" width="\${an.width}" height="\${an.height}" rx="4" fill="#0f0f28" stroke="#4a4a8a" stroke-width="1.5" stroke-dasharray="4,2"/>\`
    // Left bracket line (BPMN convention)
    svgBody += \`<line x1="\${ax + 8}" y1="\${ay + 4}" x2="\${ax + 8}" y2="\${ay + an.height - 4}" stroke="#4a4a8a" stroke-width="2"/>\`
    const label = an.text.length > 60 ? an.text.slice(0, 57) + '…' : an.text
    svgBody += \`<text x="\${ax + 14}" y="\${ay + 16}" font-size="9" fill="#8a8aba" font-family="monospace" style="white-space:pre">\${label.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>\`
  }

  canvas.innerHTML = \`<svg xmlns="http://www.w3.org/2000/svg" width="\${cW}" height="\${cH}" style="background:#0a0a12">
    <g id="diagram" transform="translate(\${panX},\${panY}) scale(\${scale})">\${svgBody}</g>
  </svg>\`

  if (scale === 1 && panX === 0 && panY === 0) {
    const fit = Math.min(cW/W, cH/H, 1)
    scale=fit; panX=(cW-W*fit)/2; panY=(cH-H*fit)/2; applyTransform()
  }
  setupPanZoom(canvas)
}

function render() {
  const data = currentData
  const canvas = document.getElementById('canvas')
  if (!data || data.error) {
    canvas.innerHTML = \`<div class="error">\${data?.error || 'Loading...'}</div>\`
    return
  }

  const step = data.steps[currentStep]
  if (!step) return

  document.getElementById('desc-text').textContent = step.desc || ''

  // Show/hide and label the toggle button
  const isProcessStep = !!(step.processLayout && !step.paths)
  viewToggleBtn.style.display = isProcessStep ? '' : 'none'
  if (!isProcessStep) { showRealLayout = false; viewToggleBtn.classList.remove('active') }
  viewToggleBtn.textContent = showRealLayout ? 'boxes' : 'elements'

  // Step 11: annotation layout
  if (step.annotationLayout) { renderAnnotationLayout(canvas, step); return }

  // Step 10: path layout
  if (step.pathLayout) { renderPathLayout(canvas, step); return }

  // Step 9: column layout
  if (step.columnLayout) { renderColumnLayout(canvas, step); return }

  // Step 8: track layout
  if (step.trackLayout) { renderTrackLayout(canvas, step); return }

  // Step 7: always show full layout (path selection controls highlighting)
  if (step.paths) { renderFullLayout(canvas, step); return }

  // Step 6 group detail (group selected)
  if (step.groupLayouts && activeGroupId) {
    const layout = step.groupLayouts[activeGroupId]
    if (layout) { renderGroupDetail(canvas, layout, step); return }
  }

  // Step 6 connector detail (connector segment selected)
  if (step.processLayout && activeSegIdx !== null && step.segments) {
    const seg = step.segments[activeSegIdx]
    if (seg) { renderConnectorDetail(canvas, seg, step); return }
  }

  // Step 6 overview: elements mode or boxes mode
  if (step.processLayout && !activeGroupId && activeSegIdx === null) {
    if (showRealLayout) { renderFullLayout(canvas, step); return }
    renderProcessLayout(canvas, step); return
  }

  const nodes    = step.nodes    || []
  const edges    = step.edges    || []
  const segments = step.segments || null

  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const { nodePos, segOf } = computeLayout(step)

  // Compute SVG bounds
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
  for (const n of nodes) {
    const p = nodePos.get(n.id)
    if (!p) continue
    const labelH = (n.label && (isEvent(n.type)||isGateway(n.type))) ? 40 : 0
    minX=Math.min(minX,p.x-PAD); minY=Math.min(minY,p.y-PAD)
    maxX=Math.max(maxX,p.x+n.width+PAD); maxY=Math.max(maxY,p.y+n.height+labelH+PAD)
  }
  if (!isFinite(minX)) { minX=0;minY=0;maxX=800;maxY=600 }
  const W=maxX-minX, H=maxY-minY
  const cW=canvas.clientWidth||800, cH=canvas.clientHeight||600

  let svgBody = \`<defs>
    <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#3a3a5a"/></marker>
    <marker id="arr-back" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="#f97316"/></marker>
  </defs>\`

  // Group context: which nodes/segments to highlight when a group is selected
  const groups = step.groups
  let groupSegIds = null   // Set<segId> — all segs in active group (recursive)
  let groupNodeIds = null  // Set<nodeId> — interior + boundary nodes
  let boundaryNodes = null // Map<nodeId, color>

  if (activeGroupId && groups) {
    const activeGrp = groups.find(g => g.id === activeGroupId)
    if (activeGrp) {
      const gMap = new Map(groups.map(g => [g.id, g]))
      groupSegIds = new Set()
      ;(function collectSegs(g) {
        for (const sid of (g.segmentIds || [])) groupSegIds.add(sid)
        for (const cid of (g.childGroupIds || [])) { const c = gMap.get(cid); if (c) collectSegs(c) }
      })(activeGrp)
      groupNodeIds = new Set()
      for (const segId of groupSegIds) {
        const seg = (segments || []).find(s => s.id === segId)
        if (seg) for (const nid of seg.nodeIds) groupNodeIds.add(nid)
      }
      boundaryNodes = new Map()
      const bc = activeGrp.kind === 'gateway-pair' ? '#eab308' : '#a78bfa'
      if (activeGrp.splitId)     { boundaryNodes.set(activeGrp.splitId, bc);     groupNodeIds.add(activeGrp.splitId) }
      if (activeGrp.joinId)      { boundaryNodes.set(activeGrp.joinId, bc);       groupNodeIds.add(activeGrp.joinId) }
      if (activeGrp.eventNodeId) { boundaryNodes.set(activeGrp.eventNodeId, bc);  groupNodeIds.add(activeGrp.eventNodeId) }
      if (activeGrp.hostNodeId)  { boundaryNodes.set(activeGrp.hostNodeId, bc);   groupNodeIds.add(activeGrp.hostNodeId) }
    }
  }

  // Group overlays (outermost, behind segment overlays) — Step 3+
  if (groups) {
    for (const g of groups) {
      svgBody += svgGroupOverlay(g, groups, segments || [], nodeMap, nodePos, g.id === activeGroupId)
    }
  }

  // Segment overlays (behind everything)
  if (segments) {
    segments.forEach((seg, si) => {
      if (groupSegIds) {
        const inGroup = groupSegIds.has(seg.id)
        svgBody += svgSegmentOverlay(seg, si, nodeMap, nodePos, inGroup, !inGroup)
      } else {
        svgBody += svgSegmentOverlay(seg, si, nodeMap, nodePos, si === activeSegIdx, false)
      }
    })
  }

  // Edges
  for (const e of edges) svgBody += svgEdge(e, nodeMap, nodePos)

  // Nodes
  for (const n of nodes) {
    const p = nodePos.get(n.id)
    if (p) {
      const dimmed = groupNodeIds ? !groupNodeIds.has(n.id) : false
      svgBody += svgNode(n, p, activeSegIdx, segOf, segments, dimmed)
    }
  }

  // Boundary node glow rings (drawn on top of nodes)
  if (boundaryNodes) {
    const pad = 7
    for (const [id, col] of boundaryNodes) {
      const n = nodeMap.get(id), p = nodePos.get(id)
      if (!n || !p) continue
      const { x, y } = p, w = n.width, h = n.height, cx = x+w/2, cy = y+h/2
      if (isEvent(n.type)) {
        const r = Math.min(w,h)/2
        svgBody += \`<circle cx="\${cx}" cy="\${cy}" r="\${r+pad}" fill="none" stroke="\${col}" stroke-width="2.5" stroke-opacity="0.9"/>\`
      } else if (isGateway(n.type)) {
        svgBody += \`<polygon points="\${cx},\${y-pad} \${x+w+pad},\${cy} \${cx},\${y+h+pad} \${x-pad},\${cy}" fill="none" stroke="\${col}" stroke-width="2.5" stroke-opacity="0.9"/>\`
      } else {
        svgBody += \`<rect x="\${x-pad}" y="\${y-pad}" width="\${w+pad*2}" height="\${h+pad*2}" rx="8" fill="none" stroke="\${col}" stroke-width="2.5" stroke-opacity="0.9"/>\`
      }
    }
  }

  const svgEl = \`<svg xmlns="http://www.w3.org/2000/svg" width="\${cW}" height="\${cH}" style="background:#0a0a12">
    <g id="diagram" transform="translate(\${panX},\${panY}) scale(\${scale})">\${svgBody}</g>
  </svg>\`
  canvas.innerHTML = svgEl

  if (scale === 1 && panX === 0 && panY === 0) {
    const fit = Math.min(cW/W, cH/H, 1)
    scale = fit
    panX  = (cW - W*fit)/2 - minX*fit
    panY  = (cH - H*fit)/2 - minY*fit
    applyTransform()
  }
  setupPanZoom(canvas)
}

function applyTransform() {
  const g = document.getElementById('diagram')
  if (g) g.setAttribute('transform',\`translate(\${panX},\${panY}) scale(\${scale})\`)
}

function setupPanZoom(canvas) {
  canvas.onmousedown = e => { dragging=true; lastMX=e.clientX; lastMY=e.clientY }
  canvas.onmousemove = e => {
    if (!dragging) return
    panX+=e.clientX-lastMX; panY+=e.clientY-lastMY
    lastMX=e.clientX; lastMY=e.clientY
    applyTransform()
  }
  canvas.onmouseup = canvas.onmouseleave = () => { dragging=false }
  canvas.onwheel = e => {
    e.preventDefault()
    const rect=canvas.getBoundingClientRect()
    const mx=e.clientX-rect.left, my=e.clientY-rect.top
    const delta=e.deltaY<0?1.1:0.9
    scale=Math.max(0.05,Math.min(8,scale*delta))
    panX=mx-(mx-panX)*delta; panY=my-(my-panY)*delta
    applyTransform()
  }
  canvas.ondblclick = () => { scale=1; panX=0; panY=0; render() }
}

function renderStepList() {
  const el = document.getElementById('steps')
  el.innerHTML = ''
  for (let i=0; i<currentData.steps.length; i++) {
    const s = currentData.steps[i]
    const div = document.createElement('div')
    div.className = 'step'+(i===currentStep?' active':'')
    div.innerHTML = \`<span class="step-num">\${i}.</span><span class="step-name">\${s.name}</span>\`
    div.onclick = () => {
      currentStep=i; activeSegIdx=null; activeGroupId=null; activePath=null; showRealLayout=false
      document.querySelectorAll('.step').forEach((d,j)=>d.classList.toggle('active',j===i))
      scale=1;panX=0;panY=0
      renderSegPanel()
      render()
    }
    el.appendChild(div)
  }
}

function renderPathPanel(step, header, list) {
  const paths = step.paths || []
  const loopCount = paths.filter(p => p.hasLoop).length
  header.textContent = 'Paths — ' + paths.length + (paths.length >= 50 ? '+' : '') + ' found' + (loopCount ? ' · ' + loopCount + ' with loops' : '')
  list.innerHTML = ''

  const allDiv = document.createElement('div')
  allDiv.className = 'seg-item' + (activePath === null ? ' active' : '')
  allDiv.innerHTML = '<div class="seg-title"><span class="seg-dot" style="background:#555"></span>All paths (no highlight)</div>'
  allDiv.onclick = () => { activePath=null; scale=1; panX=0; panY=0; renderSegPanel(); render() }
  list.appendChild(allDiv)

  for (const p of paths) {
    const div = document.createElement('div')
    div.className = 'proc-item' + (activePath === p.index ? ' active' : '')
    div.style.borderLeftColor = activePath === p.index ? '#22d3ee' : 'transparent'
    const loopBadge = p.hasLoop ? '<span class="path-loop-badge">⟲ loop</span>' : ''
    div.innerHTML = '<span class="proc-badge path">P' + (p.index+1) + '</span>'
      + '<div style="min-width:0">'
      + '<div class="proc-label">' + esc(p.startLabel) + ' → ' + esc(p.endLabel) + loopBadge + '</div>'
      + '<div class="proc-meta">' + p.nodeIds.length + ' node(s) · ' + p.edgeIds.length + ' edge(s)</div>'
      + '</div>'
    div.onclick = () => {
      activePath = activePath === p.index ? null : p.index
      scale=1; panX=0; panY=0
      renderSegPanel(); render()
    }
    list.appendChild(div)
  }
}

function renderSegPanel() {
  const step = currentData?.steps[currentStep]
  const segments = step?.segments
  const groups = step?.groups
  const header = document.getElementById('seg-panel-header')
  const list   = document.getElementById('seg-list')

  // Step 7: path panel
  if (step?.paths) { renderPathPanel(step, header, list); return }

  // Steps 5 & 6: process flow panel
  if (step?.processFlow) { renderProcessPanel(step, segments, groups, header, list); return }

  // Step 3+: hierarchical group tree
  if (groups) {
    header.textContent = step.groupLayouts
      ? 'Group Layouts — click to preview'
      : 'Groups — ' + groups.length + ' found'
    list.innerHTML = ''

    const gMap = new Map(groups.map(g => [g.id, g]))
    const segMap = new Map((segments||[]).map((s, i) => [s.id, { seg: s, idx: i }]))
    const topIds = step.topLevelGroupIds || []

    const allDiv = document.createElement('div')
    allDiv.className = 'seg-item' + (activeGroupId===null && activeSegIdx===null ? ' active' : '')
    allDiv.innerHTML = '<div class="seg-title"><span class="seg-dot" style="background:#555"></span>All groups</div>'
    allDiv.onclick = () => { activeGroupId=null; activeSegIdx=null; scale=1; panX=0; panY=0; renderSegPanel(); render() }
    list.appendChild(allDiv)

    function renderGroup(g) {
      const node = document.createElement('div')
      node.className = 'grp-node'

      const hdr = document.createElement('div')
      hdr.className = 'grp-header' + (activeGroupId === g.id ? ' active' : '')
      const badgeCls = g.kind === 'gateway-pair' ? 'gw' : 'ev'
      const badgeTxt = g.kind === 'gateway-pair' ? 'GW' : 'EV'
      hdr.innerHTML = '<span class="grp-badge ' + badgeCls + '">' + badgeTxt + '</span>'
        + '<span class="grp-label">' + esc(g.label || g.id) + '</span>'
      hdr.onclick = () => {
        activeGroupId = activeGroupId === g.id ? null : g.id
        activeSegIdx = null
        scale=1; panX=0; panY=0
        renderSegPanel(); render()
      }
      node.appendChild(hdr)

      const childWrap = document.createElement('div')
      childWrap.className = 'grp-children'
      let hasChildren = false

      for (const segId of (g.segmentIds || [])) {
        const entry = segMap.get(segId)
        if (!entry) continue
        const { seg, idx } = entry
        const col = segColor(idx)
        const item = document.createElement('div')
        item.className = 'grp-seg-item' + (activeSegIdx === idx ? ' active' : '')
        item.style.borderLeftColor = activeSegIdx === idx ? col : 'transparent'
        item.innerHTML = '<span class="grp-seg-dot" style="background:' + col + '"></span>'
          + '<span class="grp-seg-id">' + esc(segId) + '&thinsp;</span>'
          + '<span class="grp-seg-label">' + esc(seg.label || '') + '</span>'
        item.onclick = (e) => {
          e.stopPropagation()
          activeSegIdx = activeSegIdx === idx ? null : idx
          activeGroupId = null
          renderSegPanel(); render()
        }
        childWrap.appendChild(item)
        hasChildren = true
      }

      for (const cId of (g.childGroupIds || [])) {
        const child = gMap.get(cId)
        if (child) { childWrap.appendChild(renderGroup(child)); hasChildren = true }
      }

      if (hasChildren) node.appendChild(childWrap)
      return node
    }

    for (const gId of topIds) {
      const g = gMap.get(gId)
      if (g) list.appendChild(renderGroup(g))
    }
    return
  }

  // Steps 0-2: flat segment list
  if (!segments || segments.length === 0) {
    header.textContent = 'Segments — none in this step'
    list.innerHTML = '<div style="padding:12px;color:#333;font-size:11px">No segments computed yet.</div>'
    return
  }

  header.textContent = 'Segments — ' + segments.length + ' found'
  list.innerHTML = ''

  const allDiv = document.createElement('div')
  allDiv.className = 'seg-item'+(activeSegIdx===null?' active':'')
  allDiv.innerHTML = '<div class="seg-title"><span class="seg-dot" style="background:#555"></span>All segments</div>'
  allDiv.onclick = () => { activeSegIdx=null; renderSegPanel(); render() }
  list.appendChild(allDiv)

  segments.forEach((seg, si) => {
    const col = segColor(si)
    const div = document.createElement('div')
    div.className = 'seg-item'+(activeSegIdx===si?' active':'')
    div.style.borderLeftColor = activeSegIdx===si ? col : 'transparent'
    div.innerHTML = '<div class="seg-title">'
      + '<span class="seg-dot" style="background:' + col + '"></span>'
      + '<span>' + esc(seg.id) + '</span>'
      + '<span style="color:#444;font-size:10px">' + esc(seg.kind) + '</span>'
      + '</div>'
      + '<div class="seg-meta">' + seg.nodeIds.length + ' node(s) · ~' + seg.estimatedWidth + '×' + seg.estimatedHeight + 'px</div>'
      + '<div class="seg-nodes">' + esc(seg.label || '') + '</div>'
    div.onclick = () => {
      activeSegIdx = activeSegIdx===si ? null : si
      renderSegPanel()
      render()
    }
    list.appendChild(div)
  })
}

function renderProcessPanel(step, segments, groups, header, list) {
  const pf = step.processFlow
  const hasLayout = !!step.processLayout
  header.textContent = hasLayout ? 'Process Layout — click to preview' : 'Process Flow — ' + pf.length + ' element(s)'
  list.innerHTML = ''

  const segMap = new Map((segments||[]).map((s, i) => [s.id, { seg: s, idx: i }]))
  const gMap   = new Map((groups||[]).map(g => [g.id, g]))

  // "All" item
  const allDiv = document.createElement('div')
  allDiv.className = 'seg-item' + (activeGroupId===null && activeSegIdx===null ? ' active' : '')
  allDiv.innerHTML = '<div class="seg-title"><span class="seg-dot" style="background:#555"></span>All process elements</div>'
  allDiv.onclick = () => { activeGroupId=null; activeSegIdx=null; scale=1; panX=0; panY=0; renderSegPanel(); render() }
  list.appendChild(allDiv)

  for (const el of pf) {
    const div = document.createElement('div')
    div.className = 'proc-item'

    if (el.kind === 'segment') {
      const entry = segMap.get(el.id)
      const idx = entry?.idx ?? -1
      const isActive = activeSegIdx === idx
      div.classList.toggle('active', isActive)
      div.style.borderLeftColor = isActive ? '#60a5fa' : 'transparent'
      div.innerHTML = '<span class="proc-badge cs">CS</span><div>'
        + '<div class="proc-label">' + esc(el.label || el.id) + '</div>'
        + (entry ? '<div class="proc-meta">' + (entry.seg.nodeIds?.length ?? 0) + ' node(s) · ~' + (entry.seg.estimatedWidth ?? 0) + '×' + (entry.seg.estimatedHeight ?? 0) + 'px</div>' : '')
        + '</div>'
      div.onclick = () => {
        activeSegIdx = isActive ? null : idx
        activeGroupId = null; scale=1; panX=0; panY=0
        renderSegPanel(); render()
      }
    } else {
      const g = gMap.get(el.id)
      const badgeCls = g?.kind === 'gateway-pair' ? 'gw' : 'ev'
      const badgeTxt = g?.kind === 'gateway-pair' ? 'GW' : 'EV'
      const isActive = activeGroupId === el.id
      div.classList.toggle('active', isActive)
      div.style.borderLeftColor = isActive ? (g?.kind === 'gateway-pair' ? '#eab308' : '#a78bfa') : 'transparent'

      // Group header row
      const hdr = document.createElement('div')
      hdr.className = 'proc-item' + (isActive ? ' active' : '')
      hdr.style.padding = '0'; hdr.style.borderLeft = 'none'
      hdr.innerHTML = '<span class="proc-badge ' + badgeCls + '">' + badgeTxt + '</span>'
        + '<span class="proc-label">' + esc(el.label || el.id) + '</span>'
      div.appendChild(hdr)

      // Inline child groups if present (one level deep)
      if (g?.childGroupIds?.length > 0) {
        const kids = document.createElement('div')
        kids.style.cssText = 'padding-left:16px;border-left:1px solid #1e1e30;margin-left:14px'
        for (const cId of g.childGroupIds) {
          const cg = gMap.get(cId)
          if (!cg) continue
          const cbadgeCls = cg.kind === 'gateway-pair' ? 'gw' : 'ev'
          const cgEl = pf.find(e => e.id === cId)
          const kidDiv = document.createElement('div')
          kidDiv.className = 'proc-item'
          kidDiv.style.borderLeftColor = 'transparent'
          kidDiv.innerHTML = '<span class="proc-badge ' + cbadgeCls + '">' + (cg.kind === 'gateway-pair' ? 'GW' : 'EV') + '</span>'
            + '<span class="proc-label">' + esc(cgEl?.label || cId) + '</span>'
          kidDiv.onclick = (e) => {
            e.stopPropagation()
            activeGroupId = activeGroupId === cId ? null : cId
            activeSegIdx = null; scale=1; panX=0; panY=0
            renderSegPanel(); render()
          }
          kids.appendChild(kidDiv)
        }
        div.appendChild(kids)
      }

      div.onclick = () => {
        activeGroupId = isActive ? null : el.id
        activeSegIdx = null; scale=1; panX=0; panY=0
        renderSegPanel(); render()
      }
    }

    list.appendChild(div)
  }
}

function loadAndRender() {
  fetch('/data').then(r=>r.json()).then(data=>{
    currentData = data
    if (data.error) { render(); return }
    renderStepList()
    activeSegIdx=null; activeGroupId=null; activePath=null; showRealLayout=false
    renderSegPanel()
    scale=1;panX=0;panY=0
    render()
  }).catch(err=>{
    document.getElementById('canvas').innerHTML=\`<div class="error">\${err}</div>\`
  })
}

loadAndRender()

const es = new EventSource('/events')
es.onmessage = () => loadAndRender()
es.onerror = () => { const h=document.getElementById('header'); if(h) h.className='stale' }
`

// ── Page ───────────────────────────────────────────────────────────────────────

function buildPage() {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>v3 Layout — ${inputArg}</title>
<style>${CSS}</style>
</head>
<body>
<div id="header">
  <span class="title">v3 Layout Pipeline</span>
  <span>${inputArg}</span>
  <span style="margin-left:auto;color:#333">scroll=zoom · drag=pan · dblclick=reset</span>
</div>
<div id="body">
  <div id="steps"></div>
  <div id="main">
    <div id="desc"><span id="desc-text"></span><button id="view-toggle">boxes</button></div>
    <div id="canvas"></div>
  </div>
  <div id="seg-panel">
    <div id="seg-panel-header">Segments</div>
    <div id="seg-list"></div>
  </div>
</div>
<script>${CLIENT_JS}</script>
</body>
</html>`
}

// ── HTTP server ────────────────────────────────────────────────────────────────

const PORT = 3465

createServer((req, res) => {
	if (req.url === "/events") {
		res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" })
		res.write(":connected\n\n")
		clients.add(res)
		req.on("close", () => clients.delete(res))
		return
	}
	if (req.url === "/data") {
		res.writeHead(200, { "Content-Type": "application/json" })
		res.end(JSON.stringify(getData()))
		return
	}
	res.writeHead(200, { "Content-Type": "text/html" })
	res.end(buildPage())
}).listen(PORT, () => {
	console.log(`v3 Layout visualizer → http://localhost:${PORT}`)
	console.log(`Watching             → ${inputPath}`)
})
