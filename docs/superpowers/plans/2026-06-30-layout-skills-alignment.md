# Layout Skills Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align layout constants and behavior with canonical Camunda BPMN skill specs: subprocess padding, horizontal spacing, boundary event center-bottom placement, adHocSubProcess grid layout, and lane proportional height.

**Architecture:** Four independent changes across `packages/core/src/layout/` and `packages/core/src/bpmn/auto-layout.ts`. Each task is self-contained with its own test cycle. All use Vitest and the existing test helpers in `packages/core/tests/`.

**Tech Stack:** TypeScript strict, Vitest, `packages/core` layout module.

## Global Constraints

- Zero TypeScript errors, zero Biome warnings after every task — run `pnpm turbo typecheck` and `pnpm biome check .` before commit.
- All existing tests must pass after every task — run `pnpm turbo test` (or `pnpm vitest run --project core` for speed).
- Touch only files mentioned in each task's **Files** section — no "while I'm in here" cleanups.
- No new exported functions unless a task explicitly says to export one.
- All boundary-event behavior must continue to pass `assertNoOverlap` (the harness already calls it in every `layoutProcess` call).

---

### Task 1: Constants — subprocess padding (20 → 50) and grid cell width (130 → 150)

**Files:**
- Modify: `packages/core/src/layout/types.ts:28,37`
- Modify: `packages/core/tests/layout.test.ts:252-254` (update stale comment + tighten assertion)

**Interfaces:**
- Consumes: nothing new
- Produces: `SUBPROCESS_PADDING = 50`, `GRID_CELL_WIDTH = 150`, `HORIZONTAL_SPACING = 50` (all downstream code reads these constants — no call-site changes needed)

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/tests/layout.test.ts` inside the existing `describe("Coordinate assignment", ...)` block (after line 272):

```typescript
it("GRID_CELL_WIDTH provides at least 50px gap between layer right-edges and next layer left-edge", () => {
    const flowNodes = [node("start", "startEvent"), node("task", "serviceTask")]
    const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]))
    const orderedLayers = [["start"], ["task"]]

    const result = assignCoordinates(orderedLayers, nodeIndex)

    const startNode = result.find((n) => n.id === "start")
    const taskNode = result.find((n) => n.id === "task")
    expect(startNode).toBeDefined()
    expect(taskNode).toBeDefined()
    if (!startNode || !taskNode) return

    const startRight = startNode.bounds.x + startNode.bounds.width
    expect(taskNode.bounds.x).toBeGreaterThanOrEqual(startRight + 50 - 1)
})
```

Add to `packages/core/tests/layout.test.ts` inside the existing `describe("Sub-process / expanded container layout", ...)` block (after the subprocess test at ~line 792):

```typescript
it("expanded subprocess has at least 50px padding on each side around its content", () => {
    const subprocess = node("sub", "subProcess") as BpmnFlowElement & {
        flowElements: BpmnFlowElement[]
        sequenceFlows: BpmnSequenceFlow[]
    }
    subprocess.flowElements = [node("c1", "serviceTask")]
    subprocess.sequenceFlows = []

    const process = proc(
        "p_padding",
        [node("s", "startEvent"), subprocess, node("e", "endEvent")],
        [flow("f1", "s", "sub"), flow("f2", "sub", "e")],
    )

    const result = layoutProcess(process)
    const container = result.nodes.find((n) => n.id === "sub")
    const child = result.nodes.find((n) => n.id === "c1")
    expect(container).toBeDefined()
    expect(child).toBeDefined()
    if (!container || !child) return

    // Child must be at least 50px inside each container edge
    expect(child.bounds.x - container.bounds.x).toBeGreaterThanOrEqual(49)
    expect(child.bounds.y - container.bounds.y).toBeGreaterThanOrEqual(49)
    expect(
        container.bounds.x + container.bounds.width - (child.bounds.x + child.bounds.width),
    ).toBeGreaterThanOrEqual(49)
    expect(
        container.bounds.y + container.bounds.height - (child.bounds.y + child.bounds.height),
    ).toBeGreaterThanOrEqual(49)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run --project core packages/core/tests/layout.test.ts
```

Expected: the two new tests fail (subprocess padding test fails because current padding is 20, not 50; the GRID_CELL_WIDTH test fails because the current spacing is 30, not 50).

- [ ] **Step 3: Apply the constant changes**

In `packages/core/src/layout/types.ts`, change line 28:

```typescript
// Before
export const GRID_CELL_WIDTH = 130
// After
export const GRID_CELL_WIDTH = 150
```

And change line 37:

```typescript
// Before
export const SUBPROCESS_PADDING = 20
// After
export const SUBPROCESS_PADDING = 50
```

- [ ] **Step 4: Update the stale comment in the existing horizontal-spacing test**

In `packages/core/tests/layout.test.ts`, find the existing test at line ~252:

```typescript
// Task should be at least HORIZONTAL_SPACING (30px) after start's right edge
const startRight = startNode.bounds.x + startNode.bounds.width
expect(taskNode.bounds.x).toBeGreaterThanOrEqual(startRight + 30 - 1)
```

Replace with:

```typescript
// Task should be at least HORIZONTAL_SPACING (50px) after start's right edge
const startRight = startNode.bounds.x + startNode.bounds.width
expect(taskNode.bounds.x).toBeGreaterThanOrEqual(startRight + 50 - 1)
```

- [ ] **Step 5: Run all tests**

```bash
pnpm vitest run --project core
```

Expected: all tests pass, including both new tests.

- [ ] **Step 6: Typecheck and lint**

```bash
pnpm turbo typecheck && pnpm biome check .
```

Expected: zero errors, zero warnings.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/layout/types.ts packages/core/tests/layout.test.ts
git commit -m "fix: align layout constants with canonical BPMN skill spec

Increase SUBPROCESS_PADDING from 20px to 50px (matching the skill's
50px-padding rule for subprocess boundaries) and GRID_CELL_WIDTH from
130px to 150px (matching the ~150px center-to-center spacing guideline
for horizontal element placement in the Sugiyama path).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Boundary event center-bottom placement

Single boundary event goes at the horizontal center of the host task's bottom edge. Multiple events distribute evenly along the bottom edge.

**Files:**
- Modify: `packages/core/src/layout/layout-engine.ts:57-75` (the x-placement block inside `repositionBoundaryEvents`)

**Interfaces:**
- Consumes: `repositionBoundaryEvents` internal — no public API change
- Produces: same function signature; boundary event x-coords now symmetric

- [ ] **Step 1: Write the failing test**

In `packages/core/tests/builder-layout-integration.test.ts`, add after the existing test "boundary events are positioned on the bottom edge of their host task" (after line 588):

```typescript
it("single boundary event is placed at horizontal center of host task bottom edge", () => {
    const defs = Bpmn.createProcess("P")
        .withAutoLayout()
        .startEvent("S")
        .serviceTask("T", { name: "task", taskType: "t" })
        .endEvent("E")
        .element("T")
        .boundaryEvent("B", { attachedTo: "T", cancelActivity: false, timerDuration: "PT1H" })
        .endEvent("EB")
        .build()

    const diagram = firstDiagram(defs)
    const taskShape = shapeFor(diagram.plane.shapes, "T")
    const bShape = shapeFor(diagram.plane.shapes, "B")

    const taskCenterX = taskShape.bounds.x + taskShape.bounds.width / 2
    const bCenterX = bShape.bounds.x + bShape.bounds.width / 2
    const taskBottom = taskShape.bounds.y + taskShape.bounds.height
    const bCenterY = bShape.bounds.y + bShape.bounds.height / 2

    // Center must be within 1px of task center horizontally
    expect(Math.abs(bCenterX - taskCenterX)).toBeLessThanOrEqual(1)
    // Must be at bottom edge vertically
    expect(bCenterY).toBeCloseTo(taskBottom, 0)
})

it("two boundary events are distributed symmetrically on host task bottom edge", () => {
    const defs = Bpmn.createProcess("P")
        .withAutoLayout()
        .startEvent("S")
        .serviceTask("T", { name: "task", taskType: "t" })
        .endEvent("E")
        .element("T")
        .boundaryEvent("B1", { attachedTo: "T", cancelActivity: false, timerDuration: "PT1H" })
        .endEvent("EB1")
        .element("T")
        .boundaryEvent("B2", { attachedTo: "T", cancelActivity: false, timerDuration: "PT2H" })
        .endEvent("EB2")
        .build()

    const diagram = firstDiagram(defs)
    const taskShape = shapeFor(diagram.plane.shapes, "T")
    const b1Shape = shapeFor(diagram.plane.shapes, "B1")
    const b2Shape = shapeFor(diagram.plane.shapes, "B2")

    const taskCenterX = taskShape.bounds.x + taskShape.bounds.width / 2
    const b1CenterX = b1Shape.bounds.x + b1Shape.bounds.width / 2
    const b2CenterX = b2Shape.bounds.x + b2Shape.bounds.width / 2

    // The two events must be symmetric around task center (within 1px)
    const leftDistance = Math.abs(taskCenterX - b1CenterX)
    const rightDistance = Math.abs(taskCenterX - b2CenterX)
    expect(Math.abs(leftDistance - rightDistance)).toBeLessThanOrEqual(2)

    // Must not overlap
    shapesDoNotOverlap(b1Shape, b2Shape)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run --project core packages/core/tests/builder-layout-integration.test.ts
```

Expected: both new tests fail — "center must be within 1px" fails because current code places the event at the right corner.

- [ ] **Step 3: Implement the new placement logic**

In `packages/core/src/layout/layout-engine.ts`, find the `repositionBoundaryEvents` function. The outer `for (const [hostId, beIds] of boundaryMap)` loop currently starts like this:

```typescript
for (const [hostId, beIds] of boundaryMap) {
    const hostNode = nodeById.get(hostId)
    if (!hostNode) continue

    for (let i = 0; i < beIds.length; i++) {
        const beId = beIds[i]
        if (!beId) continue
        const beNode = nodeById.get(beId)
        if (!beNode) continue

        const bW = beNode.bounds.width
        const bH = beNode.bounds.height

        // Place boundary event on the bottom edge of the host task, stacking leftward
        const rightEdge = hostNode.bounds.x + hostNode.bounds.width
        beNode.bounds.x = Math.round(rightEdge - bW / 2 - i * (bW + 4))
        beNode.bounds.y = Math.round(hostNode.bounds.y + hostNode.bounds.height - bH / 2)
```

Replace this entire block (from the opening `for (const [hostId, beIds]` through the two `beNode.bounds.x` and `beNode.bounds.y` lines) with:

```typescript
for (const [hostId, beIds] of boundaryMap) {
    const hostNode = nodeById.get(hostId)
    if (!hostNode) continue

    // Pre-compute distribution parameters (all boundary events share the same fixed size).
    // Distribute events evenly along the bottom edge, centered on the task.
    // effectiveSpacing guarantees events don't overlap (min bW + 4px gap).
    const firstBeNode = nodeById.get(beIds[0] ?? "")
    const bW = firstBeNode?.bounds.width ?? 36
    const bH = firstBeNode?.bounds.height ?? 36
    const n = beIds.length
    const effectiveSpacing = Math.max(Math.round(hostNode.bounds.width / (n + 1)), bW + 4)
    const groupWidth = Math.max(0, n - 1) * effectiveSpacing
    const groupStartCenterX = Math.round(
        hostNode.bounds.x + hostNode.bounds.width / 2 - groupWidth / 2,
    )

    for (let i = 0; i < beIds.length; i++) {
        const beId = beIds[i]
        if (!beId) continue
        const beNode = nodeById.get(beId)
        if (!beNode) continue

        // bW / bH come from the pre-loop computation (all BEs are fixed 36×36)

        // Center-bottom distribution: single event → task center; multiple → even spread
        beNode.bounds.x = Math.round(groupStartCenterX + i * effectiveSpacing - bW / 2)
        beNode.bounds.y = Math.round(hostNode.bounds.y + hostNode.bounds.height - bH / 2)
```

The rest of the inner loop body (labelBounds update, chain BFS, chain placement, edge re-routing) is unchanged — leave it as-is. The only thing that changed is:
1. `bW` and `bH` are declared before the inner loop (not inside it), so remove the inner declarations.
2. The two placement lines are replaced.

To remove the now-duplicate inner declarations of `bW` and `bH`: delete the lines `const bW = beNode.bounds.width` and `const bH = beNode.bounds.height` inside the inner loop (they're declared before the loop now).

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run --project core
```

Expected: all tests pass, including both new ones and the existing "boundary events are positioned on the bottom edge" test.

- [ ] **Step 5: Typecheck and lint**

```bash
pnpm turbo typecheck && pnpm biome check .
```

Expected: zero errors, zero warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/layout/layout-engine.ts packages/core/tests/builder-layout-integration.test.ts
git commit -m "fix: place boundary events at center-bottom of host task

Single boundary event now aligns to the horizontal center of the host
task's bottom edge, matching the canonical layout-rules.md formula.
Multiple events distribute symmetrically using even spacing, replacing
the previous right-corner stacking.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: adHocSubProcess grid layout for tool-heavy containers

When an `adHocSubProcess` has no sequence flows (all-tools mode), arrange inner activities in a grid (max 4 columns) instead of a single horizontal row. Prevents very wide containers for agent processes with many tools.

**Files:**
- Modify: `packages/core/src/layout/subprocess.ts`
- Modify: `packages/core/tests/layout.test.ts` (add one test)

**Interfaces:**
- Consumes: `LayoutNode` from `types.ts` (no change to its shape)
- Produces: same `SubProcessChildResult[]` return type from `layoutSubProcesses`

- [ ] **Step 1: Write the failing test**

In `packages/core/tests/layout.test.ts`, add inside the existing `describe("Sub-process / expanded container layout", ...)` block:

```typescript
it("adHocSubProcess with 6 disconnected tools wraps into multiple grid rows", () => {
    const subproc = node("agent", "adHocSubProcess") as BpmnFlowElement & {
        flowElements: BpmnFlowElement[]
        sequenceFlows: BpmnSequenceFlow[]
    }
    subproc.flowElements = [
        node("t1", "serviceTask"),
        node("t2", "serviceTask"),
        node("t3", "serviceTask"),
        node("t4", "serviceTask"),
        node("t5", "serviceTask"),
        node("t6", "serviceTask"),
    ]
    subproc.sequenceFlows = []

    const process = proc(
        "p_grid",
        [node("s", "startEvent"), subproc, node("e", "endEvent")],
        [flow("f1", "s", "agent"), flow("f2", "agent", "e")],
    )

    const result = layoutProcess(process)

    const container = result.nodes.find((n) => n.id === "agent")
    const toolNodes = ["t1", "t2", "t3", "t4", "t5", "t6"].map((id) =>
        result.nodes.find((n) => n.id === id),
    )
    expect(container).toBeDefined()
    toolNodes.forEach((n) => expect(n).toBeDefined())
    if (!container) return
    const defined = toolNodes.filter(Boolean) as LayoutNode[]

    // Must have at least 2 distinct Y rows (grid wrapped)
    const yValues = new Set(defined.map((n) => n.bounds.y))
    expect(yValues.size).toBeGreaterThan(1)

    // All tools inside the container
    for (const n of defined) {
        expect(n.bounds.x).toBeGreaterThanOrEqual(container.bounds.x)
        expect(n.bounds.y).toBeGreaterThanOrEqual(container.bounds.y)
        expect(n.bounds.x + n.bounds.width).toBeLessThanOrEqual(
            container.bounds.x + container.bounds.width + 1,
        )
        expect(n.bounds.y + n.bounds.height).toBeLessThanOrEqual(
            container.bounds.y + container.bounds.height + 1,
        )
    }

    // No overlaps
    expect(() => assertNoOverlap(result)).not.toThrow()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run --project core packages/core/tests/layout.test.ts
```

Expected: the new test fails on `expect(yValues.size).toBeGreaterThan(1)` — currently all 6 tools land in a single horizontal row.

- [ ] **Step 3: Add the grid layout helper and hook it in**

In `packages/core/src/layout/subprocess.ts`, add the following after the imports at the top (before `isSubProcess`):

```typescript
const ADHOC_MAX_COLS = 4
const ADHOC_H_GAP = 50
const ADHOC_V_GAP = 80

/**
 * Rearrange disconnected adHocSubProcess tool nodes into a grid.
 * Nodes start at (0, 0) so the subprocess padding offset applies cleanly.
 */
function applyAdHocGridLayout(nodes: LayoutNode[]): void {
    if (nodes.length === 0) return
    const cols = Math.min(nodes.length, ADHOC_MAX_COLS)
    const cellW = nodes.reduce((max, n) => Math.max(max, n.bounds.width), 0)
    const cellH = nodes.reduce((max, n) => Math.max(max, n.bounds.height), 0)

    for (let i = 0; i < nodes.length; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const n = nodes[i]
        if (!n) continue
        const newX = col * (cellW + ADHOC_H_GAP) + Math.round((cellW - n.bounds.width) / 2)
        const newY = row * (cellH + ADHOC_V_GAP) + Math.round((cellH - n.bounds.height) / 2)
        const dx = newX - n.bounds.x
        const dy = newY - n.bounds.y
        n.bounds.x = newX
        n.bounds.y = newY
        if (n.labelBounds) {
            n.labelBounds.x += dx
            n.labelBounds.y += dy
        }
    }
}
```

Then, in `layoutSubProcesses`, after the call to `layoutFlowNodes` and before the bounding-box computation, add:

```typescript
const childResult = layoutFlowNodes(subProcess.flowElements, subProcess.sequenceFlows ?? [])

// For adHocSubProcess with no sequence flows, rearrange into a compact grid
// instead of a single long horizontal row.
if (
    bpmnNode.type === "adHocSubProcess" &&
    (subProcess.sequenceFlows?.length ?? 0) === 0 &&
    childResult.nodes.length > 0
) {
    applyAdHocGridLayout(childResult.nodes)
}

if (childResult.nodes.length === 0) continue

// Compute bounding box of child elements
```

The existing bounding-box computation and the rest of the loop body are unchanged.

- [ ] **Step 4: Run all tests**

```bash
pnpm vitest run --project core
```

Expected: all tests pass, including the new grid test. The existing regression test ("does not throw overlap when subprocess children shift...") must also pass — verify the console shows no test failures.

- [ ] **Step 5: Typecheck and lint**

```bash
pnpm turbo typecheck && pnpm biome check .
```

Expected: zero errors, zero warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/layout/subprocess.ts packages/core/tests/layout.test.ts
git commit -m "feat: grid layout for adHocSubProcess tool activities

When an adHocSubProcess has no sequence flows (all-tools mode), arrange
inner activities in a grid (max 4 columns) instead of a single
horizontal row. Prevents very wide subprocess containers for agent
processes with many tools.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Lane height proportional to content

Allocate pool lane heights proportionally by the content bounding box of each lane instead of equal tiles.

**Files:**
- Modify: `packages/core/src/bpmn/auto-layout.ts:252-265` (the `buildLaneShapes` function tail)
- Modify: `packages/core/tests/layout.test.ts` (add one test)

**Interfaces:**
- Consumes: `buildLaneShapes` internal — no public API change
- Produces: same `BpmnDiShape[]` return type; lane heights now reflect content distribution

- [ ] **Step 1: Write the failing test**

`buildLaneShapes` is not exported, so test it via `applyAutoLayout`. Add the following to `packages/core/tests/layout.test.ts` in a new `describe` block at the end of the file:

```typescript
import { applyAutoLayout } from "../src/bpmn/auto-layout.js"
import type { BpmnDefinitions, BpmnLane, BpmnProcess } from "../src/bpmn/bpmn-model.js"
```

Add the import at the top of the test file (joining the other imports). Then add at the end of the file:

```typescript
describe("Lane proportional height", () => {
    /** Build a minimal BpmnDefinitions with two lanes and a collaboration. */
    function makeProcess(laneANodes: BpmnFlowElement[], laneBNodes: BpmnFlowElement[]): BpmnDefinitions {
        const allNodes = [...laneANodes, ...laneBNodes]
        const laneA: BpmnLane = {
            id: "laneA",
            name: "Lane A",
            flowNodeRefs: laneANodes.map((n) => n.id),
            unknownAttributes: {},
        }
        const laneB: BpmnLane = {
            id: "laneB",
            name: "Lane B",
            flowNodeRefs: laneBNodes.map((n) => n.id),
            unknownAttributes: {},
        }
        const process: BpmnProcess = {
            id: "proc",
            flowElements: allNodes,
            sequenceFlows: [
                flow("f1", allNodes[0]?.id ?? "s", allNodes[allNodes.length - 1]?.id ?? "e"),
            ],
            textAnnotations: [],
            associations: [],
            laneSet: { id: "ls1", lanes: [laneA, laneB] },
        }
        return {
            id: "defs",
            processes: [process],
            collaborations: [
                {
                    id: "collab",
                    participants: [{ id: "part1", processRef: "proc", unknownAttributes: {} }],
                    messageFlows: [],
                    unknownAttributes: {},
                },
            ],
            messages: [],
            errors: [],
            signals: [],
            escalations: [],
            diagrams: [],
            unknownAttributes: {},
        }
    }

    it("lane with more elements gets more height than lane with fewer elements", () => {
        // Lane A: 4 service tasks (will occupy more vertical space)
        const laneANodes = [
            node("a1", "serviceTask"),
            node("a2", "serviceTask"),
            node("a3", "serviceTask"),
            node("a4", "serviceTask"),
        ]
        // Lane B: 1 service task (minimal vertical space)
        const laneBNodes = [node("b1", "serviceTask")]

        const defs = makeProcess(laneANodes, laneBNodes)
        const result = applyAutoLayout(defs)

        const diagram = result.diagrams[0]
        expect(diagram).toBeDefined()
        if (!diagram) return

        const laneAShape = diagram.plane.shapes.find((s) => s.bpmnElement === "laneA")
        const laneBShape = diagram.plane.shapes.find((s) => s.bpmnElement === "laneB")
        expect(laneAShape).toBeDefined()
        expect(laneBShape).toBeDefined()
        if (!laneAShape || !laneBShape) return

        // Lane A has 4 tasks vs 1 task — must be taller
        expect(laneAShape.bounds.height).toBeGreaterThan(laneBShape.bounds.height)
    })

    it("lane heights sum to pool height", () => {
        const laneANodes = [node("a1", "serviceTask"), node("a2", "serviceTask")]
        const laneBNodes = [node("b1", "serviceTask")]

        const defs = makeProcess(laneANodes, laneBNodes)
        const result = applyAutoLayout(defs)

        const diagram = result.diagrams[0]
        if (!diagram) return

        const laneShapes = diagram.plane.shapes.filter(
            (s) => s.bpmnElement === "laneA" || s.bpmnElement === "laneB",
        )
        const poolShape = diagram.plane.shapes.find((s) => s.bpmnElement === "part1")
        expect(laneShapes).toHaveLength(2)
        expect(poolShape).toBeDefined()
        if (!poolShape) return

        const totalLaneH = laneShapes.reduce((sum, s) => sum + s.bounds.height, 0)
        // Lane heights must sum to pool height (within 1px for rounding)
        expect(Math.abs(totalLaneH - poolShape.bounds.height)).toBeLessThanOrEqual(1)
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run --project core packages/core/tests/layout.test.ts
```

Expected: "lane with more elements gets more height" fails because current equal-tiling gives both lanes the same height.

- [ ] **Step 3: Implement proportional lane height**

In `packages/core/src/bpmn/auto-layout.ts`, replace the tail of `buildLaneShapes` (the part that computes `tileH` and the final `return sortedLanes.map(...)`) with:

```typescript
    // Compute natural content height per lane (content bounding box + padding)
    const MIN_LANE_H = 80
    const LANE_CONTENT_PADDING = 20

    const naturalHeights = sortedLanes.map((lane) => {
        const laneNodes = nodes.filter((n) => elemToLane.get(n.id) === lane.id)
        if (laneNodes.length === 0) return MIN_LANE_H
        const minTop = Math.min(...laneNodes.map((n) => n.bounds.y + dy - LANE_CONTENT_PADDING))
        const maxBottom = Math.max(
            ...laneNodes.map((n) => n.bounds.y + n.bounds.height + dy + LANE_CONTENT_PADDING),
        )
        return Math.max(maxBottom - minTop, MIN_LANE_H)
    })

    const totalNatural = naturalHeights.reduce((a, b) => a + b, 0)

    // Scale proportionally to poolHeight so all lanes fill the pool exactly
    const scaledHeights = naturalHeights.map((h) => Math.round((h / totalNatural) * poolHeight))
    // Fix last lane for rounding drift
    if (scaledHeights.length > 0) {
        scaledHeights[scaledHeights.length - 1] =
            poolHeight - scaledHeights.slice(0, -1).reduce((a, b) => a + b, 0)
    }

    let cumulativeY = 0
    return sortedLanes.map((lane, i) => {
        const laneH = Math.max(scaledHeights[i] ?? MIN_LANE_H, MIN_LANE_H)
        const shape: BpmnDiShape = {
            id: `${lane.id}_di`,
            bpmnElement: lane.id,
            isHorizontal: true,
            bounds: {
                x: Math.round(poolHeaderWidth),
                y: Math.round(poolY + cumulativeY),
                width: Math.round(laneContentWidth),
                height: Math.round(laneH),
            },
            unknownAttributes: {},
        }
        cumulativeY += laneH
        return shape
    })
```

The code above replaces the existing:

```typescript
    const tileH = Math.round(poolHeight / sortedLanes.length)
    return sortedLanes.map((lane, i) => ({
        id: `${lane.id}_di`,
        bpmnElement: lane.id,
        isHorizontal: true,
        bounds: {
            x: Math.round(poolHeaderWidth),
            y: Math.round(poolY + i * tileH),
            width: Math.round(laneContentWidth),
            height: Math.round(i === sortedLanes.length - 1 ? poolHeight - i * tileH : tileH),
        },
        unknownAttributes: {},
    }))
```

The `BpmnDiShape` type is already imported in this file (used by `nodeToShape`). No new imports needed.

- [ ] **Step 4: Run all tests**

```bash
pnpm vitest run --project core
```

Expected: all tests pass. The two new lane tests pass; no regressions in other tests.

- [ ] **Step 5: Typecheck and lint**

```bash
pnpm turbo typecheck && pnpm biome check .
```

Expected: zero errors, zero warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/bpmn/auto-layout.ts packages/core/tests/layout.test.ts
git commit -m "feat: allocate pool lane heights proportional to content

Replace equal-tile lane allocation with proportional heights based on
each lane's content bounding box. Lane A with 4 tasks now gets more
vertical space than lane B with 1 task. Total lane heights continue to
sum exactly to pool height.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Documentation update

**Files:**
- Modify: `doc/progress.md` (prepend changelog entry)
- Modify: `doc/features.md` (update Layout section)

- [ ] **Step 1: Prepend entry to `doc/progress.md`**

Add the following at the very top of `doc/progress.md` (before all existing content):

```markdown
## 2026-06-30 — Layout skills alignment

- **Subprocess padding**: increased from 20px to 50px, matching the canonical `layout-rules.md` 50px-padding rule.
- **Horizontal spacing** (Sugiyama path): `GRID_CELL_WIDTH` increased from 130px to 150px, giving 150px center-to-center element spacing.
- **Boundary event placement**: single event now centers horizontally on host task bottom edge; multiple events distribute symmetrically instead of stacking from the right corner.
- **adHocSubProcess grid layout**: tools with no sequence flows tile into a max-4-column grid instead of an unbounded horizontal row.
- **Lane proportional height**: pool lane heights scale with lane content bounding box instead of equal tiles.
```

- [ ] **Step 2: Update `doc/features.md`**

Find the section in `doc/features.md` that covers auto-layout (search for "auto-layout" or "layout"). Update or append under the relevant heading:

```markdown
- **[2026-06-30] Layout constants match canonical Camunda BPMN skill spec**: subprocess padding 50px, Sugiyama horizontal spacing 150px center-to-center.
- **[2026-06-30] Boundary event center-bottom placement**: single event at task center-bottom; multiple events symmetrically distributed.
- **[2026-06-30] adHocSubProcess tool grid layout**: agent tools tile into rows of up to 4 columns.
- **[2026-06-30] Lane proportional height**: pool lanes sized relative to content, not equal tiles.
```

- [ ] **Step 3: Commit**

```bash
git add doc/progress.md doc/features.md
git commit -m "docs: record layout skills-alignment improvements

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage check:**

| Improvement | Task |
|---|---|
| `SUBPROCESS_PADDING` 20 → 50 | Task 1 |
| `GRID_CELL_WIDTH` 130 → 150 | Task 1 |
| Boundary event center-bottom (single) | Task 2 |
| Boundary event symmetric distribution (multiple) | Task 2 |
| adHocSubProcess grid layout | Task 3 |
| Lane proportional height | Task 4 |
| Docs | Task 5 |

**Placeholder scan:** None found — all steps include specific code, exact paths, and runnable commands.

**Type consistency check:**
- `LayoutNode` referenced in Tasks 1-4: consistent type from `types.ts`.
- `BpmnDefinitions`, `BpmnLane`, `BpmnProcess`: all from `bpmn-model.ts`, consistent with existing usages.
- `applyAutoLayout` import in test: matches the export in `auto-layout.ts`.
- `applyAdHocGridLayout`: private helper, not exported; consistent usage across Task 3.
