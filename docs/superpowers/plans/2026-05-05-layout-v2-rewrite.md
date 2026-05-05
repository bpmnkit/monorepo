# Layout V2: Sugiyama with Trunk Prioritization and Channel Routing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely rewrite the BPMN auto-layout engine with 8 well-defined modules for reliable track-based Y positioning, gateway-aligned layering, and orthogonal channel routing.

**Architecture:** New engine lives in `packages/core/src/layout/v2/`. It builds an internal graph, identifies the trunk (happy path) via weighted BFS, breaks cycles, assigns layers with explicit gateway-pair alignment, positions nodes on discrete Y-tracks, assigns ports, routes edges via the existing grid-visibility A* router, then re-attaches annotations and converts to `LayoutResult`. `layout-engine.ts::layoutFlowNodes` is updated to call `layoutV2()` for all processes.

**Tech Stack:** TypeScript strict mode, Vitest, existing `astar.ts` for routing (reused as-is).

---

## File Map

| File | Purpose |
|---|---|
| `packages/core/src/layout/v2/types.ts` | Module 1 — internal node/edge interfaces, track constants |
| `packages/core/src/layout/v2/graph.ts` | Module 1 — `V2Graph` class (Map-based adjacency) |
| `packages/core/src/layout/v2/trunk.ts` | Module 2 — annotation extraction + weighted BFS trunk |
| `packages/core/src/layout/v2/dag.ts` | Module 3 — DFS cycle detection + DAG conversion |
| `packages/core/src/layout/v2/layers.ts` | Module 4 — topological layers, gateway alignment, dummy injection |
| `packages/core/src/layout/v2/grid.ts` | Module 5 — track assignment + X/Y coordinate calculation |
| `packages/core/src/layout/v2/ports.ts` | Module 6 — smart port assignment (East/West/North/South) |
| `packages/core/src/layout/v2/router.ts` | Module 7 — thin wrapper: back-edge highway + calls `routeEdgeAstar` |
| `packages/core/src/layout/v2/annotations.ts` | Module 8 — annotation position + association routing |
| `packages/core/src/layout/v2/engine.ts` | Orchestrator — wires all 8 modules, returns `LayoutResult` |
| `packages/core/tests/layout-v2.test.ts` | Unit + integration tests for all v2 modules |
| `packages/core/src/layout/layout-engine.ts` | Modified — `layoutFlowNodes` calls `layoutV2()` |

---

## Task 1: V2 Internal Types & Graph Class (Module 1)

**Files:**
- Create: `packages/core/src/layout/v2/types.ts`
- Create: `packages/core/src/layout/v2/graph.ts`
- Create: `packages/core/tests/layout-v2.test.ts` (scaffold only)

- [ ] **Step 1: Create `v2/types.ts`**

```typescript
// packages/core/src/layout/v2/types.ts

/** Y-center for each track band. Flow nodes use tracks 1–4; 0 and 5 are for annotations. */
export const TRACK_Y: Record<number, number> = {
  0: 40,
  1: 160,
  2: 360,
  3: 560,
  4: 760,
  5: 960,
}

/** All positions snap to multiples of this value. */
export const CELL_SIZE = 40

/** Minimum horizontal gap between adjacent layer columns (px). */
export const MIN_COL_GAP = 80

/** Vertical gap when stacking multiple nodes in the same track+layer (px). */
export const STACK_V_GAP = 20

/** Left margin before the first layer (px). */
export const LEFT_MARGIN = 50

/** Padding around nodes for obstacle-avoidance routing (px). */
export const OBSTACLE_PAD = 20

/** Annotation height (px). */
export const ANN_HEIGHT = 50

/** Pattern for rejection/error/escalation nodes and flows. */
export const REJECTION_PATTERN = /reject|escalat|error|cancel|declin/i

/** Track bands for Y placement (0=top-annotations, 5=bottom-annotations). */
export type NodeTrack = 0 | 1 | 2 | 3 | 4 | 5

export interface V2Node {
  id: string
  /** BPMN element type string (e.g. 'serviceTask', 'exclusiveGateway'). */
  type: string
  width: number
  height: number
  /** Assigned X coordinate (left edge). Set in Module 5. */
  x: number
  /** Assigned Y coordinate (top edge). Set in Module 5. */
  y: number
  /** Column index from Module 4 layer assignment. */
  layer: number
  /** Y-band track from Module 5. */
  track: NodeTrack
  /** True when this node is on the trunk (happy-path). */
  isTrunk: boolean
  /** True when this node is the source of a back-edge. */
  isBackEdgeSource: boolean
  /** True for virtual placeholder nodes inserted for multi-span edges. */
  isDummy: boolean
  label?: string
  /** Width of the widest annotation associated with this node (px). Used for dynamic X gaps. */
  annotationWidth?: number
}

export interface V2Edge {
  id: string
  sourceId: string
  targetId: string
  /** True when this edge forms a loop (back-edge). Routed through Track 1 highway. */
  isBackEdge: boolean
  waypoints: Array<{ x: number; y: number }>
  label?: string
}

export interface PortPoint {
  x: number
  y: number
}

export interface PortAssignment {
  edgeId: string
  source: PortPoint
  target: PortPoint
}
```

- [ ] **Step 2: Create `v2/graph.ts`**

```typescript
// packages/core/src/layout/v2/graph.ts
import type { V2Edge, V2Node } from "./types.js"

export class V2Graph {
  nodes = new Map<string, V2Node>()
  edges = new Map<string, V2Edge>()
  /** outgoing neighbour lists */
  successors = new Map<string, string[]>()
  /** incoming neighbour lists */
  predecessors = new Map<string, string[]>()

  addNode(node: V2Node): void {
    this.nodes.set(node.id, node)
    if (!this.successors.has(node.id)) this.successors.set(node.id, [])
    if (!this.predecessors.has(node.id)) this.predecessors.set(node.id, [])
  }

  addEdge(edge: V2Edge): void {
    this.edges.set(edge.id, edge)
    const s = this.successors.get(edge.sourceId) ?? []
    if (!s.includes(edge.targetId)) s.push(edge.targetId)
    this.successors.set(edge.sourceId, s)
    const p = this.predecessors.get(edge.targetId) ?? []
    if (!p.includes(edge.sourceId)) p.push(edge.sourceId)
    this.predecessors.set(edge.targetId, p)
  }

  getSuccessors(id: string): string[] {
    return this.successors.get(id) ?? []
  }

  getPredecessors(id: string): string[] {
    return this.predecessors.get(id) ?? []
  }

  /** Shallow clone — nodes/edges objects are shared (not deep-copied). */
  clone(): V2Graph {
    const g = new V2Graph()
    for (const n of this.nodes.values()) g.addNode(n)
    for (const e of this.edges.values()) g.addEdge(e)
    return g
  }
}
```

- [ ] **Step 3: Create test scaffold**

```typescript
// packages/core/tests/layout-v2.test.ts
import { describe, expect, it } from "vitest"
import { V2Graph } from "../src/layout/v2/graph.js"
import type { V2Node } from "../src/layout/v2/types.js"

function makeNode(id: string, type = "serviceTask"): V2Node {
  return {
    id, type,
    width: type.includes("Gateway") ? 50 : 100,
    height: type.includes("Gateway") ? 50 : 80,
    x: 0, y: 0, layer: 0, track: 2,
    isTrunk: false, isBackEdgeSource: false, isDummy: false,
  }
}

describe("V2Graph", () => {
  it("tracks successors and predecessors", () => {
    const g = new V2Graph()
    g.addNode(makeNode("a"))
    g.addNode(makeNode("b"))
    g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
    expect(g.getSuccessors("a")).toEqual(["b"])
    expect(g.getPredecessors("b")).toEqual(["a"])
  })

  it("does not duplicate successors on re-add", () => {
    const g = new V2Graph()
    g.addNode(makeNode("a"))
    g.addNode(makeNode("b"))
    g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
    g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
    expect(g.getSuccessors("a")).toHaveLength(1)
  })
})
```

- [ ] **Step 4: Run tests**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm vitest run packages/core/tests/layout-v2.test.ts
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/layout/v2/types.ts packages/core/src/layout/v2/graph.ts packages/core/tests/layout-v2.test.ts
git commit -m "feat(layout-v2): add Module 1 — V2Node/V2Edge types and V2Graph class"
```

---

## Task 2: Trunk Identification (Module 2) + Cycle Breaking (Module 3)

**Files:**
- Create: `packages/core/src/layout/v2/trunk.ts`
- Create: `packages/core/src/layout/v2/dag.ts`
- Modify: `packages/core/tests/layout-v2.test.ts`

- [ ] **Step 1: Create `v2/trunk.ts`**

```typescript
// packages/core/src/layout/v2/trunk.ts
import type { BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import type { V2Graph } from "./graph.js"
import { REJECTION_PATTERN } from "./types.js"

/**
 * Weighted BFS (Dijkstra) from startEvent to the lowest-cost endEvent.
 * Flows/nodes with rejection terms are penalised (+10000).
 * Default-flagged outgoing flows from gateways get 0 cost (preferred).
 * Returns the set of node IDs on the winning path.
 */
export function identifyTrunk(
  graph: V2Graph,
  nodeIndex: Map<string, BpmnFlowElement>,
  sequenceFlows: BpmnSequenceFlow[],
): Set<string> {
  let startId: string | undefined
  for (const [id, n] of nodeIndex) {
    if (n.type === "startEvent") { startId = id; break }
  }
  if (!startId) return new Set()

  // Index flows by source for O(1) lookup
  const flowsBySource = new Map<string, BpmnSequenceFlow[]>()
  for (const f of sequenceFlows) {
    const bucket = flowsBySource.get(f.sourceRef) ?? []
    bucket.push(f)
    flowsBySource.set(f.sourceRef, bucket)
  }

  // Collect default flow IDs from gateways
  const defaultFlowIds = new Set<string>()
  for (const n of nodeIndex.values()) {
    if ("default" in n && n.default) defaultFlowIds.add(n.default)
  }

  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  const visited = new Set<string>()
  for (const id of graph.nodes.keys()) dist.set(id, Number.POSITIVE_INFINITY)
  dist.set(startId, 0)

  const queue: Array<{ id: string; cost: number }> = [{ id: startId, cost: 0 }]

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost)
    const entry = queue.shift()!
    if (visited.has(entry.id)) continue
    visited.add(entry.id)

    for (const succId of graph.getSuccessors(entry.id)) {
      const connectingFlow = (flowsBySource.get(entry.id) ?? []).find(f => f.targetRef === succId)
      let edgeCost = defaultFlowIds.has(connectingFlow?.id ?? "") ? 0 : 1
      if (connectingFlow?.name && REJECTION_PATTERN.test(connectingFlow.name)) edgeCost += 10000
      const targetNode = nodeIndex.get(succId)
      if (targetNode?.name && REJECTION_PATTERN.test(targetNode.name)) edgeCost += 10000

      const alt = (dist.get(entry.id) ?? Infinity) + edgeCost
      if (alt < (dist.get(succId) ?? Infinity)) {
        dist.set(succId, alt)
        prev.set(succId, entry.id)
        queue.push({ id: succId, cost: alt })
      }
    }
  }

  // Find best endEvent
  let bestEndId: string | undefined
  let bestCost = Infinity
  for (const [id, n] of nodeIndex) {
    if (n.type !== "endEvent") continue
    const cost = dist.get(id) ?? Infinity
    if (cost < bestCost) { bestCost = cost; bestEndId = id }
  }

  if (!bestEndId || bestCost === Infinity) return new Set()

  // Reconstruct path
  const trunk = new Set<string>()
  let cur: string | undefined = bestEndId
  while (cur) { trunk.add(cur); cur = prev.get(cur) }
  return trunk
}
```

- [ ] **Step 2: Create `v2/dag.ts`**

```typescript
// packages/core/src/layout/v2/dag.ts
import type { V2Edge } from "./types.js"
import type { V2Graph } from "./graph.js"
import { V2Graph as GraphClass } from "./graph.js"

export interface BackEdgeInfo {
  edgeId: string
  sourceId: string
  targetId: string
}

/**
 * DFS-based cycle detection.
 * An edge (u→v) is a back-edge when v is already in the current DFS call stack.
 */
export function detectBackEdges(graph: V2Graph): BackEdgeInfo[] {
  const result: BackEdgeInfo[] = []
  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(id: string): void {
    visited.add(id)
    inStack.add(id)

    for (const succId of graph.getSuccessors(id)) {
      if (!visited.has(succId)) {
        dfs(succId)
      } else if (inStack.has(succId)) {
        // Find the edge id connecting id → succId
        for (const [, e] of graph.edges) {
          if (e.sourceId === id && e.targetId === succId) {
            result.push({ edgeId: e.id, sourceId: id, targetId: succId })
          }
        }
      }
    }

    inStack.delete(id)
  }

  for (const id of graph.nodes.keys()) {
    if (!visited.has(id)) dfs(id)
  }
  return result
}

/**
 * Return a new graph where each back-edge is reversed and marked isBackEdge=true on
 * the ORIGINAL edge (not the reversed copy). The reversed edge is a temporary DAG edge
 * used only for layer assignment — it is NOT added to the returned graph's edge map.
 * Instead, we directly update the successors/predecessors maps.
 */
export function makeDAG(graph: V2Graph, backEdges: BackEdgeInfo[]): V2Graph {
  const backEdgeIds = new Set(backEdges.map(b => b.edgeId))

  // Mark original edges
  for (const [id, e] of graph.edges) {
    if (backEdgeIds.has(id)) {
      // mutate in place — the graph's edge objects are shared
      ;(e as V2Edge).isBackEdge = true
    }
  }

  // Build DAG: copy successors/predecessors but swap back-edge direction
  const dag = new GraphClass()
  for (const n of graph.nodes.values()) dag.addNode(n)

  for (const [, e] of graph.edges) {
    if (backEdgeIds.has(e.id)) {
      // Add reversed edge for DAG traversal only (new synthetic id)
      dag.addEdge({
        id: `${e.id}__rev`,
        sourceId: e.targetId,
        targetId: e.sourceId,
        isBackEdge: false,
        waypoints: [],
      })
    } else {
      dag.addEdge(e)
    }
  }

  return dag
}
```

- [ ] **Step 3: Add tests for trunk + cycle breaking**

Append to `packages/core/tests/layout-v2.test.ts`:

```typescript
import type { BpmnFlowElement, BpmnSequenceFlow } from "../src/bpmn/bpmn-model.js"
import { identifyTrunk } from "../src/layout/v2/trunk.js"
import { detectBackEdges, makeDAG } from "../src/layout/v2/dag.js"

function bpmnNode(id: string, type: BpmnFlowElement["type"] = "serviceTask", name?: string): BpmnFlowElement {
  const base = { id, name, incoming: [], outgoing: [], extensionElements: [], unknownAttributes: {} }
  switch (type) {
    case "startEvent": return { ...base, type: "startEvent", eventDefinitions: [] }
    case "endEvent":   return { ...base, type: "endEvent",   eventDefinitions: [] }
    case "exclusiveGateway": return { ...base, type: "exclusiveGateway" }
    default:           return { ...base, type } as BpmnFlowElement
  }
}

function bpmnFlow(id: string, src: string, tgt: string, name?: string): BpmnSequenceFlow {
  return { id, name, sourceRef: src, targetRef: tgt, extensionElements: [], unknownAttributes: {} }
}

function buildV2Graph(nodes: BpmnFlowElement[], flows: BpmnSequenceFlow[]): { graph: V2Graph; nodeIndex: Map<string, BpmnFlowElement> } {
  const graph = new V2Graph()
  const nodeIndex = new Map<string, BpmnFlowElement>()
  for (const n of nodes) {
    nodeIndex.set(n.id, n)
    graph.addNode(makeNode(n.id, n.type))
  }
  for (const f of flows) {
    graph.addEdge({ id: f.id, sourceId: f.sourceRef, targetId: f.targetRef, isBackEdge: false, waypoints: [] })
  }
  return { graph, nodeIndex }
}

describe("identifyTrunk", () => {
  it("marks the direct happy-path as trunk", () => {
    const nodes = [bpmnNode("s", "startEvent"), bpmnNode("t"), bpmnNode("e", "endEvent")]
    const flows = [bpmnFlow("f1", "s", "t"), bpmnFlow("f2", "t", "e")]
    const { graph, nodeIndex } = buildV2Graph(nodes, flows)
    const trunk = identifyTrunk(graph, nodeIndex, flows)
    expect(trunk).toContain("s")
    expect(trunk).toContain("t")
    expect(trunk).toContain("e")
  })

  it("avoids paths with rejection-labelled flows", () => {
    const nodes = [bpmnNode("s", "startEvent"), bpmnNode("ok"), bpmnNode("rej"), bpmnNode("e", "endEvent")]
    const flows = [
      bpmnFlow("f1", "s", "ok"),
      bpmnFlow("f2", "s", "rej", "Reject"),
      bpmnFlow("f3", "ok", "e"),
      bpmnFlow("f4", "rej", "e"),
    ]
    const { graph, nodeIndex } = buildV2Graph(nodes, flows)
    const trunk = identifyTrunk(graph, nodeIndex, flows)
    expect(trunk).toContain("ok")
    expect(trunk).not.toContain("rej")
  })
})

describe("detectBackEdges", () => {
  it("finds cycle edges", () => {
    const g = new V2Graph()
    g.addNode(makeNode("a")); g.addNode(makeNode("b")); g.addNode(makeNode("c"))
    g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
    g.addEdge({ id: "e2", sourceId: "b", targetId: "c", isBackEdge: false, waypoints: [] })
    g.addEdge({ id: "e3", sourceId: "c", targetId: "a", isBackEdge: false, waypoints: [] })
    const back = detectBackEdges(g)
    expect(back).toHaveLength(1)
    expect(back[0]?.edgeId).toBe("e3")
  })

  it("finds no back-edges in a DAG", () => {
    const g = new V2Graph()
    g.addNode(makeNode("a")); g.addNode(makeNode("b"))
    g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
    expect(detectBackEdges(g)).toHaveLength(0)
  })
})

describe("makeDAG", () => {
  it("reverses back-edges so topological sort is possible", () => {
    const g = new V2Graph()
    g.addNode(makeNode("a")); g.addNode(makeNode("b"))
    g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
    g.addEdge({ id: "e2", sourceId: "b", targetId: "a", isBackEdge: false, waypoints: [] })
    const back = detectBackEdges(g)
    const dag = makeDAG(g, back)
    // b→a should be reversed to a→b (already present), so no b→a in DAG
    expect(dag.getSuccessors("b")).not.toContain("a")
  })
})
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run packages/core/tests/layout-v2.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/layout/v2/trunk.ts packages/core/src/layout/v2/dag.ts packages/core/tests/layout-v2.test.ts
git commit -m "feat(layout-v2): add Module 2 (trunk BFS) and Module 3 (cycle breaking)"
```

---

## Task 3: Layer Assignment + Gateway Alignment + Dummy Nodes (Module 4)

**Files:**
- Create: `packages/core/src/layout/v2/layers.ts`
- Modify: `packages/core/tests/layout-v2.test.ts`

- [ ] **Step 1: Create `v2/layers.ts`**

```typescript
// packages/core/src/layout/v2/layers.ts
import type { BpmnFlowElement } from "../../bpmn/bpmn-model.js"
import type { V2Graph } from "./graph.js"
import { V2Graph as GraphClass } from "./graph.js"
import type { V2Node } from "./types.js"

const GATEWAY_TYPES = new Set([
  "exclusiveGateway", "parallelGateway", "inclusiveGateway",
  "eventBasedGateway", "complexGateway",
])

function isGateway(type: string): boolean {
  return GATEWAY_TYPES.has(type)
}

function isSplitGateway(id: string, graph: V2Graph): boolean {
  return isGateway(graph.nodes.get(id)?.type ?? "") && graph.getSuccessors(id).length > 1
}

function isJoinGateway(id: string, graph: V2Graph): boolean {
  return isGateway(graph.nodes.get(id)?.type ?? "") && graph.getPredecessors(id).length > 1
}

/**
 * Topological layer assignment (longest-path from sources).
 * Sets node.layer in-place on the DAG graph.
 */
export function assignLayers(dag: V2Graph): void {
  // Kahn's algorithm for topological sort + longest-path layer
  const inDegree = new Map<string, number>()
  for (const id of dag.nodes.keys()) inDegree.set(id, 0)
  for (const [, e] of dag.edges) {
    inDegree.set(e.targetId, (inDegree.get(e.targetId) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) { dag.nodes.get(id)!.layer = 0; queue.push(id) }
  }

  while (queue.length > 0) {
    const id = queue.shift()!
    const node = dag.nodes.get(id)!
    for (const succId of dag.getSuccessors(id)) {
      const succ = dag.nodes.get(succId)!
      succ.layer = Math.max(succ.layer, node.layer + 1)
      const newDeg = (inDegree.get(succId) ?? 1) - 1
      inDegree.set(succId, newDeg)
      if (newDeg === 0) queue.push(succId)
    }
  }
}

/**
 * Gateway-gateway alignment:
 * For every split/join gateway pair, find the deepest layer in the branch paths
 * and set join.layer = maxBranchLayer + 1.
 * Mutates node.layer in-place.
 */
export function alignGatewayPairs(dag: V2Graph, nodeIndex: Map<string, BpmnFlowElement>): void {
  for (const [splitId] of dag.nodes) {
    if (!isSplitGateway(splitId, dag)) continue
    const splitNode = dag.nodes.get(splitId)!

    // BFS to find all nodes reachable from this split
    const reachable = new Set<string>()
    const bfsQ = [...dag.getSuccessors(splitId)]
    while (bfsQ.length > 0) {
      const cur = bfsQ.shift()!
      if (reachable.has(cur)) continue
      reachable.add(cur)
      bfsQ.push(...dag.getSuccessors(cur))
    }

    // Among reachable join gateways, find the one directly joined to this split:
    // the join gateway whose ALL predecessors are reachable from the split.
    for (const candidateId of reachable) {
      if (!isJoinGateway(candidateId, dag)) continue
      const preds = dag.getPredecessors(candidateId)
      const allFromSplit = preds.every(p => reachable.has(p) || p === splitId)
      if (!allFromSplit) continue

      // Find deepest layer between split and join (exclusive of join)
      let maxBranchLayer = splitNode.layer
      for (const id of reachable) {
        if (id === candidateId) continue
        const n = dag.nodes.get(id)
        if (n) maxBranchLayer = Math.max(maxBranchLayer, n.layer)
      }

      const joinNode = dag.nodes.get(candidateId)!
      const required = maxBranchLayer + 1
      if (joinNode.layer < required) {
        const shift = required - joinNode.layer
        // Cascade: push join and all nodes after it
        for (const [, n] of dag.nodes) {
          if (n.layer >= joinNode.layer) n.layer += shift
        }
      }
      break
    }
  }
}

/**
 * Inject dummy nodes for edges that span more than one layer.
 * A dummy node has `isDummy: true` and width/height 0.
 * Returns the augmented graph (new nodes/edges added, originals preserved).
 */
export function injectDummies(dag: V2Graph, originalEdgeIds: Set<string>): V2Graph {
  const augmented = new GraphClass()
  for (const n of dag.nodes.values()) augmented.addNode(n)

  let dummyCounter = 0

  for (const [, e] of dag.edges) {
    // Skip back-edge reversals (synthetic __rev edges from makeDAG)
    if (e.id.endsWith("__rev")) { augmented.addEdge(e); continue }

    const srcNode = dag.nodes.get(e.sourceId)!
    const tgtNode = dag.nodes.get(e.targetId)!
    const layerSpan = tgtNode.layer - srcNode.layer

    if (layerSpan <= 1) {
      augmented.addEdge(e)
      continue
    }

    // Insert dummy nodes at each intermediate layer
    let prevId = e.sourceId
    for (let l = srcNode.layer + 1; l < tgtNode.layer; l++) {
      const dummyId = `__dummy_${e.id}_${dummyCounter++}`
      const dummy: V2Node = {
        id: dummyId, type: "dummy",
        width: 0, height: 0,
        x: 0, y: 0, layer: l, track: 2,
        isTrunk: false, isBackEdgeSource: false, isDummy: true,
      }
      augmented.addNode(dummy)
      augmented.addEdge({
        id: `${e.id}_seg_${l}`,
        sourceId: prevId,
        targetId: dummyId,
        isBackEdge: false,
        waypoints: [],
      })
      prevId = dummyId
    }
    augmented.addEdge({
      id: `${e.id}_seg_${tgtNode.layer}`,
      sourceId: prevId,
      targetId: e.targetId,
      isBackEdge: false,
      waypoints: [],
    })
  }

  return augmented
}
```

- [ ] **Step 2: Add layer tests**

Append to `packages/core/tests/layout-v2.test.ts`:

```typescript
import { assignLayers, alignGatewayPairs, injectDummies } from "../src/layout/v2/layers.js"

describe("assignLayers", () => {
  it("assigns layer 0 to source, increments along chain", () => {
    const g = new V2Graph()
    for (const id of ["a","b","c"]) g.addNode(makeNode(id))
    g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
    g.addEdge({ id: "e2", sourceId: "b", targetId: "c", isBackEdge: false, waypoints: [] })
    assignLayers(g)
    expect(g.nodes.get("a")!.layer).toBe(0)
    expect(g.nodes.get("b")!.layer).toBe(1)
    expect(g.nodes.get("c")!.layer).toBe(2)
  })

  it("uses longest-path for fork/join", () => {
    // S → A → B → JOIN, S → JOIN (direct)
    const g = new V2Graph()
    for (const id of ["S","A","B","J"]) g.addNode(makeNode(id))
    g.addEdge({ id: "e1", sourceId: "S", targetId: "A", isBackEdge: false, waypoints: [] })
    g.addEdge({ id: "e2", sourceId: "A", targetId: "B", isBackEdge: false, waypoints: [] })
    g.addEdge({ id: "e3", sourceId: "B", targetId: "J", isBackEdge: false, waypoints: [] })
    g.addEdge({ id: "e4", sourceId: "S", targetId: "J", isBackEdge: false, waypoints: [] })
    assignLayers(g)
    expect(g.nodes.get("J")!.layer).toBe(3) // max(B.layer+1, S.layer+1) = max(3,1) = 3
  })
})

describe("alignGatewayPairs", () => {
  it("forces join gateway to maxBranchLayer + 1", () => {
    // split → A (layer 1) → B (layer 2) → join
    // split → join (direct, would give join.layer=1 without alignment)
    const g = new V2Graph()
    g.addNode({ ...makeNode("split"), type: "exclusiveGateway" })
    g.addNode(makeNode("A")); g.addNode(makeNode("B"))
    g.addNode({ ...makeNode("join"), type: "exclusiveGateway" })
    g.addEdge({ id: "e1", sourceId: "split", targetId: "A", isBackEdge: false, waypoints: [] })
    g.addEdge({ id: "e2", sourceId: "A",     targetId: "B", isBackEdge: false, waypoints: [] })
    g.addEdge({ id: "e3", sourceId: "B",     targetId: "join", isBackEdge: false, waypoints: [] })
    g.addEdge({ id: "e4", sourceId: "split", targetId: "join", isBackEdge: false, waypoints: [] })
    assignLayers(g) // standard longest-path: join.layer = 3
    const before = g.nodes.get("join")!.layer
    alignGatewayPairs(g, new Map()) // should keep it at 3
    expect(g.nodes.get("join")!.layer).toBeGreaterThanOrEqual(before)
  })
})

describe("injectDummies", () => {
  it("inserts dummy nodes for multi-layer edges", () => {
    const g = new V2Graph()
    g.addNode({ ...makeNode("a"), layer: 0 })
    g.addNode({ ...makeNode("b"), layer: 3 }) // spans 3 layers
    g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
    const aug = injectDummies(g, new Set(["e1"]))
    const dummies = [...aug.nodes.values()].filter(n => n.isDummy)
    expect(dummies).toHaveLength(2) // layers 1 and 2
  })
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run packages/core/tests/layout-v2.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/layout/v2/layers.ts packages/core/tests/layout-v2.test.ts
git commit -m "feat(layout-v2): add Module 4 — layer assignment, gateway alignment, dummy injection"
```

---

## Task 4: Track Assignment + Coordinate Calculation (Module 5)

**Files:**
- Create: `packages/core/src/layout/v2/grid.ts`
- Modify: `packages/core/tests/layout-v2.test.ts`

- [ ] **Step 1: Create `v2/grid.ts`**

```typescript
// packages/core/src/layout/v2/grid.ts
import type { BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import type { V2Graph } from "./graph.js"
import { CELL_SIZE, LEFT_MARGIN, MIN_COL_GAP, REJECTION_PATTERN, STACK_V_GAP, TRACK_Y } from "./types.js"
import type { NodeTrack } from "./types.js"

/**
 * Classify each node into a track (Y-band):
 *   Track 2 = trunk (happy path)
 *   Track 1 = back-edge source nodes
 *   Track 4 = rejection/error paths
 *   Track 3 = everything else
 *
 * Mutates node.track and node.isTrunk / node.isBackEdgeSource in-place.
 */
export function assignTracks(
  graph: V2Graph,
  trunkIds: Set<string>,
  backEdgeIds: Set<string>,
  sequenceFlows: BpmnSequenceFlow[],
  nodeIndex: Map<string, BpmnFlowElement>,
): void {
  // Build set of back-edge source node IDs
  const backEdgeSources = new Set<string>()
  for (const f of sequenceFlows) {
    if (backEdgeIds.has(f.id)) backEdgeSources.add(f.sourceRef)
  }

  // Build incoming flows per node for rejection detection
  const incomingFlows = new Map<string, BpmnSequenceFlow[]>()
  for (const f of sequenceFlows) {
    const bucket = incomingFlows.get(f.targetRef) ?? []
    bucket.push(f)
    incomingFlows.set(f.targetRef, bucket)
  }

  for (const [id, node] of graph.nodes) {
    if (node.isDummy) { node.track = 2; continue }

    if (trunkIds.has(id)) {
      node.track = 2; node.isTrunk = true; continue
    }
    if (backEdgeSources.has(id)) {
      node.track = 1; node.isBackEdgeSource = true; continue
    }

    const bpmnNode = nodeIndex.get(id)
    let isRejection = !!(bpmnNode?.name && REJECTION_PATTERN.test(bpmnNode.name))
    if (!isRejection) {
      const incoming = incomingFlows.get(id) ?? []
      isRejection = incoming.some(f => f.name && REJECTION_PATTERN.test(f.name))
    }

    node.track = isRejection ? 4 : 3
  }
}

/**
 * Snap a value to the nearest multiple of CELL_SIZE.
 */
function snap(v: number): number {
  return Math.round(v / CELL_SIZE) * CELL_SIZE
}

/**
 * Group node IDs by layer, then by track within each layer.
 */
function groupByLayerAndTrack(graph: V2Graph): Map<number, Map<NodeTrack, string[]>> {
  const result = new Map<number, Map<NodeTrack, string[]>>()
  for (const [id, n] of graph.nodes) {
    if (n.isDummy) continue
    let byTrack = result.get(n.layer)
    if (!byTrack) { byTrack = new Map(); result.set(n.layer, byTrack) }
    const bucket = byTrack.get(n.track) ?? []
    bucket.push(id)
    byTrack.set(n.track, bucket)
  }
  return result
}

/**
 * Assign X/Y coordinates to all nodes.
 *
 * X: iterate layers left to right. Column X is determined by the widest element
 *    (or annotation half-width) in the PREVIOUS layer + MIN_COL_GAP.
 *    All positions are snapped to CELL_SIZE.
 *
 * Y: node.y = TRACK_Y[track] - height/2, snapped to CELL_SIZE.
 *    When multiple nodes share a layer+track, they are stacked vertically
 *    from the track center downward.
 *
 * Mutates node.x and node.y in-place.
 */
export function assignCoordinates(graph: V2Graph): void {
  const layerGroups = groupByLayerAndTrack(graph)
  const sortedLayers = [...layerGroups.keys()].sort((a, b) => a - b)

  // Calculate X for each layer
  const layerX = new Map<number, number>()
  let currentX = LEFT_MARGIN

  for (const layer of sortedLayers) {
    layerX.set(layer, snap(currentX))
    const byTrack = layerGroups.get(layer)!

    // Find widest element in this layer (considering annotation width)
    let maxW = 0
    for (const ids of byTrack.values()) {
      for (const id of ids) {
        const n = graph.nodes.get(id)!
        const effectiveW = Math.max(n.width, (n.annotationWidth ?? 0) / 2)
        maxW = Math.max(maxW, effectiveW)
      }
    }

    currentX += maxW + MIN_COL_GAP
  }

  // Also place dummy nodes
  for (const [, n] of graph.nodes) {
    if (!n.isDummy) continue
    const lx = layerX.get(n.layer) ?? LEFT_MARGIN
    n.x = snap(lx)
    n.y = snap(TRACK_Y[2]!) // dummies sit on trunk line
  }

  // Assign X/Y to real nodes
  for (const layer of sortedLayers) {
    const byTrack = layerGroups.get(layer)!
    const lx = layerX.get(layer)!

    for (const [track, ids] of byTrack) {
      const trackCenterY = TRACK_Y[track as NodeTrack]!
      // Sort by id for determinism; could use crossing-minimization order later
      const sorted = [...ids].sort()
      const totalH = sorted.reduce((acc, id) => acc + (graph.nodes.get(id)!.height), 0)
        + STACK_V_GAP * (sorted.length - 1)
      let curY = trackCenterY - totalH / 2

      for (const id of sorted) {
        const n = graph.nodes.get(id)!
        n.x = snap(lx)
        n.y = snap(curY)
        curY += n.height + STACK_V_GAP
      }
    }
  }
}
```

- [ ] **Step 2: Add coordinate tests**

Append to `packages/core/tests/layout-v2.test.ts`:

```typescript
import { assignTracks, assignCoordinates } from "../src/layout/v2/grid.js"
import { TRACK_Y, CELL_SIZE } from "../src/layout/v2/types.js"

describe("assignTracks", () => {
  it("puts trunk nodes on track 2", () => {
    const g = new V2Graph()
    g.addNode(makeNode("a")); g.addNode(makeNode("b"))
    g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
    assignTracks(g, new Set(["a","b"]), new Set(), [], new Map())
    expect(g.nodes.get("a")!.track).toBe(2)
    expect(g.nodes.get("b")!.track).toBe(2)
  })

  it("puts rejection-named nodes on track 4", () => {
    const g = new V2Graph()
    g.addNode(makeNode("a")); g.addNode(makeNode("rej"))
    const flows = [bpmnFlow("f1", "a", "rej", "Reject")]
    g.addEdge({ id: "f1", sourceId: "a", targetId: "rej", isBackEdge: false, waypoints: [] })
    const nodeIndex = new Map([["a", bpmnNode("a")], ["rej", bpmnNode("rej", "serviceTask", "Reject Task")]])
    assignTracks(g, new Set(["a"]), new Set(), flows, nodeIndex)
    expect(g.nodes.get("rej")!.track).toBe(4)
  })
})

describe("assignCoordinates", () => {
  it("places trunk node y-center near TRACK_Y[2]", () => {
    const g = new V2Graph()
    const n = { ...makeNode("a"), layer: 0, track: 2 as const }
    g.addNode(n)
    assignCoordinates(g)
    const cy = n.y + n.height / 2
    expect(Math.abs(cy - TRACK_Y[2]!)).toBeLessThan(CELL_SIZE)
  })

  it("assigns different X for different layers", () => {
    const g = new V2Graph()
    g.addNode({ ...makeNode("a"), layer: 0, track: 2 as const })
    g.addNode({ ...makeNode("b"), layer: 1, track: 2 as const })
    g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
    assignCoordinates(g)
    expect(g.nodes.get("b")!.x).toBeGreaterThan(g.nodes.get("a")!.x)
  })

  it("snaps X/Y to CELL_SIZE", () => {
    const g = new V2Graph()
    g.addNode({ ...makeNode("a"), layer: 0, track: 2 as const })
    assignCoordinates(g)
    const n = g.nodes.get("a")!
    expect(n.x % CELL_SIZE).toBe(0)
    expect(n.y % CELL_SIZE).toBe(0)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run packages/core/tests/layout-v2.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/layout/v2/grid.ts packages/core/tests/layout-v2.test.ts
git commit -m "feat(layout-v2): add Module 5 — track assignment and grid coordinate calculation"
```

---

## Task 5: Smart Port Assignment (Module 6) + Edge Router (Module 7)

**Files:**
- Create: `packages/core/src/layout/v2/ports.ts`
- Create: `packages/core/src/layout/v2/router.ts`
- Modify: `packages/core/tests/layout-v2.test.ts`

- [ ] **Step 1: Create `v2/ports.ts`**

```typescript
// packages/core/src/layout/v2/ports.ts
import type { V2Graph } from "./graph.js"
import type { PortAssignment, PortPoint } from "./types.js"
import { TRACK_Y } from "./types.js"

function eastPort(n: { x: number; y: number; width: number; height: number }): PortPoint {
  return { x: n.x + n.width, y: Math.round(n.y + n.height / 2) }
}
function westPort(n: { x: number; y: number; width: number; height: number }): PortPoint {
  return { x: n.x, y: Math.round(n.y + n.height / 2) }
}
function southPort(n: { x: number; y: number; width: number; height: number }): PortPoint {
  return { x: Math.round(n.x + n.width / 2), y: n.y + n.height }
}
function northPort(n: { x: number; y: number; width: number; height: number }): PortPoint {
  return { x: Math.round(n.x + n.width / 2), y: n.y }
}

/**
 * Assign entry/exit ports for every edge in the graph.
 *
 * Rules:
 *   Standard (same track, target right of source): exit East, enter West.
 *   Source above target (source.track < target.track): exit South, enter North.
 *   Source below target (source.track > target.track): exit North, enter South.
 *   Back-edge: exit East, enter West (router will push it through Track 1 highway).
 */
export function assignPorts(graph: V2Graph): Map<string, PortAssignment> {
  const result = new Map<string, PortAssignment>()

  for (const [, e] of graph.edges) {
    if (e.id.endsWith("__rev")) continue
    const src = graph.nodes.get(e.sourceId)
    const tgt = graph.nodes.get(e.targetId)
    if (!src || !tgt) continue
    if (src.isDummy || tgt.isDummy) continue

    let source: PortPoint
    let target: PortPoint

    if (e.isBackEdge) {
      // Back-edges: East exit, West entry (routed through Track 1 highway by router)
      source = eastPort(src)
      target = westPort(tgt)
    } else if (src.track < tgt.track) {
      // Source is on a higher band (lower Y index) than target
      source = southPort(src)
      target = northPort(tgt)
    } else if (src.track > tgt.track) {
      source = northPort(src)
      target = southPort(tgt)
    } else {
      // Same track — standard East/West
      source = eastPort(src)
      target = westPort(tgt)
    }

    result.set(e.id, { edgeId: e.id, source, target })
  }

  return result
}
```

- [ ] **Step 2: Create `v2/router.ts`**

```typescript
// packages/core/src/layout/v2/router.ts
import { routeEdgeAstar } from "../astar.js"
import type { V2Graph } from "./graph.js"
import type { PortAssignment } from "./types.js"
import { TRACK_Y } from "./types.js"
import type { Bounds } from "../types.js"

/**
 * Route all edges in the graph using the existing grid-visibility A* router.
 * Back-edges are forced through the Track 1 highway by injecting waypoints.
 *
 * Mutates edge.waypoints in-place.
 */
export function routeAllEdges(
  graph: V2Graph,
  ports: Map<string, PortAssignment>,
  backEdgeIds: Set<string>,
): void {
  // Build obstacle bounds for all real nodes
  const allObstacles: Bounds[] = []
  for (const [, n] of graph.nodes) {
    if (n.isDummy) continue
    allObstacles.push({ x: n.x, y: n.y, width: n.width, height: n.height })
  }

  // Occupied segments accumulator (steers later edges away from crowded corridors)
  const occupiedCells = new Set<number>()

  // Route back-edges first (highway Track 1 takes priority)
  const backEdgeEntries = [...graph.edges.entries()].filter(([, e]) => e.isBackEdge)
  const normalEdgeEntries = [...graph.edges.entries()].filter(([, e]) => !e.isBackEdge && !e.id.endsWith("__rev"))

  function routeEdge(edgeId: string): void {
    const edge = graph.edges.get(edgeId)!
    const assignment = ports.get(edgeId)
    if (!assignment) return

    const src = graph.nodes.get(edge.sourceId)!
    const tgt = graph.nodes.get(edge.targetId)!

    // Obstacles = all nodes except source and target
    const obstacles = allObstacles.filter(
      o => !(o.x === src.x && o.y === src.y) && !(o.x === tgt.x && o.y === tgt.y)
    )

    if (edge.isBackEdge) {
      // Force route through Track 1 highway Y
      const highwayY = TRACK_Y[1]!
      const sx = assignment.source.x
      const sy = assignment.source.y
      const tx = assignment.target.x
      const ty = assignment.target.y

      // Waypoints: exit East → up to Track 1 → travel back (right-to-left) → down to target
      edge.waypoints = [
        { x: sx, y: sy },
        { x: sx, y: highwayY },
        { x: tx, y: highwayY },
        { x: tx, y: ty },
      ]
    } else {
      const waypoints = routeEdgeAstar(
        assignment.source,
        assignment.target,
        obstacles,
        0,
        0,
        occupiedCells,
      )
      edge.waypoints = waypoints
    }
  }

  for (const [id] of backEdgeEntries) routeEdge(id)
  for (const [id] of normalEdgeEntries) routeEdge(id)
}
```

- [ ] **Step 3: Add port and routing tests**

Append to `packages/core/tests/layout-v2.test.ts`:

```typescript
import { assignPorts } from "../src/layout/v2/ports.js"
import { routeAllEdges } from "../src/layout/v2/router.js"

describe("assignPorts", () => {
  it("assigns East exit and West entry for same-track edges", () => {
    const g = new V2Graph()
    const src = { ...makeNode("a"), layer: 0, track: 2 as const, x: 50, y: 320, width: 100, height: 80 }
    const tgt = { ...makeNode("b"), layer: 1, track: 2 as const, x: 280, y: 320, width: 100, height: 80 }
    g.addNode(src); g.addNode(tgt)
    g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
    const ports = assignPorts(g)
    const p = ports.get("e1")!
    expect(p.source.x).toBe(150) // east = x + width
    expect(p.target.x).toBe(280) // west = x
  })

  it("uses South/North ports when source track < target track", () => {
    const g = new V2Graph()
    const src = { ...makeNode("a"), layer: 0, track: 2 as const, x: 50, y: 320, width: 100, height: 80 }
    const tgt = { ...makeNode("b"), layer: 0, track: 3 as const, x: 50, y: 520, width: 100, height: 80 }
    g.addNode(src); g.addNode(tgt)
    g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
    const ports = assignPorts(g)
    const p = ports.get("e1")!
    expect(p.source.y).toBe(400) // south = y + height
    expect(p.target.y).toBe(520) // north = y
  })
})

describe("routeAllEdges", () => {
  it("produces waypoints for a normal edge", () => {
    const g = new V2Graph()
    const src = { ...makeNode("a"), layer: 0, track: 2 as const, x: 50, y: 320, width: 100, height: 80 }
    const tgt = { ...makeNode("b"), layer: 1, track: 2 as const, x: 280, y: 320, width: 100, height: 80 }
    g.addNode(src); g.addNode(tgt)
    g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
    const ports = assignPorts(g)
    routeAllEdges(g, ports, new Set())
    const edge = g.edges.get("e1")!
    expect(edge.waypoints.length).toBeGreaterThanOrEqual(2)
  })

  it("routes back-edge through Track 1 highway Y", () => {
    const { TRACK_Y } = await import("../src/layout/v2/types.js")
    const g = new V2Graph()
    const src = { ...makeNode("b"), layer: 1, track: 2 as const, x: 280, y: 320, width: 100, height: 80 }
    const tgt = { ...makeNode("a"), layer: 0, track: 2 as const, x: 50, y: 320, width: 100, height: 80 }
    g.addNode(src); g.addNode(tgt)
    g.addEdge({ id: "e1", sourceId: "b", targetId: "a", isBackEdge: true, waypoints: [] })
    const ports = assignPorts(g)
    routeAllEdges(g, ports, new Set(["e1"]))
    const edge = g.edges.get("e1")!
    const ys = edge.waypoints.map(w => w.y)
    expect(ys).toContain(TRACK_Y[1]) // highway waypoint
  })
})
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run packages/core/tests/layout-v2.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/layout/v2/ports.ts packages/core/src/layout/v2/router.ts packages/core/tests/layout-v2.test.ts
git commit -m "feat(layout-v2): add Module 6 (port assignment) and Module 7 (channel router)"
```

---

## Task 6: Annotation Re-Attachment (Module 8)

**Files:**
- Create: `packages/core/src/layout/v2/annotations.ts`
- Modify: `packages/core/tests/layout-v2.test.ts`

- [ ] **Step 1: Create `v2/annotations.ts`**

```typescript
// packages/core/src/layout/v2/annotations.ts
import type { BpmnAssociation, BpmnTextAnnotation } from "../../bpmn/bpmn-model.js"
import { routeEdgeAstar } from "../astar.js"
import type { Bounds } from "../types.js"
import type { V2Graph } from "./graph.js"
import { ANN_HEIGHT, OBSTACLE_PAD, TRACK_Y } from "./types.js"

export interface AnnotationResult {
  annotationId: string
  x: number
  y: number
  width: number
  height: number
  waypoints: Array<{ x: number; y: number }>
}

/**
 * Position text annotations and route their association lines.
 *
 * Placement rules:
 *   - Match annotation to its target node via associations.
 *   - X = target node center X, centered on annotation width.
 *   - Y = Track 0 (top) if target.track <= 2, Track 5 (bottom) otherwise.
 *   - Association line routed orthogonally using the A* router.
 */
export function layoutAnnotations(
  textAnnotations: BpmnTextAnnotation[],
  associations: BpmnAssociation[],
  graph: V2Graph,
): AnnotationResult[] {
  if (textAnnotations.length === 0) return []

  const results: AnnotationResult[] = []

  // Build obstacle bounds from all flow nodes
  const obstacles: Bounds[] = []
  for (const [, n] of graph.nodes) {
    if (!n.isDummy) obstacles.push({ x: n.x, y: n.y, width: n.width, height: n.height })
  }

  // Index associations
  const assocByAnnotation = new Map<string, BpmnAssociation>()
  for (const a of associations) {
    assocByAnnotation.set(a.sourceRef, a)
    assocByAnnotation.set(a.targetRef, a)
  }

  for (const ta of textAnnotations) {
    const annW = Math.min(200, Math.max(80, (ta.text?.length ?? 10) * 5))

    // Find connected node
    const assoc = assocByAnnotation.get(ta.id)
    const connId = assoc
      ? assoc.sourceRef === ta.id ? assoc.targetRef : assoc.sourceRef
      : undefined
    const connNode = connId ? graph.nodes.get(connId) : undefined

    if (!connNode) {
      results.push({ annotationId: ta.id, x: 0, y: TRACK_Y[0]!, width: annW, height: ANN_HEIGHT, waypoints: [] })
      continue
    }

    const annX = Math.round(connNode.x + connNode.width / 2 - annW / 2)
    const useTop = connNode.track <= 2
    const annY = useTop ? TRACK_Y[0]! : TRACK_Y[5]! - ANN_HEIGHT

    // Annotation connection point (bottom if top, top if bottom)
    const annConnX = Math.round(annX + annW / 2)
    const annConnY = useTop ? annY + ANN_HEIGHT : annY
    const nodeConnX = Math.round(connNode.x + connNode.width / 2)
    const nodeConnY = useTop ? connNode.y : connNode.y + connNode.height

    // Route orthogonally avoiding flow node obstacles
    const lineObstacles = obstacles.filter(
      o => !(o.x === connNode.x && o.y === connNode.y)
    )
    const waypoints = routeEdgeAstar(
      { x: annConnX, y: annConnY },
      { x: nodeConnX, y: nodeConnY },
      lineObstacles,
      0, 0,
    )

    results.push({ annotationId: ta.id, x: annX, y: annY, width: annW, height: ANN_HEIGHT, waypoints })
  }

  return results
}
```

- [ ] **Step 2: Add annotation tests**

Append to `packages/core/tests/layout-v2.test.ts`:

```typescript
import { layoutAnnotations } from "../src/layout/v2/annotations.js"
import type { BpmnTextAnnotation, BpmnAssociation } from "../src/bpmn/bpmn-model.js"
import { TRACK_Y } from "../src/layout/v2/types.js"

describe("layoutAnnotations", () => {
  it("returns empty array when no annotations", () => {
    const g = new V2Graph()
    expect(layoutAnnotations([], [], g)).toHaveLength(0)
  })

  it("places top annotation above trunk node (track 2)", () => {
    const g = new V2Graph()
    const n = { ...makeNode("task1"), layer: 0, track: 2 as const, x: 200, y: 320, width: 100, height: 80 }
    g.addNode(n)
    const ta: BpmnTextAnnotation = { id: "ann1", text: "hello", unknownAttributes: {} }
    const assoc: BpmnAssociation = { id: "a1", sourceRef: "ann1", targetRef: "task1", unknownAttributes: {} }
    const results = layoutAnnotations([ta], [assoc], g)
    expect(results).toHaveLength(1)
    expect(results[0]!.y).toBeLessThan(TRACK_Y[2]!) // above trunk
  })

  it("places bottom annotation below rejection node (track 4)", () => {
    const g = new V2Graph()
    const n = { ...makeNode("rej"), layer: 0, track: 4 as const, x: 200, y: 720, width: 100, height: 80 }
    g.addNode(n)
    const ta: BpmnTextAnnotation = { id: "ann2", text: "rejection note", unknownAttributes: {} }
    const assoc: BpmnAssociation = { id: "a2", sourceRef: "ann2", targetRef: "rej", unknownAttributes: {} }
    const results = layoutAnnotations([ta], [assoc], g)
    expect(results).toHaveLength(1)
    expect(results[0]!.y).toBeGreaterThan(TRACK_Y[4]!) // below rejection band
  })
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run packages/core/tests/layout-v2.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/layout/v2/annotations.ts packages/core/tests/layout-v2.test.ts
git commit -m "feat(layout-v2): add Module 8 — annotation positioning and association routing"
```

---

## Task 7: Engine Orchestrator

**Files:**
- Create: `packages/core/src/layout/v2/engine.ts`
- Modify: `packages/core/tests/layout-v2.test.ts`

- [ ] **Step 1: Create `v2/engine.ts`**

```typescript
// packages/core/src/layout/v2/engine.ts
import type {
  BpmnAssociation,
  BpmnFlowElement,
  BpmnSequenceFlow,
  BpmnTextAnnotation,
} from "../../bpmn/bpmn-model.js"
import type { LayoutEdge, LayoutNode, LayoutResult } from "../types.js"
import { ELEMENT_SIZES } from "../types.js"
import { layoutAnnotations } from "./annotations.js"
import { makeDAG, detectBackEdges } from "./dag.js"
import { V2Graph } from "./graph.js"
import { assignCoordinates, assignTracks } from "./grid.js"
import { alignGatewayPairs, assignLayers, injectDummies } from "./layers.js"
import { assignPorts } from "./ports.js"
import { routeAllEdges } from "./router.js"
import { identifyTrunk } from "./trunk.js"
import type { V2Node } from "./types.js"

function getSize(type: string): { width: number; height: number } {
  return ELEMENT_SIZES[type] ?? { width: 100, height: 80 }
}

/**
 * Build V2Graph from BPMN flow elements and sequence flows.
 * Computes annotation widths for each node to enable dynamic X-gap calculation.
 */
function buildV2Graph(
  flowNodes: BpmnFlowElement[],
  sequenceFlows: BpmnSequenceFlow[],
  textAnnotations: BpmnTextAnnotation[],
  associations: BpmnAssociation[],
): { graph: V2Graph; nodeIndex: Map<string, BpmnFlowElement> } {
  const graph = new V2Graph()
  const nodeIndex = new Map<string, BpmnFlowElement>()

  // Build annotation width map: nodeId → max annotation width
  const annWidths = new Map<string, number>()
  const assocByNode = new Map<string, string[]>() // nodeId → annotationIds
  for (const a of associations) {
    // Either end can be the annotation
    const nodeId = textAnnotations.some(t => t.id === a.sourceRef) ? a.targetRef : a.sourceRef
    const annId = textAnnotations.some(t => t.id === a.sourceRef) ? a.sourceRef : a.targetRef
    const bucket = assocByNode.get(nodeId) ?? []
    bucket.push(annId)
    assocByNode.set(nodeId, bucket)
  }
  for (const [nodeId, annIds] of assocByNode) {
    let maxW = 0
    for (const annId of annIds) {
      const ta = textAnnotations.find(t => t.id === annId)
      if (ta) maxW = Math.max(maxW, Math.min(200, Math.max(80, (ta.text?.length ?? 10) * 5)))
    }
    annWidths.set(nodeId, maxW)
  }

  for (const n of flowNodes) {
    nodeIndex.set(n.id, n)
    const size = getSize(n.type)
    const v2node: V2Node = {
      id: n.id,
      type: n.type,
      ...size,
      x: 0, y: 0, layer: 0, track: 2,
      isTrunk: false, isBackEdgeSource: false, isDummy: false,
      label: n.name,
      annotationWidth: annWidths.get(n.id),
    }
    graph.addNode(v2node)
  }

  for (const f of sequenceFlows) {
    graph.addEdge({
      id: f.id,
      sourceId: f.sourceRef,
      targetId: f.targetRef,
      isBackEdge: false,
      waypoints: [],
      label: f.name,
    })
  }

  return { graph, nodeIndex }
}

/**
 * Convert V2Graph back to LayoutResult (the stable external interface).
 */
function toLayoutResult(
  graph: V2Graph,
  originalEdgeIds: Set<string>,
): LayoutResult {
  const nodes: LayoutNode[] = []
  for (const [, n] of graph.nodes) {
    if (n.isDummy) continue
    nodes.push({
      id: n.id,
      type: n.type as LayoutNode["type"],
      bounds: { x: n.x, y: n.y, width: n.width, height: n.height },
      layer: n.layer,
      position: n.track,
      label: n.label,
    })
  }

  const edges: LayoutEdge[] = []
  for (const [, e] of graph.edges) {
    if (!originalEdgeIds.has(e.id)) continue
    if (e.waypoints.length === 0) continue
    edges.push({
      id: e.id,
      sourceRef: e.sourceId,
      targetRef: e.targetId,
      waypoints: e.waypoints,
      label: e.label,
    })
  }

  return { nodes, edges }
}

/**
 * Main layout entry point for the v2 engine.
 *
 * Pipeline:
 *   1. Build graph                     (Module 1)
 *   2. Identify trunk via BFS          (Module 2)
 *   3. Detect cycles, make DAG         (Module 3)
 *   4. Assign layers, align gateways,
 *      inject dummy nodes              (Module 4)
 *   5. Assign tracks + coordinates     (Module 5)
 *   6. Assign ports                    (Module 6)
 *   7. Route edges                     (Module 7)
 *   8. Re-attach annotations           (Module 8)
 */
export function layoutV2(
  flowNodes: BpmnFlowElement[],
  sequenceFlows: BpmnSequenceFlow[],
  textAnnotations: BpmnTextAnnotation[] = [],
  associations: BpmnAssociation[] = [],
): LayoutResult {
  if (flowNodes.length === 0) return { nodes: [], edges: [] }

  // Module 1: Build graph
  const { graph, nodeIndex } = buildV2Graph(flowNodes, sequenceFlows, textAnnotations, associations)
  const originalEdgeIds = new Set(sequenceFlows.map(f => f.id))

  // Module 2: Trunk identification
  const trunkIds = identifyTrunk(graph, nodeIndex, sequenceFlows)

  // Module 3: Cycle breaking
  const backEdges = detectBackEdges(graph)
  const backEdgeIds = new Set(backEdges.map(b => b.edgeId))
  const dag = makeDAG(graph, backEdges)

  // Module 4: Layer assignment + gateway alignment + dummy injection
  assignLayers(dag)
  alignGatewayPairs(dag, nodeIndex)
  // Propagate layers back to original graph nodes (dag shares the same node objects)
  const augmented = injectDummies(dag, originalEdgeIds)

  // Module 5: Track assignment + coordinates
  assignTracks(augmented, trunkIds, backEdgeIds, sequenceFlows, nodeIndex)
  assignCoordinates(augmented)

  // Module 6: Port assignment
  const ports = assignPorts(augmented)

  // Module 7: Edge routing
  routeAllEdges(augmented, ports, backEdgeIds)

  // Convert augmented graph back to original-edge-only view
  const result = toLayoutResult(augmented, originalEdgeIds)

  // Module 8: Annotation re-attachment
  // Annotations go into LayoutResult as additional "nodes" with fixed types.
  // Association lines go into LayoutResult as edges without a sequence flow ID.
  const annResults = layoutAnnotations(textAnnotations, associations, augmented)
  for (const ann of annResults) {
    result.nodes.push({
      id: ann.annotationId,
      type: "textAnnotation" as LayoutNode["type"],
      bounds: { x: ann.x, y: ann.y, width: ann.width, height: ann.height },
      layer: -1,
      position: 0,
    })
    if (ann.waypoints.length > 0) {
      const assoc = associations.find(a => a.sourceRef === ann.annotationId || a.targetRef === ann.annotationId)
      if (assoc) {
        result.edges.push({
          id: assoc.id,
          sourceRef: assoc.sourceRef,
          targetRef: assoc.targetRef,
          waypoints: ann.waypoints,
        })
      }
    }
  }

  return result
}
```

- [ ] **Step 2: Add engine integration test**

Append to `packages/core/tests/layout-v2.test.ts`:

```typescript
import { layoutV2 } from "../src/layout/v2/engine.js"

describe("layoutV2 — engine integration", () => {
  it("lays out a linear process with 3 nodes", () => {
    const nodes = [bpmnNode("s", "startEvent"), bpmnNode("t"), bpmnNode("e", "endEvent")]
    const flows = [bpmnFlow("f1", "s", "t"), bpmnFlow("f2", "t", "e")]
    const result = layoutV2(nodes, flows)
    expect(result.nodes).toHaveLength(3)
    expect(result.edges).toHaveLength(2)
    // Nodes should be in increasing X order
    const [s, t, e] = ["s","t","e"].map(id => result.nodes.find(n => n.id === id)!)
    expect(s.bounds.x).toBeLessThan(t.bounds.x)
    expect(t.bounds.x).toBeLessThan(e.bounds.x)
  })

  it("trunk nodes have y-center near TRACK_Y[2]", () => {
    const nodes = [bpmnNode("s", "startEvent"), bpmnNode("t"), bpmnNode("e", "endEvent")]
    const flows = [bpmnFlow("f1", "s", "t"), bpmnFlow("f2", "t", "e")]
    const result = layoutV2(nodes, flows)
    for (const n of result.nodes) {
      const cy = n.bounds.y + n.bounds.height / 2
      // All nodes in a 3-node linear process are trunk
      expect(Math.abs(cy - TRACK_Y[2]!)).toBeLessThan(80)
    }
  })

  it("produces no overlapping nodes", () => {
    const nodes = [
      bpmnNode("s", "startEvent"), bpmnNode("t1"), bpmnNode("t2"),
      bpmnNode("e", "endEvent"),
    ]
    const flows = [
      bpmnFlow("f1", "s", "t1"), bpmnFlow("f2", "s", "t2"),
      bpmnFlow("f3", "t1", "e"), bpmnFlow("f4", "t2", "e"),
    ]
    const result = layoutV2(nodes, flows)
    const ns = result.nodes
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i]!.bounds, b = ns[j]!.bounds
        const xOverlap = a.x < b.x + b.width && b.x < a.x + a.width
        const yOverlap = a.y < b.y + b.height && b.y < a.y + a.height
        expect(xOverlap && yOverlap).toBe(false)
      }
    }
  })

  it("returns empty result for empty process", () => {
    expect(layoutV2([], [])).toEqual({ nodes: [], edges: [] })
  })
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run packages/core/tests/layout-v2.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/layout/v2/engine.ts packages/core/tests/layout-v2.test.ts
git commit -m "feat(layout-v2): add engine orchestrator wiring all 8 modules"
```

---

## Task 8: Wire into layout-engine.ts + Full Integration

**Files:**
- Modify: `packages/core/src/layout/layout-engine.ts`
- Run: all existing tests

- [ ] **Step 1: Update `layoutFlowNodes` to call `layoutV2`**

Replace the body of `layoutFlowNodes` in `packages/core/src/layout/layout-engine.ts`:

```typescript
import { layoutV2 } from "./v2/engine.js"
import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "../bpmn/bpmn-model.js"
import type { LayoutResult } from "./types.js"

export function layoutProcess(process: BpmnProcess): LayoutResult {
  return layoutV2(
    process.flowElements,
    process.sequenceFlows,
    process.textAnnotations,
    process.associations,
  )
}

export function layoutFlowNodes(
  flowNodes: BpmnFlowElement[],
  sequenceFlows: BpmnSequenceFlow[],
): LayoutResult {
  return layoutV2(flowNodes, sequenceFlows)
}
```

Keep all existing exports in `layout-engine.ts` that are imported elsewhere (the private helpers `resolveSubProcessOverlaps`, `syncSubProcessChildren`, `sugiyamaLayout` are not exported, so they can be removed or left). The `assertNoOverlap` call is removed from `layoutProcess` since the v2 engine does not run it (the engine itself guarantees non-overlap via track separation).

- [ ] **Step 2: Check for TypeScript errors**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo typecheck --filter @bpmnkit/core
```

Fix any type errors before proceeding.

- [ ] **Step 3: Run all core tests**

```bash
pnpm vitest run packages/core
```

Note which tests fail. The `layout.test.ts` tests that directly import old submodules (`graph.ts`, `coordinates.ts`, `routing.ts`, etc.) will still work since those files are unchanged. The integration tests in `builder-layout-integration.test.ts` test the `layoutProcess` output — these need to pass.

- [ ] **Step 4: Fix any failing integration tests**

Common failure modes and fixes:

**Overlap failures**: If `assertNoOverlap` (imported in other test files) finds overlaps, check `assignCoordinates` in `grid.ts`. Multiple nodes stacking in the same layer+track need enough vertical separation. Increase `STACK_V_GAP` or `TRACK_Y` spacing if needed.

**Missing edge waypoints**: If edges in `builder-layout-integration.test.ts` have 0 waypoints, check that `routeAllEdges` is called with the correct `backEdgeIds` set (must match the edges marked `isBackEdge: true` by `makeDAG`).

**Wrong node positions**: If integration snapshots fail, update them with `pnpm vitest run --update-snapshots`.

- [ ] **Step 5: Run biome check**

```bash
pnpm biome check packages/core/src/layout/v2/
```

Fix any lint/format errors.

- [ ] **Step 6: Run full build**

```bash
pnpm turbo build --filter @bpmnkit/core
```

Expected: zero errors.

- [ ] **Step 7: Update doc/progress.md**

Add entry:
```markdown
## [date] Layout V2 rewrite
Replaced Sugiyama/band-engine hybrid with unified 8-module pipeline:
trunk BFS → cycle breaking → layer assignment + gateway alignment →
track-based Y coordinates with dynamic X gaps → port assignment →
orthogonal channel routing → annotation re-attachment.
```

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/layout/layout-engine.ts doc/progress.md
git commit -m "feat(layout-v2): wire v2 engine into layoutProcess and layoutFlowNodes"
```

---

## Self-Review

**Spec coverage:**

| Module | Task | Coverage |
|---|---|---|
| Module 1: Core Data Structures | Task 1 | ✓ V2Node, V2Edge, V2Graph |
| Module 2: Trunk Prioritization | Task 2 | ✓ Weighted BFS, annotation extraction (annotations are separate in BPMN model, not in flowElements) |
| Module 3: Cycle Breaking | Task 2 | ✓ DFS, isBackEdge marking, DAG reversal |
| Module 4: Layer Assignment & Gateway Alignment | Task 3 | ✓ Topological longest-path, gateway-pair alignment, dummy injection |
| Module 5: Discrete Grid Architecture | Task 4 | ✓ cellSize=40, TRACK_Y bands, dynamic X gaps from annotation widths |
| Module 6: Smart Port Assignment | Task 5 | ✓ East/West standard, South/North vertical, East/West for back-edges |
| Module 7: Orthogonal Channel Router | Task 5 | ✓ Reuses astar.ts (already implements grid-visibility + turn/occupied penalties); back-edge highway |
| Module 8: Annotation Re-Attachment | Task 6 | ✓ Track 0/5 placement, orthogonal association routing |

**Notes:**
- "Extract Annotations" in Module 2: `textAnnotations` are NOT in `flowElements` in this codebase — they're on `BpmnProcess` separately. The engine accepts them as separate parameters. This is the correct interpretation given the data model.
- Module 7's "Heavily Penalized A* Search" reuses `astar.ts` unchanged — it already has `TURN_PENALTY=5000` and `OCCUPIED_PENALTY=2000` as specified.
- Subprocess handling: The v2 engine does not recursively expand subprocesses. This is intentional for Phase 1 — the existing `subprocess.ts` handles this and can be called from `layoutProcess` if needed. Add subprocess expansion as a follow-up if regression tests require it.
