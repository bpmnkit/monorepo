#!/usr/bin/env node
/**
 * Live-reloading browser visualizer for the BPMN process tree.
 *
 * Usage:
 *   node packages/core/scripts/tree-server.mjs <file.bpmn>
 *
 * Level 0  — full spine from startEvent to endEvent(s), gateway pairs collapsed
 * Level N  — branches inside each collapsed gateway pair
 * Leaf     — endEvent, or a gateway pair with no nested pairs
 */
import { createServer } from "node:http"
import { readFileSync, watch } from "node:fs"
import { resolve } from "node:path"
import { Bpmn } from "../dist/index.js"
import { layoutV2WithTree } from "../dist/layout/v2/engine.js"

const [, , inputArg] = process.argv
if (!inputArg) {
	console.error("Usage: node tree-server.mjs <file.bpmn>")
	process.exit(1)
}
const inputPath = resolve(process.cwd(), inputArg)

// ── Data ───────────────────────────────────────────────────────────────────────

function getData() {
	try {
		const xml = readFileSync(inputPath, "utf8")
		const defs = Bpmn.parse(xml)
		const proc = defs.processes[0]
		if (!proc) return { error: "No process found in BPMN file" }
		const { tree } = layoutV2WithTree(
			proc.flowElements,
			proc.sequenceFlows,
			proc.textAnnotations ?? [],
			proc.associations ?? [],
		)
		return {
			tree,
			nodes: proc.flowElements.map((n) => ({ id: n.id, type: n.type, name: n.name ?? null })),
			flows: proc.sequenceFlows.map((f) => ({
				sourceRef: f.sourceRef,
				targetRef: f.targetRef,
			})),
		}
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

// ── Client JS (embedded in page) ───────────────────────────────────────────────

const CLIENT_JS = /* js */ `
// ── helpers ──────────────────────────────────────────────────────────────────

function buildAdj(flows) {
  const m = new Map()
  for (const f of flows) {
    if (!m.has(f.sourceRef)) m.set(f.sourceRef, [])
    m.get(f.sourceRef).push(f.targetRef)
  }
  return m
}

// Pairs directly nested inside 'pair' (not nested inside another nested pair).
function directlyNested(pair, allPairs) {
  const cands = allPairs.filter(p => pair.nestedPairSplitIds.includes(p.splitId))
  const grandchildIds = new Set(cands.flatMap(c => c.nestedPairSplitIds))
  return cands.filter(c => !grandchildIds.has(c.splitId))
}

function directlyNestedInBranch(branch, dn) {
  return dn.filter(np => branch.nodeIds.includes(np.splitId))
}

function mkEl(tag, cls, text) {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  if (text != null) el.textContent = String(text)
  return el
}

// ── Build the level-0 spine ───────────────────────────────────────────────────
//
// Returns [{kind:'node', node}, {kind:'group', pair}, …] from startEvent to
// the reachable end of the process.  Gateway pairs are collapsed to a single
// group item; we jump from split directly to join's successor.

function buildSpine(data) {
  const { tree, nodes, flows } = data
  const adj = buildAdj(flows)
  const nodeById = new Map(nodes.map(n => [n.id, n]))

  const allNestedSplits = new Set(tree.flatMap(p => p.nestedPairSplitIds))
  const topLevelPairs   = tree.filter(p => !allNestedSplits.has(p.splitId))
  const pairBySplit     = new Map(topLevelPairs.map(p => [p.splitId, p]))

  const start = nodes.find(n => n.type === 'startEvent')
  if (!start) return []

  const spine   = []
  const visited = new Set()
  let   cur     = start.id

  while (cur && !visited.has(cur)) {
    visited.add(cur)
    const pair = pairBySplit.get(cur)
    if (pair) {
      spine.push({ kind: 'group', pair })
      cur = (adj.get(pair.joinId) ?? [])[0] ?? null
    } else {
      const node = nodeById.get(cur)
      if (node) spine.push({ kind: 'node', node })
      cur = (adj.get(cur) ?? [])[0] ?? null
    }
  }
  return spine
}

// ── Build items within one branch ─────────────────────────────────────────────
//
// DFS from startId, stopping at joinId.  Directly nested pairs are collapsed
// to group items; their inner content is not traversed here.

function buildBranchItems(startId, joinId, adj, directNestedPairs, nodeById) {
  const nestedBySplit = new Map(directNestedPairs.map(p => [p.splitId, p]))
  const items   = []
  const visited = new Set()

  function dfs(id) {
    if (!id || id === joinId || visited.has(id)) return
    visited.add(id)
    const np = nestedBySplit.get(id)
    if (np) {
      items.push({ kind: 'group', pair: np })
      for (const s of adj.get(np.joinId) ?? []) dfs(s)
    } else {
      const node = nodeById.get(id)
      if (node) items.push({ kind: 'node', node })
      for (const s of adj.get(id) ?? []) dfs(s)
    }
  }

  dfs(startId)
  return items
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderNodeEl(node, compact) {
  const el = mkEl('div', 'snode ' + (node.type || ''))
  el.textContent = (node.name || node.id) + (compact ? '' : '  [' + node.type + ']')
  return el
}

function renderPair(pair, allPairs, adj, nodeById, depth) {
  const dn   = directlyNested(pair, allPairs)
  const cols = pair.branches.length

  const tbl = document.createElement('table')
  tbl.className   = 'pair'
  tbl.dataset.depth = String(depth)

  // — SPLIT row —
  const splitTd = tbl.insertRow().insertCell()
  splitTd.colSpan   = cols
  splitTd.className = 'gw split'
  const b = pair.bounds
  splitTd.innerHTML =
    '<span class="lvl">L' + depth + '</span> ' +
    '<b>SPLIT</b> ' + (pair.splitLabel || pair.splitId) +
    '<span class="meta"> · layer ' + pair.layer +
    ' · Y=' + Math.round(pair.gatewayY) +
    ' · ' + b.width + '×' + b.height + ' @ (' + b.x + ',' + b.y + ')</span>'

  // — BRANCHES row —
  const mainIdx = pair.branches.reduce(
    (best, br, i) =>
      Math.abs(br.centerY - pair.gatewayY) <
      Math.abs(pair.branches[best].centerY - pair.gatewayY) ? i : best,
    0,
  )

  const brTr = tbl.insertRow()
  for (let bi = 0; bi < pair.branches.length; bi++) {
    const branch = pair.branches[bi]
    const td     = brTr.insertCell()
    td.className = 'bc' + (bi === mainIdx ? ' main' : '')

    const delta = Math.round(branch.centerY - pair.gatewayY)
    const sign  = delta >= 0 ? '+' : ''
    td.appendChild(mkEl('div', 'bc-hdr',
      'Y' + sign + delta + '  h=' + Math.round(branch.height) + 'px' +
      '  nodes=' + branch.nodeIds.length +
      (bi === mainIdx ? '  ▶' : '')))

    const dnBr  = directlyNestedInBranch(branch, dn)
    const start = branch.nodeIds[0]
    if (!start) continue

    const items = buildBranchItems(start, pair.joinId, adj, dnBr, nodeById)
    let first = true
    for (const item of items) {
      if (!first) td.appendChild(mkEl('div', 'down', '↓'))
      first = false
      if (item.kind === 'group')
        td.appendChild(renderPair(item.pair, allPairs, adj, nodeById, depth + 1))
      else
        td.appendChild(renderNodeEl(item.node, true))
    }
  }

  // — JOIN row —
  const joinTd = tbl.insertRow().insertCell()
  joinTd.colSpan   = cols
  joinTd.className = 'gw join'
  joinTd.textContent = 'JOIN  ' + (pair.joinLabel || pair.joinId)

  return tbl
}

function render(data) {
  const root = document.getElementById('root')

  if (!data || !Array.isArray(data.tree)) {
    root.innerHTML = '<div class="error">Error: ' + String(data?.error || 'unknown') + '</div>'
    return
  }

  const adj    = buildAdj(data.flows)
  const nodeById = new Map(data.nodes.map(n => [n.id, n]))
  const spine  = buildSpine(data)

  if (!spine.length) {
    root.innerHTML = '<p>No start event found.</p>'
    return
  }

  const wrap = mkEl('div', 'spine')
  let first  = true
  for (const item of spine) {
    if (!first) wrap.appendChild(mkEl('div', 'spine-conn', '↓'))
    first = false
    if (item.kind === 'group')
      wrap.appendChild(renderPair(item.pair, data.tree, adj, nodeById, 0))
    else
      wrap.appendChild(renderNodeEl(item.node, false))
  }
  root.replaceChildren(wrap)
}
`

// ── CSS ────────────────────────────────────────────────────────────────────────

const CSS = /* css */ `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: monospace;
  font-size: 12px;
  background: #0e0e0e;
  color: #bbb;
  padding: 20px;
  overflow-x: auto;
}
#title { font-size: 11px; color: #555; margin-bottom: 16px; }
#title.stale { color: #7f1d1d; }
.error { color: #f87171; background: #1c0707; border: 1px solid #7f1d1d; padding: 8px 12px; }

/* ── spine ────────────────────────────────────────────────────────────────── */
.spine { display: flex; flex-direction: column; align-items: flex-start; }
.spine-conn { color: #3a3a3a; padding: 1px 14px; font-size: 12px; }

/* non-gateway spine / branch nodes */
.snode {
  padding: 5px 12px;
  border: 1px solid #2a2a2a;
  background: #161616;
  color: #999;
  white-space: nowrap;
}
.snode.startEvent      { background: #0d1a0d; color: #6fbf6f; border-color: #2a4a2a; border-radius: 20px; }
.snode.endEvent        { background: #1a0d10; color: #bf6f80; border-color: #4a2a30; border-radius: 20px; }
.snode.intermediateThrowEvent,
.snode.intermediateCatchEvent,
.snode.boundaryEvent   { border-radius: 8px; }
.snode.exclusiveGateway,
.snode.parallelGateway,
.snode.inclusiveGateway,
.snode.eventBasedGateway { background: #1a1a0d; color: #bfbf6f; border-color: #4a4a2a; }

/* ── pair table ───────────────────────────────────────────────────────────── */
table.pair { border-collapse: collapse; width: max-content; }
table.pair td { border: 1px solid #2e2e2e; padding: 0; }
table.pair[data-depth="0"] td { border-color: #3e3e3e; }
table.pair[data-depth="1"] td { border-color: #3a3a5a; }
table.pair[data-depth="2"] td { border-color: #2a4a2a; }
table.pair[data-depth="3"] td { border-color: #4a2a2a; }

.gw { padding: 5px 12px; white-space: nowrap; font-size: 12px; }
.gw.split { background: #0d1a0d; color: #6fbf6f; }
.gw.join  { background: #1a0d10; color: #bf6f80; }

.lvl {
  display: inline-block;
  background: #1e2e1e;
  color: #4a8a4a;
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  margin-right: 6px;
  vertical-align: middle;
}
.gw.join .lvl  { background: #2e1e1e; color: #8a4a4a; }
.gw .meta { font-size: 10px; color: #3a3a3a; margin-left: 6px; font-weight: normal; }

/* ── branch cells ─────────────────────────────────────────────────────────── */
.bc      { vertical-align: top; padding: 8px 10px; min-width: 120px; background: #131313; }
.bc.main { background: #0f131a; }
.bc-hdr  { font-size: 10px; color: #3a3a3a; border-bottom: 1px solid #1a1a1a; padding-bottom: 4px; margin-bottom: 6px; }
.bc.main .bc-hdr { color: #506070; }

.down { text-align: center; color: #2a2a2a; margin: 2px 0; font-size: 10px; }
`

// ── Page builder ───────────────────────────────────────────────────────────────

function buildPage(data) {
	const safeJson = JSON.stringify(data).replace(/<\//g, "<\\/")
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>BPMN Tree — ${inputArg}</title>
<style>${CSS}</style>
</head>
<body>
<p id="title">BPMN Process Tree · ${inputArg}</p>
<div id="root"></div>
<script>
${CLIENT_JS}

render(${safeJson});

const es = new EventSource('/events')
es.onmessage = () =>
  fetch('/data').then(r => r.json()).then(d => {
    document.getElementById('title').className = ''
    render(d)
  })
es.onerror = () => { document.getElementById('title').className = 'stale' }
</script>
</body>
</html>`
}

// ── HTTP server ────────────────────────────────────────────────────────────────

const PORT = 3456

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
	res.end(buildPage(getData()))
}).listen(PORT, () => {
	console.log(`Tree viewer → http://localhost:${PORT}`)
	console.log(`Watching   → ${inputPath}`)
})
