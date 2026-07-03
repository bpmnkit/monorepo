# Grid-Based BPMN Auto-Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace bpmnkit's block-tree/Sugiyama layout core with a native TypeScript reimplementation of the bpmn-io `bpmn-auto-layout` grid algorithm — the layout users report as "better, especially for edge cases, and more Camunda-like" — while keeping every capability the current engine has that the upstream library lacks (multi-participant pools, lanes, expanded subprocesses, boundary-event chains, text annotations), and closing two quality gaps (annotation packing, message-flow routing).

**Architecture:** A DFS walker places flow nodes into a sparse row/column `Grid` (150×140 px cells); joins are realigned to their predecessors; boundary-event successors branch down-right; expanded subprocesses get their own grid nested into an enlarged parent cell. A deterministic Manhattan router produces orthogonal waypoints from grid positions (5 case shapes). The existing `applyAutoLayout` pool/lane/DI layer stays on top unchanged, with its annotation pass replaced by a text-measuring skyline packer (port of the proven `tmp/01-annotation-layouting.cjs`) and a new message-flow router added. The public contract (`layoutProcess`, `layoutFlowNodes`, `applyAutoLayout`, `LayoutResult`) is unchanged, so all 12 consumers keep working.

**Tech Stack:** TypeScript strict, Vitest, Biome (tabs, double quotes, no semicolons), pnpm + Turborepo. **No new runtime dependencies** (repo policy forbids adding `bpmn-auto-layout`/`bpmn-moddle`; the algorithm is small and fully specified below).

## Global Constraints

- No new external packages. All code lives in `packages/core`.
- ESM only: relative imports use the `.js` extension (`import { Grid } from "./grid.js"`).
- TypeScript strict mode, zero type errors: `pnpm --filter @bpmnkit/core typecheck`.
- Biome zero warnings: `pnpm biome check packages/core` (tabs, double quotes, no semicolons — match existing files).
- All existing consumers keep compiling: the signatures of `layoutProcess(process: BpmnProcess): LayoutResult`, `layoutFlowNodes(flowNodes: BpmnFlowElement[], sequenceFlows: BpmnSequenceFlow[]): LayoutResult`, and `applyAutoLayout(defs: BpmnDefinitions): BpmnDefinitions` MUST NOT change. `LayoutResult`/`LayoutNode`/`LayoutEdge` in `packages/core/src/layout/types.ts` MUST NOT change shape.
- `applyAutoLayout` MUST continue to return `{ ...defs, diagrams: [...] }` — semantic model untouched, only DI replaced.
- Must NOT regress: multi-participant pools (stacked vertically, `POOL_GAP=30`), lanes (proportional heights filling the pool), expanded subprocesses (recursive layout, `isExpanded: true`), boundary events on host bottom edge with routed chains, text annotations + associations, adHocSubProcess compact grid, edge labels (`labelBounds`), node labels for events/gateways.
- Grid constants stay: `GRID_CELL_WIDTH = 150`, `GRID_CELL_HEIGHT = 140` (exported from `types.ts`; `@bpmnkit/ascii` imports them).
- Every element is centered in its cell: `x = col*150 + (150 − w)/2`, `y = row*140 + (140 − h)/2` (plus shift).
- All edge segments orthogonal: for every adjacent waypoint pair, `Δx === 0 || Δy === 0`.
- Docs: update `doc/progress.md` (every task commits a line), `doc/features.md` on completion. Add a changeset (minor) for `@bpmnkit/core` because public exports are pruned (Task 8).
- Commit after every green task. Commit messages: conventional commits.

---

## Part A — Background and Algorithm Specification (read before coding)

### A.1 Why

User feedback: the pipeline in `tmp/` (`00-layout.cjs` wrapping bpmn-io `bpmn-auto-layout`, `01-annotation-layouting.cjs` annotation post-pass, `02-di-check.cjs` completeness guard) produces better, more Camunda-like layouts than bpmnkit's engine — especially in edge cases (loops, boundary events, unstructured graphs, disconnected fragments).

Why the grid algorithm looks better:
- **Happy path reads as one straight line.** The first outgoing branch always continues on the same row; alternatives stack below. Joins snap back to the highest predecessor row. This is the visual grammar of Camunda Modeler diagrams.
- **Grid discipline.** Every element is centered in a 150×140 cell, so vertical/horizontal alignment is perfect by construction — no post-hoc "alignment passes".
- **Deterministic, local routing.** Waypoints derive from (row, col) deltas via 5 fixed case shapes, not from a 15-pass refinement pipeline that must be re-run to fix its own regressions (see `packages/core/src/layout/layout-engine.ts:397-451`).

Why we reimplement instead of depending on the library:
- Repo policy: no external package when reasonably implementable in-repo (the whole library is ~1,500 lines).
- The library is XML-in/XML-out via `bpmn-moddle` — it would bypass bpmnkit's parsed model and custom serializer and drop `unknownAttributes` fidelity.
- Hard upstream limitations we must not inherit: only the FIRST process of a collaboration is laid out (rest silently dropped — that is what `02-di-check.cjs` guards against); subprocesses are collapsed; annotations, associations, message flows, lanes are not laid out at all.

### A.2 The grid algorithm (complete specification)

Source of truth: bpmn-io `bpmn-auto-layout` v1.3.0, cloned for reference at
`/tmp/claude-1000/-home-adam-github-com-bpmnkit-monorepo/079cf6fe-ac33-4965-8512-dfa11edbc4bc/scratchpad/bpmn-auto-layout/lib/` (files: `Grid.js`, `Layouter.js`, `handler/*.js`, `utils/layoutUtil.js`, `di/DiUtil.js`). If that path is gone, `git clone --depth 1 https://github.com/bpmn-io/bpmn-auto-layout` anywhere under the scratchpad. Everything needed is ALSO written out below — reading the clone is optional cross-checking, not required.

#### A.2.1 Grid

A `Grid` is an array of rows; each row is a sparse array of cells; a cell holds one element or null. Row index = vertical position, column index = horizontal position. Operations (exact semantics — port these):

- `add(el)` — push a NEW row `[el]` at the bottom (used for start elements).
- `add(el, [row, col])` — place at exact cell; throw if occupied.
- `createRow(afterIndex)` — insert a blank row after `afterIndex` (append if omitted).
- `addAfter(el, newEl)` — find `el` at `[r,c]`, `row.splice(c+1, 0, newEl)` — inserts to the RIGHT and shifts the remainder of that row right by one.
- `addBelow(el, newEl)` — find `[r,c]`; if `grid[r+1][c]` occupied, splice a fresh blank row at `r+1`; then place at `[r+1, c]`.
- `find(el)` → `[row, col]` or `[-1, -1]`.
- `getElementsInRange({row,col}, {row,col})` — all non-null elements in the rectangle (bounds may be given in either order).
- `adjustGridPosition(el)` — if `el`'s col < (max col of grid − 1), move it to the last column of its row. Used to right-align a source before fanning out task-only splits.
- `adjustRowForMultipleIncoming(sources, el)` — min existing row among `sources`; if that row < `el`'s row and the cell `[minRow, elCol]` is free, move `el` up there. Aligns a join with its topmost predecessor.
- `adjustColumnForMultipleIncoming(sources, el)` — max col among `sources`; if `maxCol+1 > el`'s col, move `el` right to `[elRow, maxCol+1]`. Pushes a join right of its furthest predecessor.
- `createCol(afterIndex, count)` — insert `count` blank cells after `afterIndex` in EVERY row.
- `getGridDimensions()` → `[rowCount, maxColCount]`.
- `elementsByPosition()` → `{element, row, col}[]` row-major (drives DI emission order).
- `getElementsTotal()` → count of distinct non-null elements.

Upstream bugs NOT to port: `expandRow` guards against an undefined `this.rowCount` (no-op); `add` treats `[0,0]` as "no position". Our port takes an explicit `position?: [number, number]` and only falls back to new-row when `position === undefined`.

#### A.2.2 Placement walk

Per level (process or subprocess):

```
elements   = flowElements minus boundary events    (boundary events are never grid cells)
attachers  = Map hostId → its boundary events (order of appearance)
outgoing   = Map sourceRef → SequenceFlow[]        (build from sequenceFlows, NOT from element.incoming/outgoing strings)
incoming   = Map targetRef → SequenceFlow[]

while visited.size < elements.length:
    starts = elements where !visited AND (no incoming OR !hasOtherIncoming(el))
    if starts is empty:                       # disconnected leftovers / pure cycles
        starts = [first unvisited element]
    for s of starts: grid.add(s)  (new row); visited.add(s)
    stack = [...starts]
    while stack:
        current = stack.pop()
        incomingStep(current)                 # join realignment
        next = outgoingStep(current)          # successor placement
        next = next.concat(attacherStep(current))
        for el of next: stack.push(el)        # (already marked visited by the steps)
```

`hasOtherIncoming(el)`: true iff el has an incoming flow whose source is a "real" predecessor. Precisely, with `flows = incoming.get(el.id) ?? []`:
- `fromHost` = flows where `sourceRef !== el.id` AND source is NOT a boundary event.
- `fromAttached` = flows where `sourceRef !== el.id` AND source is not a boundary event attached to `el` itself.
- return `fromHost.length > 0 || fromAttached.length > 0`.
(Effect: an element fed only by its own boundary event, or fed by nothing, is a start.)

`incomingStep(el)`: sources = resolved source elements of `incoming.get(el.id)`. If `sources.length > 1`: `grid.adjustColumnForMultipleIncoming(sources, el)` then `grid.adjustRowForMultipleIncoming(sources, el)`. Returns nothing.

`outgoingStep(el)` (the core):

```
targets = (outgoing.get(el.id) ?? []).map(f => byId.get(f.targetRef)).filter(defined)
if targets.length > 1 AND every target isTaskLike: grid.adjustGridPosition(el)
previous = null
placed = []
for (target, i) of targets:
    if visited.has(target): continue
    if (previous !== null || stack.length > 0)
       AND isFutureIncoming(target)           # a join whose other feeders aren't placed yet
       AND !formsLoop(target):                # …unless it closes a cycle
        continue                              # defer — it will be placed when its last feeder is popped
    if previous === null:            grid.addAfter(el, target)
    else if el is exclusiveGateway AND target is exclusiveGateway:
                                     grid.addAfter(previous, target)   # chain gateways horizontally
    else:                            grid.addBelow(targets[i-1], target)
    if target !== el: previous = target
    placed.unshift(target)           # reverse order
    visited.add(target)
return sortByType(placed, "exclusiveGateway")  # exclusive gateways first → popped last (LIFO)
```

- `isFutureIncoming(el)`: el has >1 incoming flows and at least one source not visited.
- `formsLoop(el)`: some unvisited incoming source is reachable downstream FROM `el` (DFS over `outgoing` target chains with a visited set).
- `isTaskLike(type)`: `task | userTask | serviceTask | scriptTask | sendTask | receiveTask | businessRuleTask | manualTask` (BPMN `bpmn:Task` subtypes; NOT callActivity, NOT subprocesses).

`attacherStep(host)`: for each boundary event of `host` (in order), for each of its outgoing targets (reversed) not yet visited: find host `[r,c]`; if `grid.get(r+1, c)` or `grid.get(r+1, c+1)` occupied, `grid.createRow(r)`; `grid.add(target, [r+1, c+1])`; mark visited; collect. Return collected targets.

Resulting shapes (acceptance semantics):
- Linear `start→a→b→end` → all in row 0, cols 0..3.
- Split `gw` at `(r,c)` with branches A,B → A at `(r, c+1)` (happy path straight on), B at `(r+1, c+1)`; the join realigns to `(r, maxFeederCol+1)`.
- Boundary-event recovery flow → `(hostRow+1, hostCol+1)`, i.e. down-right diagonal, routed out of the host's bottom.
- Loops → the back target keeps its earlier column; the closing edge is routed around (below/above) by the router.
- Disconnected fragments → each starts a fresh bottom row.

#### A.2.3 Coordinates

- Cell: 150 wide × 140 tall. Element sizes from `ELEMENT_SIZES` (events 36×36, tasks/callActivity 100×80, gateways 50×50).
- Non-expanded: `x = col*150 + (150−w)/2 + shift.x`, `y = row*140 + (140−h)/2 + shift.y`.
- Expanded subprocess with child grid `[rows, cols]`: positioned with the BASE size (100×80) centering offset, then enlarged: `w = cols*150 + 100`, `h = rows*140 + 80`. (Example: child grid 1×2 at cell `(0,1)` → bounds `x=175, y=30, w=400, h=220`.)
- Before emission, the parent grid must be expanded so the enlarged box doesn't cover neighbors: for every column containing an expanded element (scanning right-to-left), insert `max(childCols, 2)` blank columns after it; for every row containing one (bottom-to-top), insert `max(childRows, 1)` blank rows after it.
- Children of an expanded subprocess are emitted into the same coordinate space with `childShift = { x: subBounds.x + 50, y: subBounds.y + 40 }` (upstream: `x + CELL_W/2 − baseW/4`, `y + CELL_H − baseH − baseH/4` with baseW=100, baseH=80).
- Boundary event: `x = round(host.x + host.w/2 − 18)`, `y = round(host.y + host.h − 18)`; with n attachers on one host, the i-th (1-based) sits at `x = host.x + i * host.w/(n+1) − 18`.

#### A.2.4 Routing (`connectElements`)

Inputs per endpoint: absolute `bounds`, grid `(row, col)`, and for expanded subprocesses (or boundary events on an expanded host) the child grid dims. `mid(b) = {x: b.x + b.w/2, y: b.y + b.h/2}`. Docking helper `dock(point, rect, dir)`:
- `"t"` → `{x: point.x, y: rect.y}` — `"b"` → `{x: point.x, y: rect.y + rect.h}` — `"l"` → `{x: rect.x, y: point.y}` — `"r"` → `{x: rect.x + rect.w, y: point.y}`.

With `dX = target.col − source.col`, `dY = target.row − source.row`, `cellTop(row) = row*140 + shift.y` (level-local cell origin — we deviate from upstream by keeping the shift consistent here; upstream forgets it for subprocess children):

- **Self-loop** (`dX===0 && dY===0`): out right, over the top, back in from above.
  `loopX = source.cellLeft + (source.childCols ? (source.childCols+1)*150 : 150)`; `topY = cellTop(source.row)`;
  waypoints: `[dock(srcMid, src, "r"), {x:loopX, y:srcMid.y}, {x:loopX, y:topY}, {x:tgtMid.x, y:topY}, dock(tgtMid, tgt, "t")]`.
- **Back-edge** (`dX < 0`): if `srcMid.y >= tgtMid.y` route BELOW: `downY = cellTop(source.row) + 140 + 140*maxExpandedRowsBetween` (host with child grid: `cellTop + (childRows+1)*140`); waypoints `[dock(srcMid, src, "b"), {x:srcMid.x, y:downY}, {x:tgtMid.x, y:downY}, dock(tgtMid, tgt, "b")]`. Else route ABOVE with `upY = srcMid.y − 70` and top dockings.
- **Same row forward** (`dY===0, dX>0`): if the direct corridor is blocked (see below) route under: `[dock b, {x:srcMid.x, y:underY}, {x:tgtMid.x, y:underY}, dock b]` with `underY = cellTop(source.row) + 140` (`(childRows+1)*140` for an expanded source). Else straight: `[dock(srcMid, src, "r"), dock(tgtMid, tgt, "l")]` — but when an endpoint is an expanded subprocess, pin that endpoint's y to `bounds.y + 40` (dock at header height, not box middle).
- **Same column** (`dX===0, dY!==0`): if blocked, detour right: `yOff = −sign(dY)*70`; `[dock(srcMid, src, "r"), {x:srcMid.x+75, y:srcMid.y}, {x:tgtMid.x+75, y:tgtMid.y+yOff}, {x:tgtMid.x, y:tgtMid.y+yOff}, dock(tgtMid, tgt, yOff>0 ? "b" : "t")]`. Else direct vertical: `[dock(srcMid, src, dY>0?"b":"t"), dock(tgtMid, tgt, dY>0?"t":"b")]`.
- **Diagonal forward** (`dX>0, dY!==0`): try the single-bend Manhattan route:
  - target below (`dY>0`): bend at `(targetRow, sourceCol)` — allowed if the vertical range `(sourceRow..targetRow @ sourceCol)` plus horizontal range `(targetRow, sourceCol..targetCol)` contain ≤ 2 elements total; result `[dock(srcMid, src, "b"), {x:srcMid.x, y:tgtMid.y}, dock(tgtMid, tgt, "l")]`.
  - target above (`dY<0`): bend at `(sourceRow, targetCol)`; result `[dock(srcMid, src, "r"), {x:tgtMid.x, y:srcMid.y}, dock(tgtMid, tgt, "b")]`.
  - blocked → 6-point S-route: `yOff = −sign(dY)*70`;
    `[dock(srcMid, src, "r"), {x:srcMid.x+75, y:srcMid.y}, {x:srcMid.x+75, y:tgtMid.y+yOff}, {x:tgtMid.x−75, y:tgtMid.y+yOff}, {x:tgtMid.x−75, y:tgtMid.y}, dock(tgtMid, tgt, "l")]`.

`isDirectPathBlocked`: count grid elements in the straight corridor — the horizontal range (source row, source col → target col) ONLY when `dX !== 0`, plus the vertical range (target col, source row → target row) ONLY when `dY !== 0`; blocked if count > 2 (endpoints themselves are in the ranges, so 2 = just the endpoints).

Boundary-event edges: route `connectElements(boundaryNode, target)` where the boundary node borrows its HOST's `(row, col)`, then post-fix with `ensureExitBottom`: the first waypoint must be the boundary event's bottom docking `{x: beMid.x, y: be.y + be.h}`; if the second waypoint doesn't continue straight down, insert `{x: beMid.x, y: be.y + be.h + 20}` and an L-bend to rejoin the route.

After each level's edges are routed, collapse collinear consecutive waypoints and round all coordinates.

### A.3 Annotation layout (port of `tmp/01-annotation-layouting.cjs`, layout-space version)

Constants: `ANN_WIDTH=200`, `FONT_CHAR_WIDTH=6.4`, `FONT_LINE_HEIGHT=14.4`, `PADDING_X=18`, `PADDING_Y=14`, `ANN_GAP=20`, `ELEMENT_GAP=30`, `PREFERRED_OFFSET=50`, `MIN_HEIGHT=30`, `HORIZONTAL_SHIFTS=[0,60,−60,120,−120,180,−180,240,−240]`.

1. **Size**: width fixed 200; height from greedy word-wrap of the annotation text at `charsPerLine = floor(max(40, 200−18)/6.4)`, counting hard line breaks, `h = max(30, ceil(lines*14.4 + 14))`.
2. **Side**: `mainFlowY` = modal center-Y (20px buckets) of nodes with `height ≥ 60`; an annotation goes `below` iff its linked element's center-Y `> mainFlowY + 60`, else `above`.
3. **Pack per side**, annotations sorted by linked element center-X: natural position is centered over the linked element at `PREFERRED_OFFSET` gap; for each of the 9 horizontal shift candidates, push the y outward past every overlapping obstacle interval (placed annotations padded by `ANN_GAP`, all non-annotation nodes+labels padded by `ELEMENT_GAP`), keep the candidate minimizing `hypot(dxFromNatural, dyFromNatural)`.
4. **Association waypoints**: edge-to-edge, orthogonal-ish two-pointers — annotation fully above → element-top(clamped x) → annotation-bottom; below → element-bottom → annotation-top; right → element-right(clamped y) → annotation-left; else element-left → annotation-right. Honor original `sourceRef→targetRef` order.

### A.4 What "done" looks like (quality bar)

For every fixture: complete DI (every flow node has a shape, every sequenceFlow/association/messageFlow has an edge — the `02-di-check.cjs` rule, now enforced in-process by Task 10), zero shape overlaps (`assertNoOverlap`), all edges orthogonal, happy path on one row, and byte-stable output on repeated runs (layout is deterministic — no randomness, no Date).

---

## Part B — File Structure

Create (all under `packages/core/src/layout/grid/`):

| File | Responsibility |
|---|---|
| `grid.ts` | `Grid` class — sparse row/col matrix (§A.2.1) |
| `flow-graph.ts` | `FlowGraph` — resolved adjacency, attacher binding, start detection, loop detection (§A.2.2 helpers) |
| `walker.ts` | `createGridLayout(graph, opts)` — the DFS placement (§A.2.2) |
| `grid-router.ts` | `connectElements(...)` — Manhattan waypoints (§A.2.4) |
| `edge-labels.ts` | edge-label placement (moved verbatim from `routing.ts`) |
| `grid-engine.ts` | orchestration: levels, subprocess nesting, bounds, boundary events, node labels → `LayoutResult` |

Create: `packages/core/src/layout/annotations.ts` (§A.3), `packages/core/src/bpmn/di-check.ts` (Task 10).

Modify: `packages/core/src/layout/layout-engine.ts` (delegate to grid engine, delete old pipeline), `packages/core/src/layout/index.ts` (export surface), `packages/core/src/layout/types.ts` (add missing `ELEMENT_SIZES` entries only), `packages/core/src/bpmn/auto-layout.ts` (annotations + message flows), `packages/core/src/index.ts` (re-exports), `packages/core/tests/layout.test.ts` (migrate).

Delete (in Task 8, after the new engine is live): `block-builder.ts`, `block-layout.ts`, `layers.ts`, `crossing.ts`, `coordinates.ts`, `routing.ts` (label code moves out first), `astar.ts`, `subprocess.ts`, `graph.ts`.

Keep untouched: `overlap.ts`, `bench.ts`, `types.ts` (except additive), all consumers (`editor`, `ascii`, `apps/proxy`, `compact.ts`, `bpmn-builder.ts`).

Tests: `packages/core/tests/grid.test.ts` (new), `packages/core/tests/grid-layout.test.ts` (new), plus migrated `layout.test.ts` and untouched-but-must-pass `builder-layout-integration.test.ts`.

Run commands used throughout: `pnpm --filter @bpmnkit/core test -- run <file>` (vitest), `pnpm --filter @bpmnkit/core typecheck`, `pnpm biome check packages/core --write`.

---

## Part C — Tasks

### Task 1: Grid data structure

**Files:**
- Create: `packages/core/src/layout/grid/grid.ts`
- Test: `packages/core/tests/grid.test.ts`

**Interfaces:**
- Consumes: nothing (self-contained; generic over element type).
- Produces: `class Grid<T>` with methods `add(el: T, position?: [number, number]): void`, `createRow(afterIndex?: number): void`, `createCol(afterIndex: number, count: number): void`, `addAfter(el: T, newEl: T): void`, `addBelow(el: T, newEl: T): void`, `find(el: T): [number, number]`, `get(row: number, col: number): T | undefined`, `getElementsInRange(from: {row: number; col: number}, to: {row: number; col: number}): T[]`, `adjustGridPosition(el: T): void`, `adjustRowForMultipleIncoming(sources: T[], el: T): void`, `adjustColumnForMultipleIncoming(sources: T[], el: T): void`, `getAllElements(): T[]`, `getGridDimensions(): [number, number]`, `elementsByPosition(): Array<{element: T; row: number; col: number}>`, `getElementsTotal(): number`, `rowCount(): number`, `colCount(): number`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/tests/grid.test.ts
import { describe, expect, it } from "vitest"
import { Grid } from "../src/layout/grid/grid.js"

describe("Grid", () => {
	it("add without position starts a new row", () => {
		const g = new Grid<string>()
		g.add("a")
		g.add("b")
		expect(g.find("a")).toEqual([0, 0])
		expect(g.find("b")).toEqual([1, 0])
		expect(g.getGridDimensions()).toEqual([2, 1])
	})

	it("add at explicit position throws when occupied", () => {
		const g = new Grid<string>()
		g.add("a", [0, 0])
		expect(() => g.add("b", [0, 0])).toThrow()
		g.add("b", [2, 3])
		expect(g.find("b")).toEqual([2, 3])
	})

	it("addAfter inserts right and shifts the row", () => {
		const g = new Grid<string>()
		g.add("a")
		g.addAfter("a", "c")
		g.addAfter("a", "b") // squeezes between a and c
		expect(g.find("a")).toEqual([0, 0])
		expect(g.find("b")).toEqual([0, 1])
		expect(g.find("c")).toEqual([0, 2])
	})

	it("addBelow places in same column, splicing a row when occupied", () => {
		const g = new Grid<string>()
		g.add("a")
		g.add("x") // row 1 col 0
		g.addBelow("a", "b") // [1,0] occupied by x → new row spliced at 1
		expect(g.find("b")).toEqual([1, 0])
		expect(g.find("x")).toEqual([2, 0])
	})

	it("adjustGridPosition right-aligns an element to the grid's last column when free", () => {
		const g = new Grid<string>()
		g.add("a") // [0,0] — short row
		g.addAfter("a", "b") // [0,1]
		g.add("x") // row 1
		g.addAfter("x", "y")
		g.addAfter("y", "z") // grid max col = 2; [0,2] is free
		g.adjustGridPosition("a")
		expect(g.find("a")).toEqual([0, 2])
		expect(g.get(0, 0)).toBeUndefined()
		expect(g.find("b")).toEqual([0, 1])
	})

	it("adjustGridPosition never overwrites an occupied cell", () => {
		const g = new Grid<string>()
		g.add("a")
		g.addAfter("a", "b")
		g.addAfter("b", "c") // [0,2] occupied — a must stay put
		g.adjustGridPosition("a")
		expect(g.find("a")).toEqual([0, 0])
		expect(g.getElementsTotal()).toBe(3)
	})

	it("adjustRowForMultipleIncoming moves a join up to its topmost feeder", () => {
		const g = new Grid<string>()
		g.add("s1") // [0,0]
		g.add("s2") // [1,0]
		g.add("join", [1, 1])
		g.adjustRowForMultipleIncoming(["s1", "s2"], "join")
		expect(g.find("join")).toEqual([0, 1])
	})

	it("adjustColumnForMultipleIncoming pushes a join right of its furthest feeder", () => {
		const g = new Grid<string>()
		g.add("s1") // [0,0]
		g.addAfter("s1", "s2") // [0,1]
		g.add("join", [1, 0])
		g.adjustColumnForMultipleIncoming(["s1", "s2"], "join")
		expect(g.find("join")).toEqual([1, 2])
	})

	it("createCol inserts blank columns into every row", () => {
		const g = new Grid<string>()
		g.add("a")
		g.addAfter("a", "b")
		g.add("c") // row 1
		g.createCol(0, 2)
		expect(g.find("a")).toEqual([0, 0])
		expect(g.find("b")).toEqual([0, 3])
		expect(g.find("c")).toEqual([1, 0])
	})

	it("getElementsInRange collects non-empty cells in a rectangle (any corner order)", () => {
		const g = new Grid<string>()
		g.add("a", [0, 0])
		g.add("b", [0, 2])
		g.add("c", [1, 1])
		expect(g.getElementsInRange({ row: 0, col: 0 }, { row: 1, col: 2 }).sort()).toEqual([
			"a",
			"b",
			"c",
		])
		expect(g.getElementsInRange({ row: 1, col: 2 }, { row: 0, col: 0 }).sort()).toEqual([
			"a",
			"b",
			"c",
		])
	})

	it("elementsByPosition returns row-major order", () => {
		const g = new Grid<string>()
		g.add("a", [0, 1])
		g.add("b", [1, 0])
		expect(g.elementsByPosition()).toEqual([
			{ element: "a", row: 0, col: 1 },
			{ element: "b", row: 1, col: 0 },
		])
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bpmnkit/core test -- run tests/grid.test.ts`
Expected: FAIL — cannot resolve `../src/layout/grid/grid.js`.

- [ ] **Step 3: Implement Grid**

```ts
// packages/core/src/layout/grid/grid.ts
/**
 * Sparse row/column grid used by the grid layout engine.
 * Port of bpmn-io bpmn-auto-layout's Grid (lib/Grid.js) with two fixes:
 * an explicit optional position (upstream conflated [0,0] with "no
 * position") and a working row-splice guard.
 */
export class Grid<T> {
	private grid: Array<Array<T | undefined>> = []

	/** Without a position, start a new bottom row; with one, place exactly there. */
	add(element: T, position?: [number, number]): void {
		if (!position) {
			this.grid.push([element])
			return
		}
		const [row, col] = position
		while (this.grid.length <= row) this.grid.push([])
		const gridRow = this.grid[row] as Array<T | undefined>
		if (gridRow[col] !== undefined) {
			throw new Error(`Grid cell (${row},${col}) is already occupied`)
		}
		gridRow[col] = element
	}

	createRow(afterIndex?: number): void {
		if (afterIndex === undefined) {
			this.grid.push([])
			return
		}
		this.grid.splice(afterIndex + 1, 0, [])
	}

	createCol(afterIndex: number, count: number): void {
		for (const row of this.grid) {
			if (row.length > afterIndex) {
				row.splice(afterIndex + 1, 0, ...new Array<T | undefined>(count).fill(undefined))
			}
		}
	}

	addAfter(element: T, newElement: T): void {
		const [row, col] = this.find(element)
		if (row < 0) {
			this.add(newElement)
			return
		}
		this.grid[row]?.splice(col + 1, 0, newElement)
	}

	addBelow(element: T, newElement: T): void {
		const [row, col] = this.find(element)
		if (row < 0) {
			this.add(newElement)
			return
		}
		while (this.grid.length <= row + 1) this.grid.push([])
		const below = this.grid[row + 1] as Array<T | undefined>
		if (below[col] !== undefined) {
			this.grid.splice(row + 1, 0, [])
		}
		this.add(newElement, [row + 1, col])
	}

	find(element: T): [number, number] {
		for (let r = 0; r < this.grid.length; r++) {
			const row = this.grid[r]
			if (!row) continue
			for (let c = 0; c < row.length; c++) {
				if (row[c] === element) return [r, c]
			}
		}
		return [-1, -1]
	}

	get(row: number, col: number): T | undefined {
		return this.grid[row]?.[col]
	}

	getElementsInRange(
		from: { row: number; col: number },
		to: { row: number; col: number },
	): T[] {
		const r1 = Math.min(from.row, to.row)
		const r2 = Math.max(from.row, to.row)
		const c1 = Math.min(from.col, to.col)
		const c2 = Math.max(from.col, to.col)
		const out: T[] = []
		for (let r = r1; r <= r2; r++) {
			for (let c = c1; c <= c2; c++) {
				const el = this.get(r, c)
				if (el !== undefined) out.push(el)
			}
		}
		return out
	}

	/**
	 * Move an element to the current last column of the grid (right-align
	 * before a fan-out). No-op when that cell is occupied — upstream would
	 * overwrite; we keep the no-overwrite invariant.
	 */
	adjustGridPosition(element: T): void {
		const [row, col] = this.find(element)
		if (row < 0) return
		const maxCol = this.colCount() - 1
		if (col < maxCol - 1 && this.get(row, maxCol) === undefined) {
			const gridRow = this.grid[row] as Array<T | undefined>
			gridRow[col] = undefined
			while (gridRow.length <= maxCol) gridRow.push(undefined)
			gridRow[maxCol] = element
		}
	}

	adjustRowForMultipleIncoming(sources: T[], element: T): void {
		const [row, col] = this.find(element)
		if (row < 0) return
		const rows = sources.map((s) => this.find(s)[0]).filter((r) => r >= 0)
		if (rows.length === 0) return
		const lowestRow = Math.min(...rows)
		if (lowestRow < row && this.get(lowestRow, col) === undefined) {
			const gridRow = this.grid[row] as Array<T | undefined>
			gridRow[col] = undefined
			this.add(element, [lowestRow, col])
		}
	}

	adjustColumnForMultipleIncoming(sources: T[], element: T): void {
		const [row, col] = this.find(element)
		if (row < 0) return
		const cols = sources.map((s) => this.find(s)[1]).filter((c) => c >= 0)
		if (cols.length === 0) return
		const maxCol = Math.max(...cols)
		if (maxCol + 1 > col) {
			const gridRow = this.grid[row] as Array<T | undefined>
			gridRow[col] = undefined
			// splice-free targeted set; grow the row as needed
			while (gridRow.length <= maxCol + 1) gridRow.push(undefined)
			if (gridRow[maxCol + 1] === undefined) {
				gridRow[maxCol + 1] = element
			} else {
				this.addBelow(gridRow[maxCol + 1] as T, element)
			}
		}
	}

	getAllElements(): T[] {
		return this.elementsByPosition().map((e) => e.element)
	}

	getGridDimensions(): [number, number] {
		return [this.rowCount(), this.colCount()]
	}

	elementsByPosition(): Array<{ element: T; row: number; col: number }> {
		const out: Array<{ element: T; row: number; col: number }> = []
		for (let r = 0; r < this.grid.length; r++) {
			const row = this.grid[r]
			if (!row) continue
			for (let c = 0; c < row.length; c++) {
				const el = row[c]
				if (el !== undefined) out.push({ element: el, row: r, col: c })
			}
		}
		return out
	}

	getElementsTotal(): number {
		return new Set(this.getAllElements()).size
	}

	rowCount(): number {
		return this.grid.length
	}

	colCount(): number {
		return this.grid.reduce((max, row) => Math.max(max, row.length), 0)
	}
}
```

Note the one intentional divergence inside `adjustColumnForMultipleIncoming`: upstream unconditionally writes `grid[row][maxCol+1] = element`, silently overwriting any occupant; we fall back to `addBelow` to keep the no-overwrite invariant. Add a test for that case if you touch this later.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bpmnkit/core test -- run tests/grid.test.ts`
Expected: PASS (all Grid tests).

- [ ] **Step 5: Lint, typecheck, commit**

```bash
pnpm biome check packages/core --write && pnpm --filter @bpmnkit/core typecheck
git add packages/core/src/layout/grid/grid.ts packages/core/tests/grid.test.ts
git commit -m "feat(core): add Grid data structure for grid layout engine"
```

---

### Task 2: FlowGraph — adjacency, attachers, start/loop detection

**Files:**
- Create: `packages/core/src/layout/grid/flow-graph.ts`
- Test: `packages/core/tests/grid-layout.test.ts` (new file; grows over Tasks 2–3)

**Interfaces:**
- Consumes: `BpmnFlowElement`, `BpmnBoundaryEvent`, `BpmnSequenceFlow` from `../../bpmn/bpmn-model.js`.
- Produces:
  ```ts
  export interface FlowGraph {
  	elements: BpmnFlowElement[] // grid-placeable (boundary events excluded)
  	byId: Map<string, BpmnFlowElement>
  	outgoing: Map<string, BpmnSequenceFlow[]>
  	incoming: Map<string, BpmnSequenceFlow[]>
  	attachers: Map<string, BpmnBoundaryEvent[]>
  }
  export function buildFlowGraph(flowNodes: BpmnFlowElement[], sequenceFlows: BpmnSequenceFlow[]): FlowGraph
  export function hasOtherIncoming(el: BpmnFlowElement, graph: FlowGraph): boolean
  export function isFutureIncoming(el: BpmnFlowElement, visited: Set<string>, graph: FlowGraph): boolean
  export function formsLoop(el: BpmnFlowElement, visited: Set<string>, graph: FlowGraph): boolean
  export function isTaskLike(type: string): boolean
  ```

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/tests/grid-layout.test.ts
import { describe, expect, it } from "vitest"
import type {
	BpmnElementType,
	BpmnFlowElement,
	BpmnSequenceFlow,
} from "../src/bpmn/bpmn-model.js"
import {
	buildFlowGraph,
	formsLoop,
	hasOtherIncoming,
	isFutureIncoming,
} from "../src/layout/grid/flow-graph.js"

export function node(
	id: string,
	type: BpmnElementType,
	extra: Record<string, unknown> = {},
): BpmnFlowElement {
	return {
		id,
		type,
		incoming: [],
		outgoing: [],
		extensionElements: [],
		unknownAttributes: {},
		eventDefinitions: [],
		...extra,
	} as unknown as BpmnFlowElement
}

export function flow(id: string, sourceRef: string, targetRef: string): BpmnSequenceFlow {
	return { id, sourceRef, targetRef, extensionElements: [], unknownAttributes: {} }
}

describe("FlowGraph", () => {
	it("excludes boundary events from placeable elements and binds attachers", () => {
		const host = node("host", "userTask")
		const be = node("be", "boundaryEvent", { attachedToRef: "host" })
		const g = buildFlowGraph([host, be], [])
		expect(g.elements.map((e) => e.id)).toEqual(["host"])
		expect(g.attachers.get("host")?.map((e) => e.id)).toEqual(["be"])
	})

	it("hasOtherIncoming: boundary-event feeds count unless the event is attached to the element itself", () => {
		const host = node("host", "userTask")
		const be = node("be", "boundaryEvent", { attachedToRef: "host" })
		const rec = node("rec", "userTask")
		// rec is fed by host's boundary event → real incoming (placed by the
		// attacher step, NOT as a traversal start)
		const g = buildFlowGraph([host, be, rec], [flow("f1", "be", "rec")])
		expect(hasOtherIncoming(rec, g)).toBe(true)
		// host fed only by its OWN boundary event → no real incoming → start
		const g2 = buildFlowGraph([host, be], [flow("f2", "be", "host")])
		expect(hasOtherIncoming(host, g2)).toBe(false)
	})

	it("hasOtherIncoming is true for a normally-fed element and false for self-loops", () => {
		const a = node("a", "userTask")
		const b = node("b", "userTask")
		const g = buildFlowGraph([a, b], [flow("f1", "a", "b"), flow("f2", "b", "b")])
		expect(hasOtherIncoming(a, g)).toBe(false)
		expect(hasOtherIncoming(b, g)).toBe(true)
		const g2 = buildFlowGraph([b], [flow("f2", "b", "b")])
		expect(hasOtherIncoming(b, g2)).toBe(false)
	})

	it("isFutureIncoming: join with an unvisited feeder", () => {
		const a = node("a", "userTask")
		const b = node("b", "userTask")
		const j = node("j", "exclusiveGateway")
		const g = buildFlowGraph([a, b, j], [flow("f1", "a", "j"), flow("f2", "b", "j")])
		expect(isFutureIncoming(j, new Set(["a"]), g)).toBe(true)
		expect(isFutureIncoming(j, new Set(["a", "b"]), g)).toBe(false)
	})

	it("formsLoop: unvisited feeder reachable downstream means a cycle", () => {
		const gw = node("gw", "exclusiveGateway")
		const t = node("t", "userTask")
		// gw → t → gw  (t is gw's unvisited feeder AND downstream of gw)
		const g = buildFlowGraph([gw, t], [flow("f1", "gw", "t"), flow("f2", "t", "gw")])
		expect(formsLoop(gw, new Set(), g)).toBe(true)
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bpmnkit/core test -- run tests/grid-layout.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement flow-graph.ts**

```ts
// packages/core/src/layout/grid/flow-graph.ts
import type {
	BpmnBoundaryEvent,
	BpmnFlowElement,
	BpmnSequenceFlow,
} from "../../bpmn/bpmn-model.js"

/** Resolved adjacency for one nesting level of a process. */
export interface FlowGraph {
	/** Grid-placeable elements — boundary events are excluded (they ride on their host). */
	elements: BpmnFlowElement[]
	byId: Map<string, BpmnFlowElement>
	outgoing: Map<string, BpmnSequenceFlow[]>
	incoming: Map<string, BpmnSequenceFlow[]>
	/** hostId → boundary events attached to it, in document order. */
	attachers: Map<string, BpmnBoundaryEvent[]>
}

const TASK_TYPES = new Set([
	"task",
	"userTask",
	"serviceTask",
	"scriptTask",
	"sendTask",
	"receiveTask",
	"businessRuleTask",
	"manualTask",
])

/** bpmn:Task subtypes — used for the "right-align before a task-only fan-out" rule. */
export function isTaskLike(type: string): boolean {
	return TASK_TYPES.has(type)
}

export function buildFlowGraph(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): FlowGraph {
	const byId = new Map<string, BpmnFlowElement>()
	for (const n of flowNodes) byId.set(n.id, n)

	const outgoing = new Map<string, BpmnSequenceFlow[]>()
	const incoming = new Map<string, BpmnSequenceFlow[]>()
	for (const f of sequenceFlows) {
		if (!outgoing.has(f.sourceRef)) outgoing.set(f.sourceRef, [])
		outgoing.get(f.sourceRef)?.push(f)
		if (!incoming.has(f.targetRef)) incoming.set(f.targetRef, [])
		incoming.get(f.targetRef)?.push(f)
	}

	const attachers = new Map<string, BpmnBoundaryEvent[]>()
	const elements: BpmnFlowElement[] = []
	for (const n of flowNodes) {
		if (n.type === "boundaryEvent") {
			const be = n as BpmnBoundaryEvent
			if (!attachers.has(be.attachedToRef)) attachers.set(be.attachedToRef, [])
			attachers.get(be.attachedToRef)?.push(be)
		} else {
			elements.push(n)
		}
	}

	return { elements, byId, outgoing, incoming, attachers }
}

function isBoundaryAttachedTo(source: BpmnFlowElement | undefined, elId: string): boolean {
	return source?.type === "boundaryEvent" && (source as BpmnBoundaryEvent).attachedToRef === elId
}

/**
 * True iff the element has a "real" predecessor — an incoming flow that is
 * neither a self-loop nor sourced from a boundary event / its own attacher.
 * Elements without one become traversal starting points.
 */
export function hasOtherIncoming(el: BpmnFlowElement, graph: FlowGraph): boolean {
	const flows = graph.incoming.get(el.id) ?? []
	for (const f of flows) {
		if (f.sourceRef === el.id) continue
		const source = graph.byId.get(f.sourceRef)
		if (source?.type !== "boundaryEvent") return true
		if (!isBoundaryAttachedTo(source, el.id)) return true
	}
	return false
}

/** True iff el is a join (>1 incoming) with at least one not-yet-visited feeder. */
export function isFutureIncoming(
	el: BpmnFlowElement,
	visited: Set<string>,
	graph: FlowGraph,
): boolean {
	const flows = graph.incoming.get(el.id) ?? []
	if (flows.length <= 1) return false
	return flows.some((f) => !visited.has(f.sourceRef))
}

/** True iff some unvisited feeder of el is reachable downstream FROM el (a cycle). */
export function formsLoop(
	el: BpmnFlowElement,
	visited: Set<string>,
	graph: FlowGraph,
): boolean {
	const unvisitedFeeders = (graph.incoming.get(el.id) ?? [])
		.map((f) => f.sourceRef)
		.filter((id) => !visited.has(id))
	for (const feeder of unvisitedFeeders) {
		if (isReachable(el.id, feeder, graph)) return true
	}
	return false
}

function isReachable(fromId: string, targetId: string, graph: FlowGraph): boolean {
	const seen = new Set<string>()
	const stack = [fromId]
	while (stack.length > 0) {
		const id = stack.pop()
		if (id === undefined || seen.has(id)) continue
		seen.add(id)
		for (const f of graph.outgoing.get(id) ?? []) {
			if (f.targetRef === targetId) return true
			stack.push(f.targetRef)
		}
	}
	return false
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bpmnkit/core test -- run tests/grid-layout.test.ts` — Expected: PASS.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
pnpm biome check packages/core --write && pnpm --filter @bpmnkit/core typecheck
git add packages/core/src/layout/grid/flow-graph.ts packages/core/tests/grid-layout.test.ts
git commit -m "feat(core): add FlowGraph adjacency for grid layout engine"
```

---

### Task 3: Placement walker

**Files:**
- Create: `packages/core/src/layout/grid/walker.ts`
- Test: append to `packages/core/tests/grid-layout.test.ts`

**Interfaces:**
- Consumes: `Grid` (Task 1), `FlowGraph` + helpers (Task 2).
- Produces: `createGridLayout(graph: FlowGraph, opts?: { compact?: boolean }): Grid<BpmnFlowElement>` — places every element of `graph.elements`; with `compact: true` (used for flow-less adHocSubProcess content) it skips the DFS and packs elements row-major with max 4 columns.

- [ ] **Step 1: Write the failing tests** (append to `grid-layout.test.ts`; reuse the `node`/`flow` helpers)

```ts
import { createGridLayout } from "../src/layout/grid/walker.js"

describe("Grid placement walker", () => {
	function positions(g: ReturnType<typeof createGridLayout>) {
		return Object.fromEntries(g.elementsByPosition().map((e) => [e.element.id, [e.row, e.col]]))
	}

	it("linear flow: one row, consecutive columns", () => {
		const els = [node("s", "startEvent"), node("a", "userTask"), node("b", "serviceTask"), node("e", "endEvent")]
		const flows = [flow("f1", "s", "a"), flow("f2", "a", "b"), flow("f3", "b", "e")]
		const p = positions(createGridLayout(buildFlowGraph(els, flows)))
		expect(p).toEqual({ s: [0, 0], a: [0, 1], b: [0, 2], e: [0, 3] })
	})

	it("split/join: first branch straight, second below, join realigned to top row after furthest feeder", () => {
		const els = [
			node("s", "startEvent"),
			node("gw", "exclusiveGateway"),
			node("a", "userTask"),
			node("b", "userTask"),
			node("j", "exclusiveGateway"),
			node("e", "endEvent"),
		]
		const flows = [
			flow("f1", "s", "gw"),
			flow("f2", "gw", "a"),
			flow("f3", "gw", "b"),
			flow("f4", "a", "j"),
			flow("f5", "b", "j"),
			flow("f6", "j", "e"),
		]
		const p = positions(createGridLayout(buildFlowGraph(els, flows)))
		expect(p.gw).toEqual([0, 1])
		expect(p.a).toEqual([0, 2])
		expect(p.b).toEqual([1, 2])
		expect(p.j).toEqual([0, 3])
		expect(p.e).toEqual([0, 4])
	})

	it("boundary event successor goes down-right of the host", () => {
		const els = [
			node("s", "startEvent"),
			node("host", "userTask"),
			node("be", "boundaryEvent", { attachedToRef: "host" }),
			node("rec", "userTask"),
			node("e", "endEvent"),
		]
		const flows = [flow("f1", "s", "host"), flow("f2", "host", "e"), flow("f3", "be", "rec")]
		const p = positions(createGridLayout(buildFlowGraph(els, flows)))
		expect(p.host).toEqual([0, 1])
		expect(p.rec).toEqual([1, 2])
		expect(p.be).toBeUndefined() // boundary events are not grid cells
	})

	it("loop: closing edge target keeps its earlier column, all elements placed", () => {
		const els = [
			node("s", "startEvent"),
			node("t", "userTask"),
			node("gw", "exclusiveGateway"),
			node("e", "endEvent"),
		]
		const flows = [
			flow("f1", "s", "t"),
			flow("f2", "t", "gw"),
			flow("f3", "gw", "e"),
			flow("f4", "gw", "t"), // back to t
		]
		const g = createGridLayout(buildFlowGraph(els, flows))
		expect(g.getElementsTotal()).toBe(4)
		const p = positions(g)
		expect(p.t?.[1]).toBeLessThan(p.gw?.[1] ?? 0)
	})

	it("disconnected fragments each start a new row; nothing is lost", () => {
		const els = [node("a", "userTask"), node("b", "userTask"), node("c", "userTask")]
		const flows = [flow("f1", "a", "b")]
		const g = createGridLayout(buildFlowGraph(els, flows))
		expect(g.getElementsTotal()).toBe(3)
	})

	it("compact mode packs row-major with max 4 columns", () => {
		const els = Array.from({ length: 6 }, (_, i) => node(`t${i}`, "userTask"))
		const g = createGridLayout(buildFlowGraph(els, []), { compact: true })
		const p = positions(g)
		expect(p.t0).toEqual([0, 0])
		expect(p.t3).toEqual([0, 3])
		expect(p.t4).toEqual([1, 0])
		expect(p.t5).toEqual([1, 1])
	})
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter @bpmnkit/core test -- run tests/grid-layout.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement walker.ts**

```ts
// packages/core/src/layout/grid/walker.ts
import type { BpmnFlowElement } from "../../bpmn/bpmn-model.js"
import type { FlowGraph } from "./flow-graph.js"
import { formsLoop, hasOtherIncoming, isFutureIncoming, isTaskLike } from "./flow-graph.js"
import { Grid } from "./grid.js"

const COMPACT_MAX_COLS = 4

/**
 * Place every element of the graph into a Grid via the bpmn-io DFS walk.
 * `compact` bypasses the walk and packs row-major (adHoc tool palettes).
 */
export function createGridLayout(
	graph: FlowGraph,
	opts: { compact?: boolean } = {},
): Grid<BpmnFlowElement> {
	const grid = new Grid<BpmnFlowElement>()

	if (opts.compact) {
		for (let i = 0; i < graph.elements.length; i++) {
			const el = graph.elements[i]
			if (el) grid.add(el, [Math.floor(i / COMPACT_MAX_COLS), i % COMPACT_MAX_COLS])
		}
		return grid
	}

	const visited = new Set<string>()

	while (visited.size < graph.elements.length) {
		let starts = graph.elements.filter((el) => !visited.has(el.id) && !hasOtherIncoming(el, graph))
		if (starts.length === 0) {
			// pure cycles or unreachable joins — force-start with the first leftover
			const leftover = graph.elements.find((el) => !visited.has(el.id))
			starts = leftover ? [leftover] : []
		}
		if (starts.length === 0) break
		const stack: BpmnFlowElement[] = []
		for (const s of starts) {
			grid.add(s)
			visited.add(s.id)
			stack.push(s)
		}
		walk(grid, graph, visited, stack)
	}

	return grid
}

function walk(
	grid: Grid<BpmnFlowElement>,
	graph: FlowGraph,
	visited: Set<string>,
	stack: BpmnFlowElement[],
): void {
	while (stack.length > 0) {
		const current = stack.pop()
		if (!current) break
		incomingStep(current, grid, graph)
		const next = [
			...outgoingStep(current, grid, graph, visited, stack),
			...attacherStep(current, grid, graph, visited),
		]
		for (const el of next) stack.push(el)
	}
}

/** Realign a join with its feeders before its successors are placed. */
function incomingStep(el: BpmnFlowElement, grid: Grid<BpmnFlowElement>, graph: FlowGraph): void {
	const sources = (graph.incoming.get(el.id) ?? [])
		.map((f) => graph.byId.get(f.sourceRef))
		.filter((s): s is BpmnFlowElement => s !== undefined)
	if (sources.length > 1) {
		grid.adjustColumnForMultipleIncoming(sources, el)
		grid.adjustRowForMultipleIncoming(sources, el)
	}
}

/** Place successors: first one to the right (happy path), the rest stacked below. */
function outgoingStep(
	el: BpmnFlowElement,
	grid: Grid<BpmnFlowElement>,
	graph: FlowGraph,
	visited: Set<string>,
	stack: BpmnFlowElement[],
): BpmnFlowElement[] {
	const targets = (graph.outgoing.get(el.id) ?? [])
		.map((f) => graph.byId.get(f.targetRef))
		.filter((t): t is BpmnFlowElement => t !== undefined)

	if (targets.length > 1 && targets.every((t) => isTaskLike(t.type))) {
		grid.adjustGridPosition(el)
	}

	let previous: BpmnFlowElement | null = null
	const placed: BpmnFlowElement[] = []

	for (let i = 0; i < targets.length; i++) {
		const target = targets[i]
		if (!target || visited.has(target.id)) continue

		if (
			(previous !== null || stack.length > 0) &&
			isFutureIncoming(target, visited, graph) &&
			!formsLoop(target, visited, graph)
		) {
			continue // defer join until its last feeder is processed
		}

		if (previous === null) {
			grid.addAfter(el, target)
		} else if (el.type === "exclusiveGateway" && target.type === "exclusiveGateway") {
			grid.addAfter(previous, target)
		} else {
			const anchor = targets[i - 1]
			grid.addBelow(anchor && grid.find(anchor)[0] >= 0 ? anchor : previous, target)
		}

		if (target.id !== el.id) previous = target
		placed.unshift(target)
		visited.add(target.id)
	}

	// exclusive gateways first → popped from the LIFO stack last
	return [
		...placed.filter((t) => t.type === "exclusiveGateway"),
		...placed.filter((t) => t.type !== "exclusiveGateway"),
	]
}

/** Place the successors of this host's boundary events one row down, one col right. */
function attacherStep(
	host: BpmnFlowElement,
	grid: Grid<BpmnFlowElement>,
	graph: FlowGraph,
	visited: Set<string>,
): BpmnFlowElement[] {
	const out: BpmnFlowElement[] = []
	for (const be of graph.attachers.get(host.id) ?? []) {
		const targets = (graph.outgoing.get(be.id) ?? [])
			.map((f) => graph.byId.get(f.targetRef))
			.filter((t): t is BpmnFlowElement => t !== undefined)
			.reverse()
		for (const target of targets) {
			if (visited.has(target.id)) continue
			const [r, c] = grid.find(host)
			if (r < 0) continue
			if (grid.get(r + 1, c) !== undefined || grid.get(r + 1, c + 1) !== undefined) {
				grid.createRow(r)
			}
			grid.add(target, [r + 1, c + 1])
			visited.add(target.id)
			out.push(target)
		}
	}
	return out
}
```

- [ ] **Step 4: Run to verify pass** — `pnpm --filter @bpmnkit/core test -- run tests/grid-layout.test.ts` → PASS. If the split/join expectation fails on exact cells, debug the walk against §A.2.2 by printing `grid.elementsByPosition()` — the spec positions are the contract; fix the code, not the test.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
pnpm biome check packages/core --write && pnpm --filter @bpmnkit/core typecheck
git add -A packages/core && git commit -m "feat(core): add grid placement walker"
```

---

### Task 4: Manhattan router

**Files:**
- Create: `packages/core/src/layout/grid/grid-router.ts`
- Test: append to `packages/core/tests/grid-layout.test.ts`

**Interfaces:**
- Consumes: `Grid` (for blocked-corridor checks), `Bounds`/`Waypoint` from `../types.js`.
- Produces:
  ```ts
  export interface RoutableNode {
  	id: string
  	bounds: Bounds
  	row: number
  	col: number
  	/** Child grid dims when this node is an expanded subprocess. */
  	childGrid?: { rows: number; cols: number }
  	/** For boundary events: the host's childGrid (if the host is expanded). */
  	hostChildGrid?: { rows: number; cols: number }
  }
  export function connectElements(
  	source: RoutableNode,
  	target: RoutableNode,
  	grid: Grid<{ id: string }>, // any grid whose elements expose id — used for range checks
  	shift: { x: number; y: number },
  	expandedRowsByRow: Map<number, number>, // row → max childGrid.rows among expanded elements in that row
  ): Waypoint[]
  export function ensureExitBottom(be: Bounds, waypoints: Waypoint[]): Waypoint[]
  export function collapseCollinear(waypoints: Waypoint[]): Waypoint[]
  ```
  Implementation note: `connectElements` needs "elements between source and target" — pass the *element* grid (`Grid<BpmnFlowElement>`); type the parameter as `Grid<unknown>` internally if variance fights you, it only calls `getElementsInRange(...).length`.

- [ ] **Step 1: Write the failing tests** (append; build `RoutableNode`s by hand)

```ts
import { collapseCollinear, connectElements, ensureExitBottom } from "../src/layout/grid/grid-router.js"
import type { RoutableNode } from "../src/layout/grid/grid-router.js"
import { Grid } from "../src/layout/grid/grid.js"

const SHIFT = { x: 0, y: 0 }
const NO_EXPANDED = new Map<number, number>()

function routable(id: string, row: number, col: number, w = 100, h = 80): RoutableNode {
	return {
		id,
		row,
		col,
		bounds: { x: col * 150 + (150 - w) / 2, y: row * 140 + (140 - h) / 2, width: w, height: h },
	}
}

function assertOrthogonal(wps: Array<{ x: number; y: number }>) {
	for (let i = 1; i < wps.length; i++) {
		const a = wps[i - 1]
		const b = wps[i]
		if (!a || !b) continue
		expect(a.x === b.x || a.y === b.y).toBe(true)
	}
}

describe("Grid Manhattan router", () => {
	it("same-row forward: straight 2-point line at centre height", () => {
		const g = new Grid<{ id: string }>()
		const a = routable("a", 0, 0)
		const b = routable("b", 0, 1)
		const wps = connectElements(a, b, g, SHIFT, NO_EXPANDED)
		expect(wps).toEqual([
			{ x: a.bounds.x + a.bounds.width, y: 70 },
			{ x: b.bounds.x, y: 70 },
		])
	})

	it("diagonal down-right with a free corridor: 3 points, out the bottom, into the left", () => {
		const g = new Grid<{ id: string }>()
		const a = routable("a", 0, 0, 50, 50) // gateway
		const b = routable("b", 1, 1)
		const wps = connectElements(a, b, g, SHIFT, NO_EXPANDED)
		expect(wps).toHaveLength(3)
		expect(wps[0]).toEqual({ x: 75, y: a.bounds.y + a.bounds.height }) // bottom of gateway
		expect(wps[2]).toEqual({ x: b.bounds.x, y: 210 }) // left of task, centre of row 1
		assertOrthogonal(wps)
	})

	it("back-edge (target left of source) routes below both with 4 points", () => {
		const g = new Grid<{ id: string }>()
		const src = routable("gw", 0, 2, 50, 50)
		const tgt = routable("t", 0, 1)
		const wps = connectElements(src, tgt, g, SHIFT, NO_EXPANDED)
		expect(wps).toHaveLength(4)
		expect(wps[0]?.y).toBe(src.bounds.y + src.bounds.height) // exits bottom
		expect(wps[1]?.y).toBe(140) // one cell height below row-0 top
		expect(wps[3]?.y).toBe(tgt.bounds.y + tgt.bounds.height) // enters bottom
		assertOrthogonal(wps)
	})

	it("self-loop routes out right and back in the top with 5 points", () => {
		const g = new Grid<{ id: string }>()
		const a = routable("a", 0, 0)
		const wps = connectElements(a, a, g, SHIFT, NO_EXPANDED)
		expect(wps).toHaveLength(5)
		assertOrthogonal(wps)
	})

	it("blocked same-row corridor routes underneath", () => {
		const g = new Grid<{ id: string }>()
		g.add({ id: "a" }, [0, 0])
		g.add({ id: "x" }, [0, 1]) // blocker
		g.add({ id: "b" }, [0, 2])
		const wps = connectElements(routable("a", 0, 0), routable("b", 0, 2), g, SHIFT, NO_EXPANDED)
		expect(wps).toHaveLength(4)
		expect(wps[1]?.y).toBe(140)
		assertOrthogonal(wps)
	})

	it("ensureExitBottom rewrites an edge to leave through the boundary event's bottom", () => {
		const be = { x: 132, y: 122, width: 36, height: 36 }
		const wps = ensureExitBottom(be, [
			{ x: 168, y: 140 },
			{ x: 300, y: 140 },
		])
		expect(wps[0]).toEqual({ x: 150, y: 158 })
		assertOrthogonal(wps)
	})

	it("collapseCollinear removes redundant midpoints", () => {
		expect(
			collapseCollinear([
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 100, y: 0 },
				{ x: 100, y: 80 },
			]),
		).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 80 },
		])
	})
})
```

- [ ] **Step 2: Run to verify failure** — module not found.

- [ ] **Step 3: Implement grid-router.ts**

```ts
// packages/core/src/layout/grid/grid-router.ts
import type { Bounds, Waypoint } from "../types.js"
import { GRID_CELL_HEIGHT, GRID_CELL_WIDTH } from "../types.js"
import type { Grid } from "./grid.js"

/** Routing endpoint: absolute bounds plus grid position. */
export interface RoutableNode {
	id: string
	bounds: Bounds
	row: number
	col: number
	childGrid?: { rows: number; cols: number }
	hostChildGrid?: { rows: number; cols: number }
}

const H = GRID_CELL_HEIGHT // 140
const W = GRID_CELL_WIDTH // 150
const HALF_H = H / 2 // 70
const HALF_W = W / 2 // 75
const TASK_HALF_HEIGHT = 40
const BOUNDARY_STEM = 20

type Dir = "t" | "r" | "b" | "l"

function mid(b: Bounds): Waypoint {
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

function dock(point: Waypoint, rect: Bounds, dir: Dir): Waypoint {
	switch (dir) {
		case "t":
			return { x: point.x, y: rect.y }
		case "b":
			return { x: point.x, y: rect.y + rect.height }
		case "l":
			return { x: rect.x, y: point.y }
		case "r":
			return { x: rect.x + rect.width, y: point.y }
	}
}

function sourceGridOf(node: RoutableNode): { rows: number; cols: number } | undefined {
	return node.childGrid ?? node.hostChildGrid
}

/**
 * Compute orthogonal waypoints between two grid-placed nodes.
 * Port of bpmn-auto-layout's connectElements (lib/utils/layoutUtil.js:52),
 * with the level shift applied consistently (upstream drops it for
 * subprocess children).
 */
export function connectElements(
	source: RoutableNode,
	target: RoutableNode,
	grid: Grid<{ id: string }>,
	shift: { x: number; y: number },
	expandedRowsByRow: Map<number, number>,
): Waypoint[] {
	const sMid = mid(source.bounds)
	const tMid = mid(target.bounds)
	const dX = target.col - source.col
	const dY = target.row - source.row
	const cellTop = (row: number): number => row * H + shift.y
	const cellLeft = (col: number): number => col * W + shift.x
	const srcGrid = sourceGridOf(source)

	// Self-loop
	if (dX === 0 && dY === 0 && source.id === target.id) {
		const loopX = cellLeft(source.col) + (srcGrid ? (srcGrid.cols + 1) * W : W)
		const topY = cellTop(source.row)
		return [
			dock(sMid, source.bounds, "r"),
			{ x: loopX, y: sMid.y },
			{ x: loopX, y: topY },
			{ x: tMid.x, y: topY },
			dock(tMid, target.bounds, "t"),
		]
	}

	// Back-edge (loop closing leftwards)
	if (dX < 0) {
		if (sMid.y >= tMid.y) {
			const extraRows = srcGrid ? srcGrid.rows + 1 : 1 + (expandedRowsByRow.get(source.row) ?? 0)
			const downY = cellTop(source.row) + extraRows * H
			return [
				dock(sMid, source.bounds, "b"),
				{ x: sMid.x, y: downY },
				{ x: tMid.x, y: downY },
				dock(tMid, target.bounds, "b"),
			]
		}
		const upY = sMid.y - HALF_H
		return [
			dock(sMid, source.bounds, "t"),
			{ x: sMid.x, y: upY },
			{ x: tMid.x, y: upY },
			dock(tMid, target.bounds, "t"),
		]
	}

	// Same row, forward
	if (dY === 0) {
		if (isDirectPathBlocked(source, target, grid)) {
			const extraRows = srcGrid ? srcGrid.rows + 1 : 1
			const underY = cellTop(source.row) + extraRows * H
			return [
				dock(sMid, source.bounds, "b"),
				{ x: sMid.x, y: underY },
				{ x: tMid.x, y: underY },
				dock(tMid, target.bounds, "b"),
			]
		}
		const first = dock(sMid, source.bounds, "r")
		const last = dock(tMid, target.bounds, "l")
		// Expanded boxes dock at header height, not box middle
		if (source.childGrid) first.y = source.bounds.y + TASK_HALF_HEIGHT
		if (target.childGrid) last.y = target.bounds.y + TASK_HALF_HEIGHT
		if (first.y !== last.y) {
			// header-height correction created a step — resolve with an L
			return collapseCollinear([first, { x: last.x, y: first.y }, last])
		}
		return [first, last]
	}

	// Same column, vertical
	if (dX === 0) {
		if (isDirectPathBlocked(source, target, grid)) {
			const yOff = -Math.sign(dY) * HALF_H
			return [
				dock(sMid, source.bounds, "r"),
				{ x: sMid.x + HALF_W, y: sMid.y },
				{ x: sMid.x + HALF_W, y: tMid.y + yOff },
				{ x: tMid.x, y: tMid.y + yOff },
				dock(tMid, target.bounds, yOff > 0 ? "b" : "t"),
			]
		}
		return [
			dock(sMid, source.bounds, dY > 0 ? "b" : "t"),
			dock(tMid, target.bounds, dY > 0 ? "t" : "b"),
		]
	}

	// Diagonal forward: try the single-bend route
	const direct = directManhattan(source, target, grid, dY)
	if (direct) return direct

	// Fallback: 6-point S-route
	const yOff = -Math.sign(dY) * HALF_H
	return [
		dock(sMid, source.bounds, "r"),
		{ x: sMid.x + HALF_W, y: sMid.y },
		{ x: sMid.x + HALF_W, y: tMid.y + yOff },
		{ x: tMid.x - HALF_W, y: tMid.y + yOff },
		{ x: tMid.x - HALF_W, y: tMid.y },
		dock(tMid, target.bounds, "l"),
	]
}

function directManhattan(
	source: RoutableNode,
	target: RoutableNode,
	grid: Grid<{ id: string }>,
	dY: number,
): Waypoint[] | undefined {
	const sMid = mid(source.bounds)
	const tMid = mid(target.bounds)
	if (dY > 0) {
		// bend at (targetRow, sourceCol): down, then right
		const count =
			grid.getElementsInRange(
				{ row: source.row, col: source.col },
				{ row: target.row, col: source.col },
			).length +
			grid.getElementsInRange(
				{ row: target.row, col: source.col },
				{ row: target.row, col: target.col },
			).length
		if (count > 2) return undefined
		return [dock(sMid, source.bounds, "b"), { x: sMid.x, y: tMid.y }, dock(tMid, target.bounds, "l")]
	}
	// bend at (sourceRow, targetCol): right, then up
	const count =
		grid.getElementsInRange(
			{ row: source.row, col: source.col },
			{ row: source.row, col: target.col },
		).length +
		grid.getElementsInRange(
			{ row: source.row, col: target.col },
			{ row: target.row, col: target.col },
		).length
	if (count > 2) return undefined
	return [dock(sMid, source.bounds, "r"), { x: tMid.x, y: sMid.y }, dock(tMid, target.bounds, "b")]
}

function isDirectPathBlocked(
	source: RoutableNode,
	target: RoutableNode,
	grid: Grid<{ id: string }>,
): boolean {
	// Each range is counted only when there is movement along that axis —
	// otherwise a same-row edge would double-count its target and always block.
	let total = 0
	if (target.col !== source.col) {
		total += grid.getElementsInRange(
			{ row: source.row, col: source.col },
			{ row: source.row, col: target.col },
		).length
	}
	if (target.row !== source.row) {
		total += grid.getElementsInRange(
			{ row: source.row, col: target.col },
			{ row: target.row, col: target.col },
		).length
	}
	return total > 2
}

/** Force an edge to leave through a boundary event's bottom docking point. */
export function ensureExitBottom(be: Bounds, waypoints: Waypoint[]): Waypoint[] {
	if (waypoints.length === 0) return waypoints
	const exit = { x: be.x + be.width / 2, y: be.y + be.height }
	const stemY = exit.y + BOUNDARY_STEM
	const rest = waypoints.slice(1)
	const rejoin = rest[0] ?? exit
	return collapseCollinear([exit, { x: exit.x, y: stemY }, { x: rejoin.x, y: stemY }, ...rest])
}

/** Remove intermediate waypoints that lie on a straight segment; round coordinates. */
export function collapseCollinear(waypoints: Waypoint[]): Waypoint[] {
	const rounded = waypoints.map((w) => ({ x: Math.round(w.x), y: Math.round(w.y) }))
	const out: Waypoint[] = []
	for (const p of rounded) {
		const a = out[out.length - 2]
		const b = out[out.length - 1]
		if (b && b.x === p.x && b.y === p.y) continue
		if (a && b && ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))) {
			out[out.length - 1] = p
			continue
		}
		out.push(p)
	}
	return out
}
```

- [ ] **Step 4: Run to verify pass** — `pnpm --filter @bpmnkit/core test -- run tests/grid-layout.test.ts` → PASS. The exact-waypoint expectations in Step 1 are derived from §A.2.4 — if one fails, recheck the case math against the spec before touching the test.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
pnpm biome check packages/core --write && pnpm --filter @bpmnkit/core typecheck
git add -A packages/core && git commit -m "feat(core): add grid Manhattan edge router"
```

---

### Task 5: Move edge-label placement out of routing.ts

**Files:**
- Create: `packages/core/src/layout/grid/edge-labels.ts`
- Modify: `packages/core/src/layout/routing.ts` (remove the moved block), `packages/core/src/layout/layout-engine.ts` (import path only, if it imports `placeEdgeLabels` — check with grep)

This is a pure code MOVE so Task 8 can delete `routing.ts` without losing label placement. No behavior change.

- [ ] **Step 1: Locate the block** — `grep -n "placeEdgeLabels\|LABEL_COLLISION_TOLERANCE\|slideLabelAlongSegment" packages/core/src/layout/routing.ts packages/core/src/layout/layout-engine.ts`. The label code is `routing.ts:614` to end-of-function-group (~`:760`): constants `LABEL_COLLISION_TOLERANCE`, `LABEL_SLIDE_STEPS`, `placeEdgeLabels`, `slideLabelAlongSegment`, and their private helpers.
- [ ] **Step 2: Cut those functions verbatim into `edge-labels.ts`**, exporting `placeEdgeLabels`. Bring the imports the block needs (`LayoutEdge`, `LayoutNode`, `Bounds`, `LABEL_*` constants from `../types.js`).
- [ ] **Step 3: In `routing.ts`, re-export for now** (`export { placeEdgeLabels } from "./grid/edge-labels.js"`) so existing callers compile unchanged until Task 8.
- [ ] **Step 4: Verify** — `pnpm --filter @bpmnkit/core test -- run tests/layout.test.ts` (the "Edge label collision avoidance" suite must still pass) and `pnpm --filter @bpmnkit/core typecheck`.
- [ ] **Step 5: Commit** — `git commit -am "refactor(core): extract edge-label placement into grid/edge-labels"`

---

### Task 6: Grid engine — bounds, boundary events, subprocess nesting, LayoutResult

**Files:**
- Create: `packages/core/src/layout/grid/grid-engine.ts`
- Modify: `packages/core/src/layout/types.ts` (additive: `task`, `manualTask` 100×80; `complexGateway` 50×50; `transaction` 100×80 in `ELEMENT_SIZES`)
- Test: append to `packages/core/tests/grid-layout.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5 (`Grid`, `buildFlowGraph`, `createGridLayout`, `connectElements`, `ensureExitBottom`, `collapseCollinear`, `placeEdgeLabels`), `ELEMENT_SIZES`, `LayoutResult` types.
- Produces: `gridLayoutFlowNodes(flowNodes: BpmnFlowElement[], sequenceFlows: BpmnSequenceFlow[]): LayoutResult` — the full engine. Also internal `interface LevelLayout { graph: FlowGraph; grid: Grid<BpmnFlowElement>; children: Map<string, LevelLayout> }`.

Algorithm (per §A.2.3, in this exact order):

1. `buildLevel(flowNodes, sequenceFlows)`: recursively build a `LevelLayout` — recurse FIRST into every element whose `type ∈ {subProcess, adHocSubProcess, eventSubProcess, transaction}` AND `flowElements?.length > 0` (cast to accces `flowElements`/`sequenceFlows`, like `subprocess.ts:63` did), passing `compact: true` down when the child is an `adHocSubProcess` with zero sequence flows; THEN `createGridLayout` for the own level; THEN expand the own grid: scan columns right-to-left — for each column containing an expanded element insert `max(maxChildCols, 2)` columns after it via `createCol`; scan rows bottom-to-top — for each row containing one, insert `max(maxChildRows, 1)` rows after it via repeated `createRow(r)`.
2. `emitLevel(level, shift, out: LayoutResult)`:
   - Pass 1 — shapes. For each `{element, row, col}` of `grid.elementsByPosition()`:
     - size from `ELEMENT_SIZES[element.type] ?? {width: 100, height: 80}`; expanded children (a `children.get(id)` exists) get `w = childCols*150 + 100`, `h = childRows*140 + 80` but keep the base-size centering offset.
     - `bounds = { x: col*150 + (150−baseW)/2 + shift.x, y: row*140 + (140−baseH)/2 + shift.y, width: w, height: h }`.
     - push `LayoutNode { id, type, bounds, layer: col, position: row, gridRow: row, label: element.name, labelBounds: computeLabelBounds(element, bounds), isExpanded: children.has(id) ? true : undefined }`.
     - `computeLabelBounds`: copy verbatim from `coordinates.ts:141-178` (events + gateways: centered 4px below the shape; width `min(max(name.length*7, 40), 150)`, height 14).
     - After the host node: for each of its `n` attachers `be[i]` (0-based): `x = host.x + (i+1)*host.width/(n+1) − 18`, `y = host.y + host.height − 18`, 36×36; `LayoutNode` with `layer: col, position: row, gridRow: row`, label below (`labelBounds` shifted to `y + 36 + 4` — see `layout-engine.ts:84-86` for the old convention).
   - Pass 1b — recurse: `emitLevel(child, { x: subBounds.x + 50, y: subBounds.y + 40 }, out)`.
   - Pass 2 — edges. Build `routables: Map<string, RoutableNode>` for this level (each element with its bounds/row/col; expanded ones with `childGrid`; each boundary event with its own bounds but its HOST's row/col and `hostChildGrid`). Precompute `expandedRowsByRow`. For every sequence flow of this level: `waypoints = collapseCollinear(connectElements(routables.get(sourceRef), routables.get(targetRef), grid, shift, expandedRowsByRow))`; if the source is a boundary event, wrap with `ensureExitBottom(beBounds, waypoints)`; push `LayoutEdge { id, sourceRef, targetRef, waypoints, label: flow.name }`. Skip (with nothing emitted) any flow whose endpoint is missing from the map — the DI-completeness test in Task 10 will catch real losses; this guard is only for dangling refs in malformed input.
3. After the root level: `placeEdgeLabels(out.edges, nodeMap)` (same call shape as the old engine — check its signature in `edge-labels.ts`).

- [ ] **Step 1: Write the failing tests** (append)

```ts
import { gridLayoutFlowNodes } from "../src/layout/grid/grid-engine.js"
import { assertNoOverlap } from "../src/layout/overlap.js"

describe("Grid engine (integration)", () => {
	it("linear flow: centred in consecutive cells on one centreline", () => {
		const els = [node("s", "startEvent"), node("a", "userTask"), node("e", "endEvent")]
		const flows = [flow("f1", "s", "a"), flow("f2", "a", "e")]
		const r = gridLayoutFlowNodes(els, flows)
		const byId = new Map(r.nodes.map((n) => [n.id, n]))
		expect(byId.get("s")?.bounds).toEqual({ x: 57, y: 52, width: 36, height: 36 })
		expect(byId.get("a")?.bounds).toEqual({ x: 175, y: 30, width: 100, height: 80 })
		expect(byId.get("e")?.bounds).toEqual({ x: 357, y: 52, width: 36, height: 36 })
		// shared centreline
		expect(new Set(r.nodes.map((n) => n.bounds.y + n.bounds.height / 2))).toEqual(new Set([70]))
		expect(r.edges).toHaveLength(2)
	})

	it("boundary event sits on the host's bottom edge and its chain routes from it", () => {
		const els = [
			node("s", "startEvent"),
			node("host", "userTask"),
			node("be", "boundaryEvent", { attachedToRef: "host" }),
			node("rec", "userTask"),
			node("e", "endEvent"),
		]
		const flows = [flow("f1", "s", "host"), flow("f2", "host", "e"), flow("f3", "be", "rec")]
		const r = gridLayoutFlowNodes(els, flows)
		const byId = new Map(r.nodes.map((n) => [n.id, n]))
		const host = byId.get("host")
		const be = byId.get("be")
		if (!host || !be) throw new Error("missing nodes")
		expect(be.bounds.y + be.bounds.height / 2).toBe(host.bounds.y + host.bounds.height)
		expect(be.bounds.x + 18).toBe(host.bounds.x + host.bounds.width / 2)
		const chain = r.edges.find((edge) => edge.id === "f3")
		expect(chain?.waypoints[0]).toEqual({
			x: Math.round(be.bounds.x + 18),
			y: Math.round(be.bounds.y + 36),
		})
	})

	it("expanded subprocess encloses its children; children are absolute", () => {
		const child1 = node("c1", "userTask")
		const child2 = node("c2", "userTask")
		const sub = node("sub", "subProcess", {
			flowElements: [child1, child2],
			sequenceFlows: [flow("cf", "c1", "c2")],
		})
		const els = [node("s", "startEvent"), sub, node("e", "endEvent")]
		const flows = [flow("f1", "s", "sub"), flow("f2", "sub", "e")]
		const r = gridLayoutFlowNodes(els, flows)
		const byId = new Map(r.nodes.map((n) => [n.id, n]))
		const subNode = byId.get("sub")
		if (!subNode) throw new Error("missing sub")
		expect(subNode.isExpanded).toBe(true)
		expect(subNode.bounds.width).toBe(2 * 150 + 100)
		expect(subNode.bounds.height).toBe(1 * 140 + 80)
		for (const id of ["c1", "c2"]) {
			const c = byId.get(id)
			if (!c) throw new Error(`missing ${id}`)
			expect(c.bounds.x).toBeGreaterThanOrEqual(subNode.bounds.x)
			expect(c.bounds.x + c.bounds.width).toBeLessThanOrEqual(subNode.bounds.x + subNode.bounds.width)
			expect(c.bounds.y).toBeGreaterThanOrEqual(subNode.bounds.y)
			expect(c.bounds.y + c.bounds.height).toBeLessThanOrEqual(subNode.bounds.y + subNode.bounds.height)
		}
		expect(r.edges.map((edge) => edge.id).sort()).toEqual(["cf", "f1", "f2"])
	})

	it("every edge is orthogonal and no shapes overlap (fan of 3 branches + join + loop)", () => {
		const els = [
			node("s", "startEvent"),
			node("gw", "inclusiveGateway"),
			node("a", "userTask"),
			node("b", "userTask"),
			node("c", "userTask"),
			node("j", "inclusiveGateway"),
			node("chk", "exclusiveGateway"),
			node("e", "endEvent"),
		]
		const flows = [
			flow("f1", "s", "gw"),
			flow("f2", "gw", "a"),
			flow("f3", "gw", "b"),
			flow("f4", "gw", "c"),
			flow("f5", "a", "j"),
			flow("f6", "b", "j"),
			flow("f7", "c", "j"),
			flow("f8", "j", "chk"),
			flow("f9", "chk", "e"),
			flow("f10", "chk", "gw"), // loop back
		]
		const r = gridLayoutFlowNodes(els, flows)
		expect(r.nodes).toHaveLength(8)
		expect(r.edges).toHaveLength(10)
		for (const edge of r.edges) {
			for (let i = 1; i < edge.waypoints.length; i++) {
				const p = edge.waypoints[i - 1]
				const q = edge.waypoints[i]
				if (!p || !q) continue
				expect(p.x === q.x || p.y === q.y).toBe(true)
			}
		}
		assertNoOverlap({ nodes: r.nodes, edges: [] })
	})
})
```

- [ ] **Step 2: Run to verify failure**, then **Step 3: implement `grid-engine.ts`** per the numbered algorithm above. Skeleton with all structural decisions made (fill the marked bodies from the formulas already given — every formula is in §A.2.3/§A.2.4 or the algorithm list above; no invention needed):

```ts
// packages/core/src/layout/grid/grid-engine.ts
import type {
	BpmnBoundaryEvent,
	BpmnFlowElement,
	BpmnSequenceFlow,
} from "../../bpmn/bpmn-model.js"
import type { Bounds, LayoutEdge, LayoutNode, LayoutResult } from "../types.js"
import { ELEMENT_SIZES, GRID_CELL_HEIGHT, GRID_CELL_WIDTH } from "../types.js"
import { placeEdgeLabels } from "./edge-labels.js"
import type { FlowGraph } from "./flow-graph.js"
import { buildFlowGraph } from "./flow-graph.js"
import { Grid } from "./grid.js"
import type { RoutableNode } from "./grid-router.js"
import { collapseCollinear, connectElements, ensureExitBottom } from "./grid-router.js"
import { createGridLayout } from "./walker.js"

const DEFAULT_SIZE = { width: 100, height: 80 }
const SUB_TYPES = new Set(["subProcess", "adHocSubProcess", "eventSubProcess", "transaction"])
const CHILD_SHIFT_X = 50 // upstream: CELL_W/2 − baseW/4
const CHILD_SHIFT_Y = 40 // upstream: CELL_H − baseH − baseH/4

interface LevelLayout {
	graph: FlowGraph
	grid: Grid<BpmnFlowElement>
	children: Map<string, LevelLayout>
}

interface SubLike {
	flowElements?: BpmnFlowElement[]
	sequenceFlows?: BpmnSequenceFlow[]
}

export function gridLayoutFlowNodes(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): LayoutResult {
	if (flowNodes.length === 0) return { nodes: [], edges: [] }
	const root = buildLevel(flowNodes, sequenceFlows, false)
	const out: LayoutResult = { nodes: [], edges: [] }
	emitLevel(root, { x: 0, y: 0 }, out)
	const nodeMap = new Map(out.nodes.map((n) => [n.id, n]))
	placeEdgeLabels(out.edges, nodeMap)
	return out
}

function buildLevel(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	compact: boolean,
): LevelLayout {
	const graph = buildFlowGraph(flowNodes, sequenceFlows)
	const children = new Map<string, LevelLayout>()
	for (const el of graph.elements) {
		if (!SUB_TYPES.has(el.type)) continue
		const sub = el as unknown as SubLike
		if (!sub.flowElements || sub.flowElements.length === 0) continue
		const childFlows = sub.sequenceFlows ?? []
		const childCompact = el.type === "adHocSubProcess" && childFlows.length === 0
		children.set(el.id, buildLevel(sub.flowElements, childFlows, childCompact))
	}
	const grid = createGridLayout(graph, { compact })
	expandForChildren(grid, children)
	return { graph, grid, children }
}

/** Insert blank cols/rows after every cell holding an expanded subprocess (§A.2.3). */
function expandForChildren(
	grid: Grid<BpmnFlowElement>,
	children: Map<string, LevelLayout>,
): void {
	if (children.size === 0) return
	// columns, right-to-left
	for (let c = grid.colCount() - 1; c >= 0; c--) {
		let maxCols = 0
		for (const { element, col } of grid.elementsByPosition()) {
			if (col !== c) continue
			const child = children.get(element.id)
			if (child) maxCols = Math.max(maxCols, child.grid.colCount())
		}
		if (maxCols > 0) grid.createCol(c, Math.max(maxCols, 2))
	}
	// rows, bottom-to-top
	for (let r = grid.rowCount() - 1; r >= 0; r--) {
		let maxRows = 0
		for (const { element, row } of grid.elementsByPosition()) {
			if (row !== r) continue
			const child = children.get(element.id)
			if (child) maxRows = Math.max(maxRows, child.grid.rowCount())
		}
		for (let i = 0; i < maxRows; i++) grid.createRow(r)
	}
}

function sizeOf(el: BpmnFlowElement): { width: number; height: number } {
	return ELEMENT_SIZES[el.type] ?? DEFAULT_SIZE
}

function emitLevel(level: LevelLayout, shift: { x: number; y: number }, out: LayoutResult): void {
	const routables = new Map<string, RoutableNode>()
	const expandedRowsByRow = new Map<number, number>()
	const boundaryBounds = new Map<string, Bounds>()

	// Pass 1: shapes (+ boundary events + recursion into children)
	for (const { element, row, col } of level.grid.elementsByPosition()) {
		const base = sizeOf(element)
		const child = level.children.get(element.id)
		const bounds: Bounds = {
			x: col * GRID_CELL_WIDTH + (GRID_CELL_WIDTH - base.width) / 2 + shift.x,
			y: row * GRID_CELL_HEIGHT + (GRID_CELL_HEIGHT - base.height) / 2 + shift.y,
			width: child ? child.grid.colCount() * GRID_CELL_WIDTH + base.width : base.width,
			height: child ? child.grid.rowCount() * GRID_CELL_HEIGHT + base.height : base.height,
		}
		const layoutNode: LayoutNode = {
			id: element.id,
			type: element.type,
			bounds,
			layer: col,
			position: row,
			gridRow: row,
		}
		if (element.name) layoutNode.label = element.name
		const lb = computeLabelBounds(element, bounds)
		if (lb) layoutNode.labelBounds = lb
		if (child) layoutNode.isExpanded = true
		out.nodes.push(layoutNode)

		routables.set(element.id, {
			id: element.id,
			bounds,
			row,
			col,
			childGrid: child
				? { rows: child.grid.rowCount(), cols: child.grid.colCount() }
				: undefined,
		})
		if (child) {
			expandedRowsByRow.set(row, Math.max(expandedRowsByRow.get(row) ?? 0, child.grid.rowCount()))
		}

		// boundary events ride on the host's bottom edge
		const attachers = level.graph.attachers.get(element.id) ?? []
		for (let i = 0; i < attachers.length; i++) {
			const be = attachers[i] as BpmnBoundaryEvent
			// … 36×36 bounds at x = host.x + (i+1)*host.w/(n+1) − 18, y = host bottom − 18 …
			// push LayoutNode (label below shape), record in boundaryBounds + routables
			// (routable row/col = host's, hostChildGrid = child dims if host expanded)
		}

		if (child) {
			emitLevel(child, { x: bounds.x + CHILD_SHIFT_X, y: bounds.y + CHILD_SHIFT_Y }, out)
		}
	}

	// Pass 2: edges of THIS level
	for (const flows of level.graph.outgoing.values()) {
		for (const flow of flows) {
			const source = routables.get(flow.sourceRef)
			const target = routables.get(flow.targetRef)
			if (!source || !target) continue
			let waypoints = connectElements(
				source,
				target,
				level.grid as unknown as Grid<{ id: string }>,
				shift,
				expandedRowsByRow,
			)
			const beB = boundaryBounds.get(flow.sourceRef)
			if (beB) waypoints = ensureExitBottom(beB, waypoints)
			const edge: LayoutEdge = {
				id: flow.id,
				sourceRef: flow.sourceRef,
				targetRef: flow.targetRef,
				waypoints: collapseCollinear(waypoints),
			}
			if (flow.name) edge.label = flow.name
			out.edges.push(edge)
		}
	}
}

/** Copied from coordinates.ts:141 — events and gateways get a label below the shape. */
function computeLabelBounds(node: BpmnFlowElement, bounds: Bounds): Bounds | undefined {
	// … verbatim body of coordinates.ts computeLabelBounds …
	return undefined
}
```

Two `…` bodies remain: (a) the boundary-event block — formulas are in the algorithm list item "Pass 1 — shapes" and §A.2.3 last bullet; (b) `computeLabelBounds` — copy `packages/core/src/layout/coordinates.ts:141-178` verbatim (it still exists until Task 8). These are copy-from-spec/copy-from-file steps, not design work.

- [ ] **Step 4: Run to verify pass** — `pnpm --filter @bpmnkit/core test -- run tests/grid-layout.test.ts` → all green, including Tasks 2–4 suites.
- [ ] **Step 5: Lint, typecheck, commit** — `git commit -am "feat(core): grid layout engine producing LayoutResult"`

---

### Task 7: Annotation packer (port of tmp/01)

**Files:**
- Create: `packages/core/src/layout/annotations.ts`
- Test: append a `describe("Annotation packing", ...)` to `packages/core/tests/grid-layout.test.ts`

**Interfaces:**
- Consumes: `BpmnProcess` (for `textAnnotations` + `associations`), `LayoutNode[]`.
- Produces:
  ```ts
  export function packAnnotations(process: BpmnProcess, layoutNodes: LayoutNode[]): Map<string, Bounds>
  export function associationWaypoints(elementBounds: Bounds, annotationBounds: Bounds): { pElem: Waypoint; pAnn: Waypoint }
  ```
  `packAnnotations` implements §A.3 steps 1–3 exactly (constants, text-measured height via greedy word wrap, side by modal main-flow Y, skyline packing over `HORIZONTAL_SHIFTS` with `Math.hypot` cost). `associationWaypoints` implements §A.3 step 4 (edge-to-edge, clamped — port of `chooseWaypoints` in `tmp/01-annotation-layouting.cjs:365-389`; the four orientation cases are written out there and in §A.3).

- [ ] **Step 1: Failing tests** — cover: (1) height grows with text (`packAnnotations` of a 300-char annotation yields `height > 30` and `width === 200`); (2) two annotations linked to the same task do not overlap each other (padded by 20) nor the task (padded by 30); (3) an annotation linked to a below-main-flow element is placed BELOW it; (4) `associationWaypoints` for an annotation strictly above returns `pElem.y === elem.y` and `pAnn.y === ann.y + ann.height` with both x-values clamped into their rects.
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement** — direct port of `tmp/01-annotation-layouting.cjs` lines 96–345 (tunables, `computeHeight`, `naturalSide`, `packSide` with obstacle intervals and cost minimisation), operating on `LayoutNode[]` instead of parsed XML shapes: annotations sized/packed in layout space; obstacles = node bounds + labelBounds. Keep the constants exactly (`ANN_WIDTH=200` etc. — §A.3).
- [ ] **Step 4: Verify pass. Step 5: commit** — `git commit -am "feat(core): text-measuring skyline annotation packer"`

---

### Task 8: Integration switchover + dead-code removal + test migration

**Files:**
- Modify: `packages/core/src/layout/layout-engine.ts`, `packages/core/src/layout/index.ts`, `packages/core/src/index.ts`, `packages/core/src/bpmn/auto-layout.ts`, `packages/core/tests/layout.test.ts`
- Delete: `packages/core/src/layout/{block-builder,block-layout,layers,crossing,coordinates,routing,astar,subprocess,graph}.ts`

**Interfaces:**
- Consumes: `gridLayoutFlowNodes` (Task 6), `packAnnotations`/`associationWaypoints` (Task 7).
- Produces: unchanged public signatures `layoutProcess`, `layoutFlowNodes`, `applyAutoLayout`.

- [ ] **Step 1: Rewrite `layout-engine.ts`** to a thin façade (delete everything else in the file — the boundary repositioning, sugiyama pipeline, overlap cascades):

```ts
// packages/core/src/layout/layout-engine.ts
import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "../bpmn/bpmn-model.js"
import { gridLayoutFlowNodes } from "./grid/grid-engine.js"
import type { LayoutResult } from "./types.js"

/**
 * Layout a full process (grid engine). Boundary events, expanded
 * subprocesses and edge labels are handled inside the engine.
 * Never throws on residual label overlap — call assertNoOverlap yourself
 * in tests that validate known-good fixtures.
 */
export function layoutProcess(process: BpmnProcess): LayoutResult {
	return layoutFlowNodes(process.flowElements, process.sequenceFlows)
}

/** Layout a set of flow nodes and sequence flows (used by ascii, proxy, compact). */
export function layoutFlowNodes(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): LayoutResult {
	return gridLayoutFlowNodes(flowNodes, sequenceFlows)
}
```

- [ ] **Step 2: Update `auto-layout.ts`:**
  - Delete `computeAnnotationLocalBounds`, `countLineCrossings`, `hasOverlap`, `hasOverlapPadded` (auto-layout.ts:54-164) and the `resolveEdgeCrossings` import + call (`auto-layout.ts:2,400`).
  - Replace `const annBounds = computeAnnotationLocalBounds(process, result.nodes)` with `const annBounds = packAnnotations(process, result.nodes)` (import from `../layout/annotations.js`).
  - In `addAnnotationShapes`, replace the three-branch inline waypoint block (auto-layout.ts:336-355) with `associationWaypoints(elNode.bounds, annB)` + dx/dy shift + honour `sourceRef→targetRef` order (`wp1 = assoc.sourceRef === annId ? pAnn : pElem`, `wp2` the other, as in `tmp/01-annotation-layouting.cjs:403-404`).
- [ ] **Step 3: Delete the dead modules** listed above. BEFORE each `git rm`, grep the repo for imports of that module (`grep -rn "from \"./coordinates" packages apps` etc.). Known keeper: `bench.ts` must keep compiling — if it imports anything from a deleted module, inline the few lines it needs into `bench.ts` rather than keeping the module alive. Update `packages/core/src/layout/index.ts`: drop `buildBlockTree`, `FlowBlock/GatewayBlock/NodeBlock/SequenceBlock`, `applyBlockLayout`, `routeEdgeAstar`, `assignGridRows`; keep `layoutProcess`, `layoutFlowNodes`, bench exports, `assertNoOverlap`, all `types.ts` exports; add `export { checkDiCompleteness } ...` later (Task 10). Mirror the removals in `packages/core/src/index.ts` (grep each removed name there). This is the breaking-ish export prune covered by the changeset in Task 11.
- [ ] **Step 4: Migrate `packages/core/tests/layout.test.ts`** — decision table by existing `describe` (line numbers from current file):

| Suite (line) | Action |
|---|---|
| `Graph utilities` (115), `Layer assignment` (170), `Crossing minimization` (201), `Coordinate assignment` (218) | DELETE — test deleted modules. Grid equivalents live in `grid.test.ts`/`grid-layout.test.ts`. |
| `Edge routing` (299), `Gateway port assignment` (354), `resolveTargetPort` (1200), `L-shaped edge preference` (1324), `Edge routing efficiency` (1153) | DELETE port/A*-specific ones; RE-EXPRESS the engine-level invariants (orthogonality, ≤2 bends for straight-line neighbours, gateway branch flows leave via bottom for below-branches) as new tests in `grid-layout.test.ts` if not already covered by Task 4/6 tests. |
| `Overlap assertion` (558) | KEEP unchanged (tests `overlap.ts`). |
| `Layout engine (integration)` (608) | KEEP the fixture-based assertions that are contract-level (element sizes, no overlap, all edges orthogonal, subprocess padding ≥ children, adHoc grid wrap); UPDATE exact-coordinate expectations to grid-cell values (formula: centred in `(row, col)` cells — compute expected values, don't fuzz). |
| `Branch baseline alignment` (970), `Split/Join Y-alignment` (1020), `Early-return baseline` (1346), `Baseline path detection` (1387), `Baseline Y-alignment` (1484) | REPLACE with one suite `Happy path row` asserting: in a split/join fixture, start, split gateway, first branch, join, end all share `gridRow === 0` and one centre-Y. |
| `Edge label collision avoidance` (1082) | KEEP — exercises `placeEdgeLabels`, moved not changed. Fix imports to `grid/edge-labels.js`. |
| `Grid-based coordinate system` (1268) | KEEP — that convention is now literally true; update any tolerance-based assertions to exact equality. |
| `Join gateway with back-edge loop` (1570), `Back-edge loop alignment` (1626) | REWRITE against grid semantics: loop target retains its earlier column; closing edge routes below/above all rows with orthogonal segments and bottom/top dockings (Task 4 semantics). |
| `Boundary event convergence join placement` (1665) | REWRITE: successor at host `(row+1, col+1)`; edge exits host bottom via boundary event. |
| `Lane proportional height` (1810) | KEEP unchanged (tests `buildLaneShapes`, untouched). |

  `builder-layout-integration.test.ts` is NOT modified; it must pass as-is (round-trip fidelity, no-throw guarantees). If an assertion there encodes old-engine coordinates, treat it like the KEEP/UPDATE rule above and adjust the expected numbers to the grid values — nothing else.
- [ ] **Step 5: Full-package verification loop** — run until green:

```bash
pnpm --filter @bpmnkit/core test
pnpm --filter @bpmnkit/core typecheck
pnpm biome check packages/core --write
```

- [ ] **Step 6: Monorepo consumers** — `pnpm turbo typecheck && pnpm turbo test`. Expected fallout and fixes: `@bpmnkit/ascii` tests may assert old coordinates → update expected fixtures (its `render.ts` code needs no change); `apps/proxy` and `compact.ts` call `layoutProcess`/`layoutFlowNodes` and need no change; editor/desktop/studio call `applyAutoLayout` and need no change. Anything else failing = a regression to fix, not a fixture to update.
- [ ] **Step 7: Commit** — `git commit -am "feat(core)!: switch auto-layout to grid engine, remove sugiyama/block pipeline"`

---

### Task 9: Message-flow routing

**Files:**
- Modify: `packages/core/src/bpmn/auto-layout.ts`
- Test: append `describe("Message flow DI", ...)` to `packages/core/tests/grid-layout.test.ts` (build a two-pool collaboration via `Bpmn.parse` of a small XML fixture or the builder — follow the fixture style used in `builder-layout-integration.test.ts:47ff`)

Currently `applyAutoLayout` never emits DI for `collaboration.messageFlows` (serializer supports it: `bpmn-serializer.ts:426-445`; SVG renders it: `svg.ts:706`). Diagrams silently lose message flows.

- [ ] **Step 1: Failing test** — two participants, one message flow task→task across pools: after `applyAutoLayout`, `diagrams[0].plane.edges` contains an edge with `bpmnElement === messageFlow.id`, ≥2 waypoints, all segments orthogonal, first waypoint on the source shape's bottom edge (upper pool) and last on the target shape's top edge (lower pool). Second test: `sourceRef`/`targetRef` pointing at a PARTICIPANT id docks on the pool rectangle itself.
- [ ] **Step 2: Implement** in `applyAutoLayout`, after the process loop and before the `return` (all shapes exist by then):

```ts
if (collab && collab.messageFlows.length > 0) {
	const shapeByElement = new Map(allShapes.map((s) => [s.bpmnElement, s.bounds]))
	for (const mf of collab.messageFlows) {
		const src = shapeByElement.get(mf.sourceRef)
		const tgt = shapeByElement.get(mf.targetRef)
		if (!src || !tgt) continue
		const srcBelow = src.y + src.height / 2 > tgt.y + tgt.height / 2
		const sx = Math.round(src.x + src.width / 2)
		const tx = Math.round(tgt.x + tgt.width / 2)
		const sy = srcBelow ? src.y : src.y + src.height
		const ty = srcBelow ? tgt.y + tgt.height : tgt.y
		const midY = Math.round((sy + ty) / 2)
		const waypoints =
			sx === tx
				? [
						{ x: sx, y: sy },
						{ x: tx, y: ty },
					]
				: [
						{ x: sx, y: sy },
						{ x: sx, y: midY },
						{ x: tx, y: midY },
						{ x: tx, y: ty },
					]
		allEdges.push({ id: `${mf.id}_di`, bpmnElement: mf.id, waypoints, unknownAttributes: {} })
	}
}
```

- [ ] **Step 3: Verify pass, lint, typecheck. Step 4: Commit** — `git commit -am "feat(core): route message flows in auto-layout"`

---

### Task 10: DI completeness check (the 02-di-check invariant, in-process)

**Files:**
- Create: `packages/core/src/bpmn/di-check.ts`
- Modify: `packages/core/src/index.ts` and `packages/core/src/layout/index.ts` (export)
- Test: append `describe("DI completeness", ...)` to `packages/core/tests/grid-layout.test.ts`

- [ ] **Step 1: Failing test** — `checkDiCompleteness(applyAutoLayout(parsed))` returns empty arrays for: (a) a linear process, (b) a process with boundary event + subprocess + annotations, (c) a two-pool collaboration with a message flow, (d) every `.bpmn`/XML fixture already used by `bench.ts`/existing tests (iterate whatever fixture list exists — `grep -rl "\.bpmn" packages/core/tests` to find them). Also one NEGATIVE test: hand-build a defs whose plane lacks one shape → the id appears in `missingShapes`.
- [ ] **Step 2: Implement**

```ts
// packages/core/src/bpmn/di-check.ts
import type { BpmnDefinitions, BpmnFlowElement } from "./bpmn-model.js"

export interface DiCompleteness {
	missingShapes: string[]
	missingEdges: string[]
}

interface SubLike {
	flowElements?: BpmnFlowElement[]
	sequenceFlows?: Array<{ id: string }>
}

/**
 * Assert the diagram DI is complete: every flow node (recursively, incl.
 * subprocess children and boundary events) and text annotation has a
 * BPMNShape; every sequence flow, association and message flow has a
 * BPMNEdge. Lanes are ignored (no reliable lane DI — matches the
 * tmp/02-di-check.cjs rule this ports).
 */
export function checkDiCompleteness(defs: BpmnDefinitions): DiCompleteness {
	const shapes = new Set<string>()
	const edges = new Set<string>()
	for (const d of defs.diagrams) {
		for (const s of d.plane.shapes) shapes.add(s.bpmnElement)
		for (const e of d.plane.edges) edges.add(e.bpmnElement)
	}

	const missingShapes: string[] = []
	const missingEdges: string[] = []

	function walkElements(els: BpmnFlowElement[], flows: Array<{ id: string }>): void {
		for (const el of els) {
			if (!shapes.has(el.id)) missingShapes.push(el.id)
			const sub = el as unknown as SubLike
			if (sub.flowElements?.length) walkElements(sub.flowElements, sub.sequenceFlows ?? [])
		}
		for (const f of flows) {
			if (!edges.has(f.id)) missingEdges.push(f.id)
		}
	}

	for (const p of defs.processes) {
		walkElements(p.flowElements, p.sequenceFlows)
		for (const ta of p.textAnnotations) if (!shapes.has(ta.id)) missingShapes.push(ta.id)
		for (const a of p.associations) if (!edges.has(a.id)) missingEdges.push(a.id)
	}
	for (const c of defs.collaborations) {
		for (const part of c.participants) if (!shapes.has(part.id)) missingShapes.push(part.id)
		for (const mf of c.messageFlows) if (!edges.has(mf.id)) missingEdges.push(mf.id)
	}

	return { missingShapes, missingEdges }
}
```

- [ ] **Step 3: Export, verify pass, lint, typecheck. Step 4: Commit** — `git commit -am "feat(core): DI completeness check for auto-layout output"`

---

### Task 11: Benchmarks, docs, changeset, final gate

**Files:**
- Modify: `doc/progress.md`, `doc/features.md`, `doc/roadmap.md` (tick items if any match), `.changeset/<new>.md`
- Check only: `packages/core/src/layout/bench.ts` (should compile unchanged — it calls `applyAutoLayout`)

- [ ] **Step 1: Determinism test** — add one test: run `applyAutoLayout` twice on the same parsed fixture; `JSON.stringify` of both results is identical.
- [ ] **Step 2: Visual spot-check** — render 3 fixtures (linear+boundary, gateway fan + loop, two-pool collaboration with annotations) to SVG via the existing `svg.ts` exporter, write them into the scratchpad, and view them. Judge against §A.4: happy path one row, branches below, orthogonal edges, annotations above/below without overlaps. Fix what looks wrong before shipping — the tests encode geometry, the eyeball check encodes taste.
- [ ] **Step 3: Changeset** — `pnpm changeset` → minor for `@bpmnkit/core` (grid layout engine; export prune: `buildBlockTree`, `applyBlockLayout`, `routeEdgeAstar`, `assignGridRows` removed; new: `checkDiCompleteness`, message-flow DI). Patch for `@bpmnkit/ascii` if its fixtures changed.
- [ ] **Step 4: Docs** — `doc/progress.md`: one entry describing the switch; `doc/features.md`: update auto-layout feature description (grid engine, message flows, annotation packing).
- [ ] **Step 5: Final gate** (must all pass, zero warnings):

```bash
pnpm turbo build && pnpm turbo typecheck && pnpm biome check . && pnpm turbo test
```

- [ ] **Step 6: Commit** — `git commit -am "docs: record grid auto-layout switch; add changeset"`

---

## Self-review checklist (for the implementer, after Task 11)

1. Every consumer from the table in §"Global Constraints" still compiles and its tests pass — especially `packages/ascii/src/render.ts`, `apps/proxy/src/bridge.ts`, `apps/proxy/src/mcp-server.ts`, `packages/core/src/bpmn/compact.ts`, `packages/core/src/bpmn/bpmn-builder.ts:2512`.
2. `checkDiCompleteness` is empty for every test fixture (this is the exact failure mode `tmp/02-di-check.cjs` existed to catch).
3. No file imports the deleted modules (grep `block-builder|block-layout|sugiyama|routeEdgeAstar|assignGridRows|resolveEdgeCrossings|repositionBoundaryEvents|layoutSubProcesses` across the repo).
4. `tmp/` was never modified — it is reference material only.
