#!/usr/bin/env node
/**
 * Interactive pipeline visualizer for the BPMN v2 layout engine.
 * Click a step in the left panel to see the graph state at that point.
 *
 * Usage:
 *   node packages/core/scripts/layout-viz-server.mjs <file.bpmn>
 */
import { createServer } from "node:http"
import { readFileSync, watch } from "node:fs"
import { resolve } from "node:path"
import { Bpmn } from "../dist/index.js"
import { detectBackEdges, makeDAG } from "../dist/layout/v2/dag.js"
import { alignGatewayPairs, assignLayers, injectDummies, injectVirtualSpacers } from "../dist/layout/v2/layers.js"
import {
	assignCoordinates,
	assignTracks,
	reassignGatewayBranchTracks,
	repositionGatewayBranches,
} from "../dist/layout/v2/grid.js"
import { identifyTrunk } from "../dist/layout/v2/trunk.js"
import { assignPorts } from "../dist/layout/v2/ports.js"
import { routeAllEdges } from "../dist/layout/v2/router.js"
import { V2Graph } from "../dist/layout/v2/graph.js"
import { ELEMENT_SIZES } from "../dist/layout/types.js"

const [, , inputArg] = process.argv
if (!inputArg) {
	console.error("Usage: node layout-viz-server.mjs <file.bpmn>")
	process.exit(1)
}
const inputPath = resolve(process.cwd(), inputArg)

// ── Helpers ────────────────────────────────────────────────────────────────────

function getSize(type) {
	return ELEMENT_SIZES[type] ?? { width: 100, height: 80 }
}

function buildV2Graph(flowNodes, sequenceFlows) {
	const graph = new V2Graph()
	const nodeIndex = new Map()
	for (const n of flowNodes) {
		nodeIndex.set(n.id, n)
		const size = getSize(n.type)
		graph.addNode({
			id: n.id,
			type: n.type,
			...size,
			x: 0,
			y: 0,
			layer: 0,
			track: 2,
			isTrunk: false,
			isBackEdgeSource: false,
			isDummy: false,
			label: n.name ?? undefined,
		})
	}
	for (const f of sequenceFlows) {
		graph.addEdge({
			id: f.id,
			sourceId: f.sourceRef,
			targetId: f.targetRef,
			isBackEdge: false,
			waypoints: [],
			label: f.name ?? undefined,
		})
	}
	return { graph, nodeIndex }
}

function snapNodes(graph) {
	return [...graph.nodes.values()].map((n) => ({
		id: n.id,
		type: n.type,
		x: n.x,
		y: n.y,
		width: n.width,
		height: n.height,
		layer: n.layer,
		track: n.track,
		isDummy: n.isDummy,
		isTrunk: n.isTrunk,
		isBackEdgeSource: n.isBackEdgeSource,
		label: n.label ?? null,
	}))
}

function snapEdges(graph, backEdgeIds) {
	return [...graph.edges.values()].map((e) => ({
		id: e.id,
		sourceId: e.sourceId,
		targetId: e.targetId,
		isBackEdge: backEdgeIds ? backEdgeIds.has(e.id) : e.isBackEdge,
		waypoints: e.waypoints.map((p) => ({ x: p.x, y: p.y })),
		label: e.label ?? null,
	}))
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
		const add = (name, desc, nodes, edges, extra = {}) =>
			steps.push({ name, desc, nodes, edges, ...extra })

		// Step 0 — raw BPMN
		add(
			"BPMN Parsed",
			`${flowNodes.length} flow elements, ${sequenceFlows.length} sequence flows parsed from XML.`,
			flowNodes.map((n) => ({
				id: n.id,
				type: n.type,
				label: n.name ?? null,
				x: 0,
				y: 0,
				...getSize(n.type),
				layer: 0,
				track: 2,
				isDummy: false,
				isTrunk: false,
				isBackEdgeSource: false,
			})),
			sequenceFlows.map((f) => ({
				id: f.id,
				sourceId: f.sourceRef,
				targetId: f.targetRef,
				isBackEdge: false,
				waypoints: [],
				label: f.name ?? null,
			})),
		)

		// Step 1 — V2Graph
		const { graph, nodeIndex } = buildV2Graph(flowNodes, sequenceFlows)
		add(
			"V2Graph Built",
			`Internal graph: ${graph.nodes.size} nodes, ${graph.edges.size} edges. Nodes have default positions (0,0) and track 2.`,
			snapNodes(graph),
			snapEdges(graph),
		)

		// Step 2 — back-edge detection
		const backEdges = detectBackEdges(graph)
		const backEdgeIds = new Set(backEdges.map((b) => b.edgeId))
		add(
			"Back-edges Detected",
			`${backEdges.length} back-edge(s) found — loop edges that create cycles (shown in orange). Must be handled before layer assignment.`,
			snapNodes(graph),
			snapEdges(graph, backEdgeIds),
		)

		// Step 3 — DAG
		const dag = makeDAG(graph, backEdges)
		add(
			"DAG Created",
			"Back-edges reversed/removed to produce a directed acyclic graph. Reversed edges get a '__rev' suffix and flow opposite direction.",
			snapNodes(dag),
			snapEdges(dag, backEdgeIds),
		)

		// Step 4 — trunk
		const trunkIds = identifyTrunk(dag, nodeIndex, sequenceFlows)
		add(
			"Trunk Identified",
			`${trunkIds.size} trunk nodes found (highlighted blue) — the main happy-path from start to end, used as the center spine.`,
			snapNodes(dag).map((n) => ({ ...n, isTrunk: trunkIds.has(n.id) })),
			snapEdges(dag, backEdgeIds),
		)

		// Step 5 — layers
		assignLayers(dag)
		add(
			"Layers Assigned",
			"Each node placed into a column (layer) by longest-path from the start node. Layer determines X position.",
			snapNodes(dag),
			snapEdges(dag, backEdgeIds),
		)

		// Step 6 — gateway pair alignment
		alignGatewayPairs(dag, nodeIndex)
		add(
			"Gateway Pairs Aligned",
			"Split and join gateways adjusted so their layers match their counterpart. Ensures branch paths align horizontally.",
			snapNodes(dag),
			snapEdges(dag, backEdgeIds),
		)

		// Step 7 — virtual spacers
		injectVirtualSpacers(dag)
		add(
			"Virtual Spacers Injected",
			"Width-only dummy nodes added for direct split→join edges (Rule 2) to enforce minimum lane width.",
			snapNodes(dag),
			snapEdges(dag, backEdgeIds),
		)

		// Step 8 — dummy nodes (augmented graph)
		const aug = injectDummies(dag)
		for (const [, e] of graph.edges) {
			if (!aug.edges.has(e.id)) aug.addEdge(e)
		}
		add(
			"Dummy Nodes Injected",
			`Multi-span edges split into per-layer segments via dummy nodes. Total: ${aug.nodes.size} nodes (real + dummies). Dummies shown as dots.`,
			snapNodes(aug),
			snapEdges(aug, backEdgeIds),
		)

		// Step 9a — track assignment
		assignTracks(aug, trunkIds, backEdgeIds, sequenceFlows, nodeIndex)
		add(
			"Tracks Assigned",
			"Nodes assigned to Y-bands: Track 2 = trunk (center), Track 1 = back-edge sources, Track 3 = alternates, Track 4 = rejection paths.",
			snapNodes(aug),
			snapEdges(aug, backEdgeIds),
		)

		// Step 9b — gateway branch track reassignment
		reassignGatewayBranchTracks(aug)
		add(
			"Branch Tracks Reassigned",
			"Within each gateway pair, branches sorted by node count. Longest branch takes the split's track; others cascade to higher tracks.",
			snapNodes(aug),
			snapEdges(aug, backEdgeIds),
		)

		// Step 10 — coordinates
		assignCoordinates(aug)
		add(
			"Coordinates Assigned",
			"Actual pixel X/Y computed: X from layer index, Y from track band (TRACK_Y). First fully-positioned step.",
			snapNodes(aug),
			snapEdges(aug, backEdgeIds),
			{ hasCoords: true },
		)

		// Step 11 — branch repositioning
		repositionGatewayBranches(aug)
		add(
			"Branches Repositioned",
			"Branch bounding boxes centered symmetrically around their gateway's Y. Longest branch sits at gateway Y, shorter branches above/below.",
			snapNodes(aug),
			snapEdges(aug, backEdgeIds),
			{ hasCoords: true },
		)

		// Step 12 — port assignment
		const ports = assignPorts(aug)
		// Serialize ports: Map<edgeId, PortAssignment> → plain object
		const portsObj = {}
		for (const [edgeId, pa] of ports) {
			portsObj[edgeId] = {
				source: { x: pa.source.x, y: pa.source.y },
				target: { x: pa.target.x, y: pa.target.y },
			}
		}
		add(
			"Ports Assigned",
			"Connection anchors placed on node sides. Each edge gets a source and target port. Ports shown as small squares.",
			snapNodes(aug),
			snapEdges(aug, backEdgeIds),
			{ hasCoords: true, ports: portsObj },
		)

		// Step 13 — edge routing
		routeAllEdges(aug, ports)
		add(
			"Edges Routed",
			"Orthogonal edge paths computed with waypoints. Back-edges rendered as dashed orange. Layout complete.",
			snapNodes(aug),
			snapEdges(aug, backEdgeIds),
			{ hasCoords: true, ports: portsObj },
		)

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

/* ── step list ───────────────────────────────────────────────────────────────── */
#steps {
  flex: 0 0 220px;
  overflow-y: auto;
  border-right: 1px solid #1e1e30;
  padding: 8px 0;
}
.step {
  padding: 7px 12px;
  cursor: pointer;
  border-left: 3px solid transparent;
  line-height: 1.3;
  transition: background 0.1s;
}
.step:hover { background: #131320; }
.step.active { border-left-color: #6b9df7; background: #0f1525; color: #cdd6f4; }
.step-num { color: #555; font-size: 10px; margin-right: 4px; }
.step-name { font-size: 11px; }

/* ── main area ───────────────────────────────────────────────────────────────── */
#main { flex: 1 1 0; display: flex; flex-direction: column; overflow: hidden; }

#desc {
  flex: 0 0 auto;
  padding: 8px 14px;
  background: #0d0d1a;
  border-bottom: 1px solid #1a1a28;
  font-size: 11px;
  color: #6666a0;
  min-height: 32px;
}

#canvas {
  flex: 1 1 0;
  overflow: hidden;
  position: relative;
  cursor: grab;
  user-select: none;
}
#canvas:active { cursor: grabbing; }
#canvas svg { position: absolute; top: 0; left: 0; }

/* ── legend ──────────────────────────────────────────────────────────────────── */
#legend {
  flex: 0 0 auto;
  padding: 4px 14px;
  background: #0d0d1a;
  border-top: 1px solid #1a1a28;
  display: flex; gap: 14px; flex-wrap: wrap;
  font-size: 10px; color: #444;
}
.leg { display: flex; align-items: center; gap: 4px; }
.leg-box { width: 10px; height: 10px; border-radius: 2px; }
.error { color: #f87171; padding: 20px; }
`

// ── Client JS ─────────────────────────────────────────────────────────────────

const CLIENT_JS = /* js */ `
// ── Constants ─────────────────────────────────────────────────────────────────
const TRACK_Y = { 0: 40, 1: 160, 2: 360, 3: 560, 4: 760, 5: 960 }
const LAYER_STEP = 170

// ── Helpers ───────────────────────────────────────────────────────────────────
function isEvent(t) { return t && t.includes('Event') }
function isGateway(t) { return t && t.includes('Gateway') }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function nodeColor(n) {
  if (n.isDummy) return 'none'
  if (n.isTrunk) return '#0d1a30'
  if (n.isBackEdgeSource) return '#1a0d00'
  if (isEvent(n.type)) return n.type.startsWith('start') ? '#0d2010' : '#200d10'
  if (isGateway(n.type)) return '#1a1a00'
  return '#111120'
}
function nodeStroke(n) {
  if (n.isDummy) return 'none'
  if (n.isTrunk) return '#3b82f6'
  if (n.isBackEdgeSource) return '#f97316'
  if (isEvent(n.type)) return n.type.startsWith('start') ? '#22c55e' : '#ef4444'
  if (isGateway(n.type)) return '#eab308'
  return '#3a3a5a'
}
function trackColor(track) {
  const map = { 0:'#1a1a30', 1:'#2a1a00', 2:'#001a10', 3:'#1a001a', 4:'#1a0000', 5:'#001a1a' }
  return map[track] || '#1a1a1a'
}

function virtualXY(n) {
  const ty = TRACK_Y[n.track] ?? 360
  return { x: n.layer * LAYER_STEP + 60, y: ty - n.height / 2 }
}
function nodeXY(n, hasCoords) {
  return hasCoords ? { x: n.x, y: n.y } : virtualXY(n)
}
function nodeCX(n, hasCoords) {
  const { x } = nodeXY(n, hasCoords)
  return x + n.width / 2
}
function nodeCY(n, hasCoords) {
  const { y } = nodeXY(n, hasCoords)
  return y + n.height / 2
}

// ── SVG primitives ────────────────────────────────────────────────────────────
function svgNode(n, hasCoords) {
  if (n.isDummy) {
    const { x, y } = nodeXY(n, hasCoords)
    const cx = x + n.width / 2, cy = y + n.height / 2
    return \`<circle cx="\${cx}" cy="\${cy}" r="3" fill="#2a2a3a" opacity="0.6"/>\`
  }
  const { x, y } = nodeXY(n, hasCoords)
  const w = n.width, h = n.height
  const cx = x + w/2, cy = y + h/2
  const fill = nodeColor(n), stroke = nodeStroke(n)
  let shape
  if (isEvent(n.type)) {
    const r = Math.min(w, h) / 2
    shape = \`<circle cx="\${cx}" cy="\${cy}" r="\${r}" fill="\${fill}" stroke="\${stroke}" stroke-width="1.5"/>\`
  } else if (isGateway(n.type)) {
    shape = \`<polygon points="\${cx},\${y} \${x+w},\${cy} \${cx},\${y+h} \${x},\${cy}" fill="\${fill}" stroke="\${stroke}" stroke-width="1.5"/>\`
  } else {
    shape = \`<rect x="\${x}" y="\${y}" width="\${w}" height="\${h}" rx="4" fill="\${fill}" stroke="\${stroke}" stroke-width="1"/>\`
  }

  // Label
  let label = ''
  if (n.label) {
    const maxChars = Math.max(12, Math.floor(w / 7))
    const words = n.label.split(' ')
    const lines = []
    let line = ''
    for (const wd of words) {
      if (line && (line + ' ' + wd).length > maxChars) { lines.push(line); line = wd }
      else line = line ? line + ' ' + wd : wd
    }
    if (line) lines.push(line)
    const small = isEvent(n.type) || isGateway(n.type)
    const baseY = small ? y + h + 14 : cy - (lines.length - 1) * 7
    const anchor = 'middle'
    label = lines.map((l, i) =>
      \`<text x="\${cx}" y="\${baseY + i * 14}" text-anchor="\${anchor}" font-size="10" fill="#888" font-family="monospace" pointer-events="none">\${esc(l)}</text>\`
    ).join('')
  }
  return shape + label
}

function svgEdge(e, nodeMap, hasCoords) {
  if (e.waypoints.length >= 2) {
    const pts = e.waypoints.map(p => \`\${p.x},\${p.y}\`).join(' ')
    const stroke = e.isBackEdge ? '#f97316' : '#3a3a5a'
    const dash = e.isBackEdge ? '5,3' : 'none'
    return \`<polyline points="\${pts}" fill="none" stroke="\${stroke}" stroke-width="1" stroke-dasharray="\${dash}" marker-end="url(#arr\${e.isBackEdge?'-back':''})"/>\`
  }
  const src = nodeMap.get(e.sourceId), tgt = nodeMap.get(e.targetId)
  if (!src || !tgt) return ''
  const sx = nodeCX(src, hasCoords), sy = nodeCY(src, hasCoords)
  const tx = nodeCX(tgt, hasCoords), ty = nodeCY(tgt, hasCoords)
  const mx = (sx + tx) / 2
  const stroke = e.isBackEdge ? '#f97316' : '#2e2e4a'
  const dash = e.isBackEdge ? '5,3' : 'none'
  return \`<path d="M\${sx},\${sy} C\${mx},\${sy} \${mx},\${ty} \${tx},\${ty}" fill="none" stroke="\${stroke}" stroke-width="1" stroke-dasharray="\${dash}" marker-end="url(#arr\${e.isBackEdge?'-back':''})"/>\`
}

function svgPorts(ports, nodeMap, hasCoords) {
  if (!ports) return ''
  let out = ''
  for (const pa of Object.values(ports)) {
    out += \`<rect x="\${pa.source.x - 3}" y="\${pa.source.y - 3}" width="6" height="6" fill="#6b9df7" opacity="0.7" rx="1"/>\`
    out += \`<rect x="\${pa.target.x - 3}" y="\${pa.target.y - 3}" width="6" height="6" fill="#4ade80" opacity="0.7" rx="1"/>\`
  }
  return out
}

// ── Render ────────────────────────────────────────────────────────────────────
let currentData = null
let currentStep = 0
let scale = 1, panX = 0, panY = 0
let dragging = false, lastMX = 0, lastMY = 0

function render() {
  const data = currentData
  const canvas = document.getElementById('canvas')
  if (!data || data.error) {
    canvas.innerHTML = \`<div class="error">\${data?.error || 'Loading...'}</div>\`
    return
  }

  const step = data.steps[currentStep]
  if (!step) return

  document.getElementById('desc').textContent = step.desc || ''

  const hasCoords = !!step.hasCoords
  const nodes = step.nodes || []
  const edges = step.edges || []
  const ports = step.ports || null
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // Compute bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.isDummy && !hasCoords) continue
    const { x, y } = nodeXY(n, hasCoords)
    const labelH = (n.label && (isEvent(n.type) || isGateway(n.type))) ? 40 : 0
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + n.width)
    maxY = Math.max(maxY, y + n.height + labelH)
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 400; maxY = 300 }
  const pad = 60
  minX -= pad; minY -= pad; maxX += pad; maxY += pad

  const W = maxX - minX, H = maxY - minY
  const canvasW = canvas.clientWidth || 800
  const canvasH = canvas.clientHeight || 600

  // Compute initial fit scale once when data/step changes
  const fitScale = Math.min(canvasW / W, canvasH / H, 1)

  let svgBody = ''

  // Defs: arrow markers
  svgBody += \`<defs>
    <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
      <path d="M0,0 L0,7 L7,3.5 z" fill="#3a3a5a"/>
    </marker>
    <marker id="arr-back" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
      <path d="M0,0 L0,7 L7,3.5 z" fill="#f97316"/>
    </marker>
  </defs>\`

  // Background track/layer guides
  if (!hasCoords) {
    // Track bands
    for (const [track, ty] of Object.entries(TRACK_Y)) {
      const bandH = 100
      svgBody += \`<rect x="\${minX}" y="\${ty - bandH/2}" width="\${W}" height="\${bandH}" fill="\${trackColor(Number(track))}" opacity="0.3"/>\`
      svgBody += \`<text x="\${minX + 8}" y="\${ty - 4}" font-size="9" fill="#333" font-family="monospace">T\${track}</text>\`
    }
    // Layer columns
    const layers = [...new Set(nodes.map(n => n.layer))].sort((a,b) => a - b)
    for (const layer of layers) {
      const lx = layer * LAYER_STEP + 60
      svgBody += \`<line x1="\${lx - LAYER_STEP/2}" y1="\${minY}" x2="\${lx - LAYER_STEP/2}" y2="\${maxY}" stroke="#1a1a28" stroke-width="1"/>\`
      svgBody += \`<text x="\${lx}" y="\${minY + 16}" text-anchor="middle" font-size="9" fill="#333" font-family="monospace">L\${layer}</text>\`
    }
  }

  // Edges (drawn first, under nodes)
  for (const e of edges) {
    svgBody += svgEdge(e, nodeMap, hasCoords)
  }

  // Ports (under nodes, over edges)
  svgBody += svgPorts(ports, nodeMap, hasCoords)

  // Nodes (drawn last, on top)
  for (const n of nodes) {
    svgBody += svgNode(n, hasCoords)
  }

  const svgEl = \`<svg xmlns="http://www.w3.org/2000/svg" width="\${canvasW}" height="\${canvasH}" style="background:#0a0a12">
    <g id="diagram" transform="translate(\${panX},\${panY}) scale(\${scale})">\${svgBody}</g>
  </svg>\`

  canvas.innerHTML = svgEl

  // Fit on first render
  if (scale === 1 && panX === 0 && panY === 0) {
    scale = fitScale
    panX = (canvasW - W * scale) / 2 - minX * scale
    panY = (canvasH - H * scale) / 2 - minY * scale
    applyTransform()
  }

  setupPanZoom(canvas)
}

function applyTransform() {
  const g = document.getElementById('diagram')
  if (g) g.setAttribute('transform', \`translate(\${panX},\${panY}) scale(\${scale})\`)
}

function setupPanZoom(canvas) {
  canvas.onmousedown = (e) => { dragging = true; lastMX = e.clientX; lastMY = e.clientY }
  canvas.onmousemove = (e) => {
    if (!dragging) return
    panX += e.clientX - lastMX
    panY += e.clientY - lastMY
    lastMX = e.clientX; lastMY = e.clientY
    applyTransform()
  }
  canvas.onmouseup = canvas.onmouseleave = () => { dragging = false }
  canvas.onwheel = (e) => {
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const delta = e.deltaY < 0 ? 1.1 : 0.9
    scale = Math.max(0.05, Math.min(8, scale * delta))
    panX = mx - (mx - panX) * delta
    panY = my - (my - panY) * delta
    applyTransform()
  }
  canvas.ondblclick = () => { scale = 1; panX = 0; panY = 0; render() }
}

function renderStepList(data) {
  const el = document.getElementById('steps')
  el.innerHTML = ''
  for (let i = 0; i < data.steps.length; i++) {
    const s = data.steps[i]
    const div = document.createElement('div')
    div.className = 'step' + (i === currentStep ? ' active' : '')
    div.innerHTML = \`<span class="step-num">\${i}.</span><span class="step-name">\${s.name}</span>\`
    div.onclick = () => {
      currentStep = i
      document.querySelectorAll('.step').forEach((d, j) => d.classList.toggle('active', j === i))
      scale = 1; panX = 0; panY = 0
      render()
    }
    el.appendChild(div)
  }
}

function loadAndRender() {
  fetch('/data').then(r => r.json()).then(data => {
    currentData = data
    if (data.error) { render(); return }
    renderStepList(data)
    scale = 1; panX = 0; panY = 0
    render()
  }).catch(err => {
    document.getElementById('canvas').innerHTML = \`<div class="error">\${err}\</div>\`
  })
}

loadAndRender()

const es = new EventSource('/events')
es.onmessage = () => loadAndRender()
es.onerror = () => { const h = document.getElementById('header'); if(h) h.className='stale' }
`

// ── Page ───────────────────────────────────────────────────────────────────────

function buildPage() {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Layout Pipeline — ${inputArg}</title>
<style>${CSS}</style>
</head>
<body>
<div id="header">
  <span class="title">v2 Layout Pipeline Visualizer</span>
  <span>${inputArg}</span>
  <span style="margin-left:auto;color:#333">scroll=zoom · drag=pan · dblclick=reset</span>
</div>
<div id="body">
  <div id="steps"></div>
  <div id="main">
    <div id="desc"></div>
    <div id="canvas"></div>
    <div id="legend">
      <span class="leg"><span class="leg-box" style="background:#22c55e;border:1px solid #22c55e"></span>start event</span>
      <span class="leg"><span class="leg-box" style="background:#ef4444;border:1px solid #ef4444"></span>end event</span>
      <span class="leg"><span class="leg-box" style="background:#eab308;border:1px solid #eab308"></span>gateway</span>
      <span class="leg"><span class="leg-box" style="background:#3b82f6;border:1px solid #3b82f6"></span>trunk</span>
      <span class="leg"><span class="leg-box" style="background:#f97316;border:1px solid #f97316"></span>back-edge / loop</span>
      <span class="leg"><span class="leg-box" style="background:#3a3a5a;border:1px solid #3a3a5a"></span>task</span>
      <span class="leg"><span class="leg-box" style="background:#2a2a3a;border:1px solid #2a2a3a"></span>dummy</span>
      <span style="margin-left:auto;color:#2a2a4a">T0-5 = track bands · L0,1… = layers</span>
    </div>
  </div>
</div>
<script>${CLIENT_JS}</script>
</body>
</html>`
}

// ── HTTP server ────────────────────────────────────────────────────────────────

const PORT = 3457

createServer((req, res) => {
	if (req.url === "/events") {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		})
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
	console.log(`Pipeline visualizer → http://localhost:${PORT}`)
	console.log(`Watching            → ${inputPath}`)
})
