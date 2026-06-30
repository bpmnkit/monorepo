# Boundary Convergence Join Forward Placement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `repositionBoundaryEvents` so that any node excluded from all boundary chains but fed by relocated chain tails is pushed rightward (forward in X), preventing backward sequence flows.

**Architecture:** After the existing boundary-chain placement loop (which positions each chain's nodes to the right of their host task), add a single topological forward pass that re-checks every non-chain node's X against the rightmost predecessor. If a predecessor has moved further right (due to chain relocation), the node is shifted right and its label follows. Edges whose source or target moved are then re-routed with straight horizontal waypoints.

**Tech Stack:** TypeScript (strict), Vitest, existing layout-engine.ts helpers.

## Global Constraints

- Zero type errors (`pnpm tsc --noEmit`)
- Zero Biome warnings (`pnpm biome check .`)
- All existing tests pass (`pnpm turbo test`)
- New tests are deterministic — no timing or random values
- Touch only the two files listed below — no reformatting of surrounding code

---

## File Map

| File | Change |
|---|---|
| `packages/core/src/layout/layout-engine.ts` | Add chain accumulation + forward pass + edge re-route inside `repositionBoundaryEvents` |
| `packages/core/tests/layout.test.ts` | Add new `describe` block with 2 regression tests |

---

### Task 1: Write the failing tests

**Files:**
- Modify: `packages/core/tests/layout.test.ts`

**Interfaces:**
- Consumes: `layoutProcess` (already imported), `node()`, `flow()`, `proc()` helpers (already defined in the file)

- [ ] **Step 1: Open `packages/core/tests/layout.test.ts` and add the following `describe` block at the end of the file, before the final closing brace of the outermost scope. It goes after the last existing `describe` block.**

```typescript
describe("Boundary event convergence join placement", () => {
  it("places join after the rightmost chain tail when two boundary chains converge", () => {
    // Start → A → M1 → M2 → EndMain
    // B1 (boundary on M1) → H1 → Join → EndJoin
    // B2 (boundary on M2) → H2 → Join
    const be1 = node("B1", "boundaryEvent")
    ;(be1 as { attachedToRef: string }).attachedToRef = "M1"
    const be2 = node("B2", "boundaryEvent")
    ;(be2 as { attachedToRef: string }).attachedToRef = "M2"

    const process = proc(
      "P",
      [
        node("Start", "startEvent"),
        node("A", "serviceTask"),
        node("M1", "serviceTask"),
        node("M2", "serviceTask"),
        node("EndMain", "endEvent"),
        be1,
        be2,
        node("H1", "serviceTask"),
        node("H2", "serviceTask"),
        node("Join", "exclusiveGateway"),
        node("EndJoin", "endEvent"),
      ],
      [
        flow("f0", "Start", "A"),
        flow("f1", "A", "M1"),
        flow("f2", "M1", "M2"),
        flow("f3", "M2", "EndMain"),
        flow("fb1", "B1", "H1"),
        flow("fb2", "B2", "H2"),
        flow("fh1", "H1", "Join"),
        flow("fh2", "H2", "Join"),
        flow("fj", "Join", "EndJoin"),
      ],
    )

    const result = layoutProcess(process)
    const nodeMap = new Map(result.nodes.map((n) => [n.id, n]))

    const h1 = nodeMap.get("H1")
    const h2 = nodeMap.get("H2")
    const join = nodeMap.get("Join")
    const endJoin = nodeMap.get("EndJoin")
    expect(h1).toBeDefined()
    expect(h2).toBeDefined()
    expect(join).toBeDefined()
    expect(endJoin).toBeDefined()
    if (!h1 || !h2 || !join || !endJoin) return

    const h1Right = h1.bounds.x + h1.bounds.width
    const h2Right = h2.bounds.x + h2.bounds.width
    const maxChainRight = Math.max(h1Right, h2Right)

    // Join must be placed to the right of both chain tails
    expect(join.bounds.x).toBeGreaterThanOrEqual(maxChainRight)

    // EndJoin must be placed to the right of Join
    const joinRight = join.bounds.x + join.bounds.width
    expect(endJoin.bounds.x).toBeGreaterThanOrEqual(joinRight)

    // All sequence flows must be left-to-right (no backward edges)
    const edgeIds = ["fh1", "fh2", "fj"]
    for (const eid of edgeIds) {
      const edge = result.edges.find((e) => e.id === eid)
      expect(edge, `edge ${eid}`).toBeDefined()
      if (!edge) continue
      const src = nodeMap.get(edge.sourceRef)
      const tgt = nodeMap.get(edge.targetRef)
      if (!src || !tgt) continue
      expect(
        src.bounds.x + src.bounds.width,
        `edge ${eid}: source right must be <= target left`,
      ).toBeLessThanOrEqual(tgt.bounds.x + 1) // +1 for rounding tolerance
    }

    // No overlaps
    expect(() => assertNoOverlap(result)).not.toThrow()
  })

  it("single boundary chain (join is on the chain) is unchanged by the forward pass", () => {
    // Start → Task → End
    // B (boundary on Task) → H → ChainEnd
    // Join node not present — no convergence join needed
    const be = node("B", "boundaryEvent")
    ;(be as { attachedToRef: string }).attachedToRef = "Task"

    const process = proc(
      "P",
      [
        node("Start", "startEvent"),
        node("Task", "serviceTask"),
        node("End", "endEvent"),
        be,
        node("H", "serviceTask"),
        node("ChainEnd", "endEvent"),
      ],
      [
        flow("f0", "Start", "Task"),
        flow("f1", "Task", "End"),
        flow("fb", "B", "H"),
        flow("fh", "H", "ChainEnd"),
      ],
    )

    const result = layoutProcess(process)
    const nodeMap = new Map(result.nodes.map((n) => [n.id, n]))

    const bNode = nodeMap.get("B")
    const hNode = nodeMap.get("H")
    const chainEnd = nodeMap.get("ChainEnd")
    const taskNode = nodeMap.get("Task")
    expect(bNode).toBeDefined()
    expect(hNode).toBeDefined()
    expect(chainEnd).toBeDefined()
    expect(taskNode).toBeDefined()
    if (!bNode || !hNode || !chainEnd || !taskNode) return

    // Boundary event is on the host's bottom edge (existing invariant)
    const taskBottom = taskNode.bounds.y + taskNode.bounds.height
    const bCenterY = bNode.bounds.y + bNode.bounds.height / 2
    expect(bCenterY).toBeCloseTo(taskBottom, 0)

    // H (chain head) is to the right of the task
    expect(hNode.bounds.x).toBeGreaterThan(taskNode.bounds.x)

    // ChainEnd is to the right of H
    expect(chainEnd.bounds.x).toBeGreaterThan(hNode.bounds.x)

    // All edges are left-to-right
    for (const edge of result.edges) {
      const src = nodeMap.get(edge.sourceRef)
      const tgt = nodeMap.get(edge.targetRef)
      if (!src || !tgt) continue
      expect(
        src.bounds.x + src.bounds.width,
        `edge ${edge.id}: source right must be <= target left`,
      ).toBeLessThanOrEqual(tgt.bounds.x + 1)
    }

    expect(() => assertNoOverlap(result)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the new tests to verify they FAIL**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -A 5 "Boundary event convergence"
```

Expected: the first test fails with `join.bounds.x` being less than `maxChainRight`.

---

### Task 2: Implement the fix in `repositionBoundaryEvents`

**Files:**
- Modify: `packages/core/src/layout/layout-engine.ts:32-156`

The fix has three parts inside `repositionBoundaryEvents`:
1. Declare `allChainNodes` before the outer `for` loop (line 55)
2. After each chain's `chainSet` is built (after the BFS while-loop, around line 91), add all chain members to `allChainNodes`
3. After the outer `for` loop (after line 155, before the closing brace of the function), add the forward-placement pass + edge re-route

- [ ] **Step 1: Add `allChainNodes` declaration before the outer loop**

In `packages/core/src/layout/layout-engine.ts`, find this line just before the outer `for` loop:

```typescript
	for (const [hostId, beIds] of boundaryMap) {
```

Add directly BEFORE that line:

```typescript
	const allChainNodes = new Set<string>()

```

- [ ] **Step 2: Record each chain's members into `allChainNodes`**

Find the end of the BFS block inside the inner `for (let i = 0; i < beIds.length; i++)` loop. The BFS ends with:

```typescript
			while (queue.length > 0) {
				const id = queue.shift()
				if (!id || chainSet.has(id)) continue
				const preds = predIds.get(id) ?? new Set<string>()
				if ([...preds].every((p) => chainSet.has(p))) {
					chainSet.add(id)
					chainOrder.push(id)
					queue.push(...(succIds.get(id) ?? []))
				}
			}
```

Immediately AFTER that closing `}` (the one that closes the `while`), add:

```typescript

			// Record all chain members so the forward pass can identify them.
			for (const cid of chainSet) allChainNodes.add(cid)
```

- [ ] **Step 3: Add the forward-placement pass and edge re-route after the outer loop**

Find the closing brace of `for (const [hostId, beIds] of boundaryMap)`. It is the last `}` inside `repositionBoundaryEvents`, before the function's own closing `}`. After it, add:

```typescript

	// Forward-placement pass: any node not in any chain but whose predecessor
	// has been relocated further right must be pushed rightward.
	// Process in topological order (Kahn's algorithm over the sequenceFlow graph).
	const inDegree = new Map<string, number>()
	for (const id of nodeById.keys()) {
		inDegree.set(id, (predIds.get(id) ?? new Set()).size)
	}
	const topoQueue: string[] = []
	for (const [id, deg] of inDegree) {
		if (deg === 0) topoQueue.push(id)
	}
	const topoOrder: string[] = []
	while (topoQueue.length > 0) {
		const id = topoQueue.shift()
		if (!id) break
		topoOrder.push(id)
		for (const succId of succIds.get(id) ?? []) {
			const newDeg = (inDegree.get(succId) ?? 1) - 1
			inDegree.set(succId, newDeg)
			if (newDeg === 0) topoQueue.push(succId)
		}
	}

	const movedInPass = new Set<string>()

	for (const id of topoOrder) {
		if (allChainNodes.has(id)) continue
		const node = nodeById.get(id)
		if (!node) continue
		const preds = predIds.get(id) ?? new Set<string>()
		if (preds.size === 0) continue

		let maxPredRight = 0
		for (const predId of preds) {
			const pred = nodeById.get(predId)
			if (pred) maxPredRight = Math.max(maxPredRight, pred.bounds.x + pred.bounds.width)
		}

		const minX = maxPredRight + CHAIN_GAP
		if (minX > node.bounds.x) {
			const delta = minX - node.bounds.x
			node.bounds.x = minX
			if (node.labelBounds) node.labelBounds.x += delta
			movedInPass.add(id)
		}
	}

	// Re-route edges where a chain source now points at a moved target,
	// or where the source itself was moved by the forward pass.
	for (const edge of result.edges) {
		const srcMoved = movedInPass.has(edge.sourceRef)
		const tgtMoved = movedInPass.has(edge.targetRef)
		const srcInChain = allChainNodes.has(edge.sourceRef)
		if (!srcMoved && !(srcInChain && tgtMoved)) continue
		const src = nodeById.get(edge.sourceRef)
		const tgt = nodeById.get(edge.targetRef)
		if (!src || !tgt) continue
		const srcX = Math.round(src.bounds.x + src.bounds.width)
		const srcY = Math.round(src.bounds.y + src.bounds.height / 2)
		const tgtX = Math.round(tgt.bounds.x)
		const tgtY = Math.round(tgt.bounds.y + tgt.bounds.height / 2)
		edge.waypoints = [
			{ x: srcX, y: srcY },
			{ x: tgtX, y: tgtY },
		]
	}
```

- [ ] **Step 4: Run the new tests to verify they PASS**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -A 5 "Boundary event convergence"
```

Expected: both tests PASS.

- [ ] **Step 5: Run the full test suite**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test
```

Expected: all tests pass, zero failures.

- [ ] **Step 6: Run type checking and linting**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo typecheck && pnpm biome check packages/core/src/layout/layout-engine.ts packages/core/tests/layout.test.ts
```

Expected: zero errors, zero warnings.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/layout/layout-engine.ts packages/core/tests/layout.test.ts
git commit -m "fix: push convergence join past relocated boundary-chain tails

When two boundary-event handler chains converge on a shared join gateway,
repositionBoundaryEvents correctly excluded the join from each chain (its
predecessors span multiple chains). After relocation, the join's x was
never updated, producing backward right→left sequence flows.

Fix: after the chain placement loop, run a topological forward pass over
all non-chain nodes. Any node whose predecessor has moved further right is
pushed to max(pred.right) + CHAIN_GAP. Affected edges (chain→moved-target
or moved-source→target) are re-routed with straight horizontal waypoints."
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| `Join.x ≥ max(H1.right, H2.right)` | Task 2 (fix) + Task 1 (test) |
| No sequence flow has `target.centerX < source.centerX` | Task 1 (test assertion) |
| Single-boundary single-chain layouts unchanged | Task 1 (second test) |
| Join on main path (already forward) unchanged | Forward pass uses `if (minX > node.bounds.x)` guard — only pushes right, never left |
| Round-trips with complete overlap-free DI | `assertNoOverlap` already runs at end of `layoutProcess`; test calls it explicitly |

### Placeholder scan

None — all code blocks are complete.

### Type consistency

- `allChainNodes: Set<string>` — matches `chainSet: Set<string>` type
- `movedInPass: Set<string>` — used only with `has()` check
- `inDegree: Map<string, number>` — standard Kahn's algorithm
- `predIds` / `succIds` types are `Map<string, Set<string>>` and `Map<string, string[]>` respectively — the pass uses `predIds.get(id) ?? new Set()` and `succIds.get(id) ?? []` matching the existing usage pattern in the function
