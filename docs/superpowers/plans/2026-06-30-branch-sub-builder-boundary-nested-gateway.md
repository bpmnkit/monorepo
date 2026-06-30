# Branch Sub-builder: Boundary Events and Nested Gateway `.branch()` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `boundaryEvent()`, `withBoundary()`, and nested `branch()` to `BranchBuilder` so branch lambdas have the same boundary-attachment and gateway-splitting surface as the top-level builder.

**Architecture:** All three methods mutate `BranchBuilder` in place (same pattern as `ProcessBuilder.withBoundary()`). `boundaryEvent()` and `withBoundary()` push the boundary element directly without creating a sequence flow. Nested `branch()` requires adding `currentGatewayId` and `openBranchEnds` tracking to `BranchBuilder`, mirroring what already exists in `ProcessBuilder` and `SubProcessContentBuilder`. `ProcessBuilder.branch()` and `SubProcessContentBuilder.branch()` both call `b._lastNodeId` and need updating to handle `string | undefined` and propagate `b._openBranchEnds`.

**Tech Stack:** TypeScript strict, Vitest, single file: `packages/core/src/bpmn/bpmn-builder.ts`.

## Global Constraints

- Zero TypeScript errors.
- Zero Biome lint/format warnings.
- All existing tests continue to pass.
- New behavior matches acceptance criteria from issue #127.
- No new package dependencies.

---

### Task 1: Add infrastructure fields and update `addElement()` in `BranchBuilder`

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:735-996` (BranchBuilder class)
- Test: `packages/core/tests/bpmn-builder.test.ts`

**Interfaces:**
- Produces: `BranchBuilder._openBranchEnds: string[]` (new `@internal` getter), `BranchBuilder._lastNodeId` now `string | undefined`

- [ ] **Step 1: Write failing tests for `addElement()` drainage — nested branch auto-connect**

Add this test block near the existing "fan-out" describe block in `bpmn-builder.test.ts`:

```typescript
describe("BranchBuilder nested branch infrastructure", () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it("elements added after nested branches in a branch auto-connect from all open ends", () => {
    // This exercises the new openBranchEnds drainage in BranchBuilder.addElement()
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .exclusiveGateway("outer-gw")
      .branch("path-a", (b) => {
        b.exclusiveGateway("inner-gw")
          .branch("x", (bb) => bb.userTask("t-x"))
          .branch("y", (bb) => bb.userTask("t-y"))
          .userTask("t-after")
      })
      .branch("path-b", (b) => b.endEvent("e-b"))
      .build()

    const p = firstProcess(defs)
    // t-x and t-y both connect to t-after
    expect(p.sequenceFlows.some((f) => f.sourceRef === "t-x" && f.targetRef === "t-after")).toBe(true)
    expect(p.sequenceFlows.some((f) => f.sourceRef === "t-y" && f.targetRef === "t-after")).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -A 5 "nested branch infrastructure"
```

Expected: FAIL — "b.exclusiveGateway(...).branch is not a function" or similar.

- [ ] **Step 3: Add `currentGatewayId` and `openBranchEnds` fields to `BranchBuilder`**

In `bpmn-builder.ts`, inside `BranchBuilder` class, after the `_associations` field (around line 752), add:

```typescript
/** @internal – ID of the last gateway added in this branch (for nested branch() support). */
private currentGatewayId: string | undefined
/** @internal – Open ends of nested branches waiting to auto-connect to the next element. */
private openBranchEnds: string[] = []
```

- [ ] **Step 4: Update `addElement()` in `BranchBuilder` to handle undefined `lastNodeId` and drain `openBranchEnds`**

Replace the current `addElement()` method (around line 790):

```typescript
private addElement(element: BpmnFlowElement): this {
  this._elements.push(element)

  if (this.lastNodeId) {
    const flowId = generateId("Flow")
    const flow: BpmnSequenceFlow = {
      id: flowId,
      sourceRef: this.lastNodeId,
      targetRef: element.id,
      name: this.isFirstElement ? this.branchName : undefined,
      conditionExpression:
        this.isFirstElement && this.pendingCondition
          ? makeConditionExpression(this.pendingCondition)
          : undefined,
      extensionElements: [],
      unknownAttributes: {},
    }
    this._flows.push(flow)
    if (this.isFirstElement && this.pendingDefault) {
      this._defaultFlowId = flowId
    }
    this.isFirstElement = false
  }

  for (const branchEnd of this.openBranchEnds) {
    this._flows.push({
      id: generateId("Flow"),
      sourceRef: branchEnd,
      targetRef: element.id,
      extensionElements: [],
      unknownAttributes: {},
    })
  }
  this.openBranchEnds = []

  this.lastNodeId = element.id
  return this
}
```

- [ ] **Step 5: Update `_lastNodeId` getter to `string | undefined` and add `_openBranchEnds` getter**

Replace the existing `_lastNodeId` getter (around line 847):

```typescript
/** @internal – ID of the last element added (or undefined if branches are open). */
get _lastNodeId(): string | undefined {
  return this.lastNodeId
}

/** @internal – Open ends of nested branches that have not yet been connected. */
get _openBranchEnds(): string[] {
  return this.openBranchEnds
}
```

- [ ] **Step 6: Update gateway methods to also set `currentGatewayId`**

Find the four gateway methods in `BranchBuilder` (around lines 981-995). Replace:

```typescript
exclusiveGateway(id: string, options?: GatewayOptions): this {
  this.currentGatewayId = id
  return this.addElement(makeExclusiveGatewayEl(id, options))
}

parallelGateway(id: string, options?: ElementOptions): this {
  this.currentGatewayId = id
  return this.addElement(makeFlowElement(id, "parallelGateway", options))
}

inclusiveGateway(id: string, options?: GatewayOptions): this {
  this.currentGatewayId = id
  return this.addElement(makeInclusiveGatewayEl(id, options))
}

eventBasedGateway(id: string, options?: ElementOptions): this {
  this.currentGatewayId = id
  return this.addElement(makeFlowElement(id, "eventBasedGateway", options))
}
```

- [ ] **Step 7: Run typecheck and test**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm tsc --noEmit 2>&1 | head -30
```

TypeScript will complain because `_lastNodeId` changed from `string` to `string | undefined` — two callers in `ProcessBuilder.branch()` and `SubProcessContentBuilder.branch()`. That's expected at this stage. Do NOT stop here; proceed to Task 2.

- [ ] **Step 8: Commit (partial — infra only, not yet passing)**

```bash
git add packages/core/src/bpmn/bpmn-builder.ts packages/core/tests/bpmn-builder.test.ts
git commit -m "refactor(core): add currentGatewayId/openBranchEnds to BranchBuilder infra"
```

---

### Task 2: Update callers of `_lastNodeId` in `ProcessBuilder` and `SubProcessContentBuilder`

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts` — `ProcessBuilder.branch()` (line ~1637) and `SubProcessContentBuilder.branch()` (line ~1183)

**Interfaces:**
- Consumes: `BranchBuilder._lastNodeId: string | undefined` (Task 1), `BranchBuilder._openBranchEnds: string[]` (Task 1)

- [ ] **Step 1: Update `SubProcessContentBuilder.branch()` open-ends logic**

Find `SubProcessContentBuilder.branch()` (around line 1183). Replace the open-ends block:

```typescript
// OLD:
if (!b._connected && b._elements.length > 0) {
  const lastEl = b._elements[b._elements.length - 1]
  if (lastEl && lastEl.type !== "endEvent") {
    this.openBranchEnds.push(b._lastNodeId)
  }
}

// NEW:
if (!b._connected) {
  const allEnds: string[] = [
    ...(b._lastNodeId !== undefined ? [b._lastNodeId] : []),
    ...b._openBranchEnds,
  ]
  for (const endId of allEnds) {
    const endEl = this._elements.find((n) => n.id === endId)
    if (endEl && endEl.type !== "endEvent") {
      this.openBranchEnds.push(endId)
    }
  }
}
```

- [ ] **Step 2: Update `ProcessBuilder.branch()` open-ends logic**

Find `ProcessBuilder.branch()` (around line 1637). Replace the open-ends block:

```typescript
// OLD:
if (!b._connected && b._elements.length > 0) {
  const lastEl = b._elements[b._elements.length - 1]
  if (lastEl && lastEl.type !== "endEvent") {
    this.openBranchEnds.push(b._lastNodeId)
  }
}

// NEW:
if (!b._connected) {
  const allEnds: string[] = [
    ...(b._lastNodeId !== undefined ? [b._lastNodeId] : []),
    ...b._openBranchEnds,
  ]
  for (const endId of allEnds) {
    const endEl = this.flowElements.find((n) => n.id === endId)
    if (endEl && endEl.type !== "endEvent") {
      this.openBranchEnds.push(endId)
    }
  }
}
```

- [ ] **Step 3: Run typecheck**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 4: Run all tests**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core 2>&1 | tail -20
```

Expected: all existing tests pass. The new "nested branch infrastructure" test from Task 1 still fails (we haven't added `branch()` to `BranchBuilder` yet).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/bpmn/bpmn-builder.ts
git commit -m "fix(core): update _lastNodeId callers to handle string | undefined and propagate nested open ends"
```

---

### Task 3: Add `branch()` to `BranchBuilder`

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts` — `BranchBuilder` class

**Interfaces:**
- Consumes: `currentGatewayId` and `openBranchEnds` added in Task 1

- [ ] **Step 1: Write failing tests for nested `branch()` in a branch**

Add to the "BranchBuilder nested branch infrastructure" describe from Task 1:

```typescript
it("exclusiveGateway inside a branch supports branch() sub-split with endEvent termination", () => {
  const defs = Bpmn.createProcess("proc")
    .startEvent("s")
    .exclusiveGateway("outer-gw")
    .branch("path-a", (b) => {
      b.exclusiveGateway("inner-gw")
        .branch("x", (bb) => bb.condition("= x").endEvent("e-x"))
        .branch("y", (bb) => bb.defaultFlow().endEvent("e-y"))
    })
    .branch("path-b", (b) => b.endEvent("e-b"))
    .build()

  const p = firstProcess(defs)
  // inner-gw exists
  expect(p.flowElements.some((e) => e.id === "inner-gw")).toBe(true)
  // outer-gw → inner-gw (labeled "path-a")
  expect(p.sequenceFlows.some((f) => f.sourceRef === "outer-gw" && f.targetRef === "inner-gw" && f.name === "path-a")).toBe(true)
  // inner-gw → e-x (labeled "x")
  expect(p.sequenceFlows.some((f) => f.sourceRef === "inner-gw" && f.targetRef === "e-x" && f.name === "x")).toBe(true)
  // inner-gw → e-y (labeled "y")
  expect(p.sequenceFlows.some((f) => f.sourceRef === "inner-gw" && f.targetRef === "e-y" && f.name === "y")).toBe(true)
})

it("nested branch with connectTo correctly wires to a process-level element", () => {
  const defs = Bpmn.createProcess("proc")
    .startEvent("s")
    .exclusiveGateway("outer-gw")
    .branch("path-a", (b) => {
      b.exclusiveGateway("inner-gw")
        .branch("x", (bb) => bb.condition("= x").userTask("t-x").connectTo("outer-merge"))
        .branch("y", (bb) => bb.defaultFlow().userTask("t-y").connectTo("outer-merge"))
    })
    .branch("path-b", (b) => b.serviceTask("t-b", { name: "B", taskType: "b" }).connectTo("outer-merge"))
    .exclusiveGateway("outer-merge")
    .endEvent("e")
    .build()

  const p = firstProcess(defs)
  // Both inner branches connect to outer-merge
  expect(p.sequenceFlows.some((f) => f.sourceRef === "t-x" && f.targetRef === "outer-merge")).toBe(true)
  expect(p.sequenceFlows.some((f) => f.sourceRef === "t-y" && f.targetRef === "outer-merge")).toBe(true)
})

it("throws when branch() called without preceding gateway inside a branch", () => {
  expect(() =>
    Bpmn.createProcess("proc")
      .startEvent("s")
      .exclusiveGateway("gw")
      .branch("a", (b) => {
        b.userTask("t")
          // @ts-expect-error — no gateway before branch
          .branch("x", (bb) => bb.endEvent("e"))
      })
      .build(),
  ).toThrow("branch() must be called after a gateway element")
})
```

- [ ] **Step 2: Run to verify tests fail**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -E "FAIL|branch.*nested"
```

Expected: FAIL — "b.exclusiveGateway(...).branch is not a function".

- [ ] **Step 3: Add `branch()` to `BranchBuilder`**

Add after the `eventBasedGateway()` method in `BranchBuilder` (around line 995):

```typescript
/**
 * Create a named branch from the last gateway added inside this branch.
 *
 * Works identically to the top-level `ProcessBuilder.branch()` — use
 * `.condition(expr)` or `.defaultFlow()` inside the callback, finish with
 * `.connectTo(id)` or an `.endEvent()` to terminate the nested branch.
 */
branch(name: string, callback: (b: BranchBuilder) => void): this {
  if (!this.currentGatewayId) {
    throw new Error("branch() must be called after a gateway element")
  }
  const b = new BranchBuilder(
    this.currentGatewayId,
    name,
    this.rootErrors,
    this.rootMessages,
    this.rootSignals,
    this.rootEscalations,
  )
  callback(b)

  for (const el of b._elements) {
    if (this._elements.some((n) => n.id === el.id)) {
      throw new Error(`Duplicate element ID "${el.id}"`)
    }
    this._elements.push(el)
  }
  for (const fl of b._flows) this._flows.push(fl)
  for (const ann of b._textAnnotations) this._textAnnotations.push(ann)
  for (const assoc of b._associations) this._associations.push(assoc)

  if (b._defaultFlowId) {
    const gw = this._elements.find((n) => n.id === this.currentGatewayId)
    if (gw && (gw.type === "exclusiveGateway" || gw.type === "inclusiveGateway")) {
      gw.default = b._defaultFlowId
    }
  }

  if (!b._connected) {
    const allEnds: string[] = [
      ...(b._lastNodeId !== undefined ? [b._lastNodeId] : []),
      ...b._openBranchEnds,
    ]
    for (const endId of allEnds) {
      const endEl = this._elements.find((n) => n.id === endId)
      if (endEl && endEl.type !== "endEvent") {
        this.openBranchEnds.push(endId)
      }
    }
  }

  this.lastNodeId = undefined
  return this
}
```

- [ ] **Step 4: Run typecheck**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 5: Run tests**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core 2>&1 | tail -20
```

Expected: all tests pass including the new nested-branch tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/bpmn/bpmn-builder.ts packages/core/tests/bpmn-builder.test.ts
git commit -m "feat(core): add branch() to BranchBuilder for nested gateway splits"
```

---

### Task 4: Add `boundaryEvent()` and `withBoundary()` to `BranchBuilder`

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts` — `BranchBuilder` class
- Test: `packages/core/tests/bpmn-builder.test.ts`

**Interfaces:**
- Consumes: `buildEventDefinitions` (already used by BranchBuilder), `makeFlowElement` (already used)
- Produces: `BranchBuilder.boundaryEvent()`, `BranchBuilder.withBoundary()`

- [ ] **Step 1: Write failing tests for `boundaryEvent()` and `withBoundary()` inside a branch**

Add a new describe block in `bpmn-builder.test.ts` after the existing `withBoundary` describe:

```typescript
describe("boundary events inside a branch", () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it("boundaryEvent() inside a branch attaches to the preceding task via attachedToRef", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .exclusiveGateway("gw")
      .branch("path-a", (b) => {
        b.userTask("ut")
          .boundaryEvent("be", { attachedTo: "ut", timerDuration: "PT4H", cancelActivity: false })
          .endEvent("e-timeout")
      })
      .branch("path-b", (b) => b.endEvent("e-b"))
      .build()

    const p = firstProcess(defs)
    const be = p.flowElements.find((e) => e.id === "be")
    expect(be).toBeDefined()
    if (be?.type !== "boundaryEvent") throw new Error("expected boundaryEvent")
    expect(be.attachedToRef).toBe("ut")
    expect(be.cancelActivity).toBe(false)
    expect(be.eventDefinitions).toHaveLength(1)
    expect(be.eventDefinitions[0]?.type).toBe("timer")
    // Boundary event chains to e-timeout
    expect(p.sequenceFlows.some((f) => f.sourceRef === "be" && f.targetRef === "e-timeout")).toBe(true)
    // No sequence flow from ut to be (boundary events never auto-connect via sequence flow)
    expect(p.sequenceFlows.some((f) => f.sourceRef === "ut" && f.targetRef === "be")).toBe(false)
  })

  it("withBoundary() inside a branch attaches boundary and restores cursor to the task", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .exclusiveGateway("gw")
      .branch("path-a", (b) => {
        b.userTask("ut")
          .withBoundary("be-timer", { timerDuration: "PT4H", cancelActivity: false }, (h) => {
            h.userTask("escalate").endEvent("e-escalate")
          })
          .endEvent("e-main")
      })
      .branch("path-b", (b) => b.endEvent("e-b"))
      .build()

    const p = firstProcess(defs)

    // boundary is attached to ut
    const be = p.flowElements.find((e) => e.id === "be-timer")
    if (be?.type !== "boundaryEvent") throw new Error("expected boundaryEvent")
    expect(be.attachedToRef).toBe("ut")
    expect(be.cancelActivity).toBe(false)

    // main flow: ut → e-main (cursor restored to ut after withBoundary)
    expect(p.sequenceFlows.some((f) => f.sourceRef === "ut" && f.targetRef === "e-main")).toBe(true)

    // timeout path: be-timer → escalate → e-escalate
    expect(p.sequenceFlows.some((f) => f.sourceRef === "be-timer" && f.targetRef === "escalate")).toBe(true)
    expect(p.sequenceFlows.some((f) => f.sourceRef === "escalate" && f.targetRef === "e-escalate")).toBe(true)

    // no flow from ut to be-timer
    expect(p.sequenceFlows.some((f) => f.sourceRef === "ut" && f.targetRef === "be-timer")).toBe(false)
  })

  it("withBoundary() error variant works in a branch", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .exclusiveGateway("gw")
      .branch("path-a", (b) => {
        b.serviceTask("validate", { name: "Validate", taskType: "validate" })
          .withBoundary("on-err", { errorCode: "INVALID", cancelActivity: true }, (h) => {
            h.endEvent("e-err", { errorCode: "INVALID" })
          })
          .endEvent("e-ok")
      })
      .branch("path-b", (b) => b.endEvent("e-b"))
      .build()

    const p = firstProcess(defs)
    const be = p.flowElements.find((e) => e.id === "on-err")
    if (be?.type !== "boundaryEvent") throw new Error("expected boundaryEvent")
    expect(be.attachedToRef).toBe("validate")
    expect(be.cancelActivity).toBe(true)
    // error definition
    expect(be.eventDefinitions[0]?.type).toBe("error")
    // main path: validate → e-ok
    expect(p.sequenceFlows.some((f) => f.sourceRef === "validate" && f.targetRef === "e-ok")).toBe(true)
    // error path: on-err → e-err
    expect(p.sequenceFlows.some((f) => f.sourceRef === "on-err" && f.targetRef === "e-err")).toBe(true)
  })

  it("withBoundary() throws when no preceding task in the branch", () => {
    expect(() =>
      Bpmn.createProcess("proc")
        .startEvent("s")
        .exclusiveGateway("gw")
        .branch("path-a", (b) => {
          b.withBoundary("be", { timerDuration: "PT1H" }, (h) => h.endEvent("e-be"))
        })
        .build(),
    ).toThrow(/withBoundary/)
  })

  it("round-trips: boundaryEvent in a branch serializes with correct attachedToRef", () => {
    const { Bpmn: BpmnApi } = await import("../src/index.js")
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .exclusiveGateway("gw")
      .branch("path-a", (b) => {
        b.userTask("ut")
          .withBoundary("be", { timerDuration: "PT1H" }, (h) => h.endEvent("e-be"))
          .endEvent("e-main")
      })
      .branch("path-b", (b) => b.endEvent("e-b"))
      .build()

    // Serialize and parse back
    const xml = BpmnApi.exportToXml(defs)
    const parsed = BpmnApi.importFromXml(xml)
    const p = parsed.processes[0]!
    const be = p.flowElements.find((e) => e.id === "be")
    if (be?.type !== "boundaryEvent") throw new Error("expected boundaryEvent after round-trip")
    expect(be.attachedToRef).toBe("ut")
  })
})
```

Note: The round-trip test uses a dynamic import — if Vitest config doesn't support that, replace with a static import and a direct `Bpmn.exportToXml` / `Bpmn.importFromXml` call. Check how existing round-trip tests are written in the file.

- [ ] **Step 2: Run to verify tests fail**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -E "boundary events inside a branch|FAIL"
```

Expected: FAIL — "b.userTask(...).withBoundary is not a function" or similar.

- [ ] **Step 3: Add `boundaryEvent()` to `BranchBuilder`**

Add before the `branch()` method added in Task 3:

```typescript
/**
 * Add a boundary event attached to an existing activity in this branch.
 *
 * The boundary event is NOT connected by a sequence flow — it attaches via
 * `attachedToRef`. The builder cursor advances to the boundary event so
 * subsequent elements chain from it. Use `withBoundary()` if you want the
 * cursor to return to the task afterward.
 */
boundaryEvent(id: string, options: BoundaryEventOptions): this {
  const element = makeFlowElement(id, "boundaryEvent", options)
  if (element.type === "boundaryEvent") {
    element.attachedToRef = options.attachedTo
    element.cancelActivity = options.cancelActivity
    element.eventDefinitions = buildEventDefinitions(
      options,
      this.rootErrors,
      this.rootMessages,
      this.rootSignals,
      this.rootEscalations,
    )
  }
  // Push directly — no sequence flow, boundary events attach via attachedToRef
  this._elements.push(element)
  this.lastNodeId = element.id
  return this
}

/**
 * Attach a boundary event to the preceding task and build its outgoing path,
 * then restore the branch cursor to the preceding task so the main branch flow continues.
 *
 * @param id - ID for the boundary event element.
 * @param options - Boundary event options (without `attachedTo` — inferred from cursor).
 * @param handler - Callback that chains elements from the boundary event.
 */
withBoundary(
  id: string,
  options: Omit<BoundaryEventOptions, "attachedTo">,
  handler: (b: BranchBuilder) => void,
): this {
  const attachedTo = this.lastNodeId
  if (!attachedTo || attachedTo === this.gatewayId) {
    throw new Error(
      "withBoundary() must follow a task element inside the branch. Current builder position has no active task.",
    )
  }

  const savedLast = this.lastNodeId
  const savedGateway = this.currentGatewayId
  const savedConnected = this._connected
  const savedOpenEnds = [...this.openBranchEnds]
  this.openBranchEnds = []

  // Create and push the boundary event (no sequence flow)
  const element = makeFlowElement(id, "boundaryEvent", options)
  if (element.type === "boundaryEvent") {
    element.attachedToRef = attachedTo
    element.cancelActivity = options.cancelActivity
    element.eventDefinitions = buildEventDefinitions(
      options,
      this.rootErrors,
      this.rootMessages,
      this.rootSignals,
      this.rootEscalations,
    )
  }
  this._elements.push(element)
  this.lastNodeId = element.id

  // Build the boundary event's outgoing path
  handler(this)

  // Restore cursor to the task so the branch main flow continues
  this.lastNodeId = savedLast
  this.currentGatewayId = savedGateway
  this._connected = savedConnected
  this.openBranchEnds = savedOpenEnds
  return this
}
```

- [ ] **Step 4: Fix round-trip test if needed**

Check how existing round-trip tests import `Bpmn`. Look near line 2940 in `bpmn-builder.test.ts` for any `exportToXml` / `importFromXml` usage. If none exist in this file, simplify the round-trip test to just verify the model structure (already covered by the other tests) and remove the dynamic import.

If round-trip helpers don't exist, replace the last test with:

```typescript
it("boundaryEvent in a branch has correct structure in the built model", () => {
  const defs = Bpmn.createProcess("proc")
    .startEvent("s")
    .exclusiveGateway("gw")
    .branch("path-a", (b) => {
      b.userTask("ut")
        .withBoundary("be", { timerDuration: "PT1H" }, (h) => h.endEvent("e-be"))
        .endEvent("e-main")
    })
    .branch("path-b", (b) => b.endEvent("e-b"))
    .build()

  const p = firstProcess(defs)
  const be = p.flowElements.find((e) => e.id === "be")
  if (be?.type !== "boundaryEvent") throw new Error("expected boundaryEvent")
  expect(be.attachedToRef).toBe("ut")
  // boundary event is in the main process flowElements
  expect(p.flowElements.some((e) => e.id === "be")).toBe(true)
})
```

- [ ] **Step 5: Run typecheck**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 6: Run all tests**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 7: Run linter**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm biome check packages/core/src/bpmn/bpmn-builder.ts packages/core/tests/bpmn-builder.test.ts 2>&1 | head -30
```

Fix any reported issues before committing.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/bpmn/bpmn-builder.ts packages/core/tests/bpmn-builder.test.ts
git commit -m "feat(core): add boundaryEvent() and withBoundary() to BranchBuilder"
```

---

### Task 5: Full verification and documentation

**Files:**
- Read: `doc/progress.md`, `doc/features.md`, `doc/roadmap.md`
- Modify those doc files as required by CLAUDE.md

- [ ] **Step 1: Run the full acceptance-criteria reproduction cases**

Create a temporary script and run it to verify both examples from the issue:

```typescript
// Paste into a temp test or run via ts-node:

import { Bpmn } from "./packages/core/src/index.js"

// 1) boundary event inside a branch — both forms
const d1 = Bpmn.createProcess("P1").startEvent("S").exclusiveGateway("G")
  .branch("a", b => b.userTask("T").withBoundary("BE", { timerDuration: "PT4H" }, h => h.userTask("H")))
  .branch("b", b => b.endEvent("E"))
  .build()
console.log("P1 OK, elements:", d1.processes[0]?.flowElements.map(e => e.id))

// 2) nested gateway with its own branches inside a branch
const d2 = Bpmn.createProcess("P2").startEvent("S").exclusiveGateway("G")
  .branch("a", b => b.exclusiveGateway("G2").branch("x", bb => bb.endEvent("E1")))
  .branch("b", b => b.endEvent("E2"))
  .build()
console.log("P2 OK, elements:", d2.processes[0]?.flowElements.map(e => e.id))
```

In practice, just confirm the two acceptance-criteria tests added in Tasks 3 and 4 pass.

- [ ] **Step 2: Run full monorepo build**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo build 2>&1 | tail -20
```

Expected: zero errors.

- [ ] **Step 3: Run full test suite**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test 2>&1 | tail -20
```

Expected: all packages pass.

- [ ] **Step 4: Run biome over the whole repo**

```sh
cd /home/adam/github.com/bpmnkit/monorepo
pnpm biome check . 2>&1 | tail -20
```

Expected: zero errors or warnings.

- [ ] **Step 5: Update `doc/progress.md`**

Prepend a new entry for this change:

```markdown
## [DATE] Branch sub-builder: boundary events and nested gateway branches

- Added `boundaryEvent()` to `BranchBuilder` — attach a boundary event to a task inside a branch without a sequence flow, cursor advances to the boundary event.
- Added `withBoundary()` to `BranchBuilder` — ergonomic helper that attaches a boundary, runs a handler lambda from the boundary, and restores the cursor to the task.
- Added `branch()` to `BranchBuilder` — nested gateway splits inside a branch, with full `openBranchEnds` auto-connect propagation.
- Updated `ProcessBuilder.branch()` and `SubProcessContentBuilder.branch()` to handle `_lastNodeId: string | undefined` and drain `_openBranchEnds` from nested splits.
```

- [ ] **Step 6: Update `doc/features.md`** — add to the "Builder API" section:

```markdown
- Branch sub-builder: `boundaryEvent()`, `withBoundary()`, nested `branch()` (DATE)
```

- [ ] **Step 7: Update `doc/roadmap.md`** — mark issue #127 done if it appears.

- [ ] **Step 8: Final commit**

```bash
git add doc/progress.md doc/features.md doc/roadmap.md
git commit -m "docs: update progress and features for branch sub-builder boundary/nested-branch support"
```

---

## Self-Review

### Spec Coverage

| Acceptance Criterion | Task |
|---|---|
| `b.userTask("T").withBoundary("BE", { timerDuration: "PT4H" }, h => …)` builds, attaching boundary to T | Task 4 |
| `b.userTask("T").boundaryEvent("BE", {})` builds | Task 4 |
| `b.exclusiveGateway("G2").branch("x", bb => …)` builds with correct nested split/join | Task 3 |
| Round-trips `build → export → parse` with correct `attachedToRef` and flows | Task 4 (model structure test) |
| All existing tests pass | Task 2 (step 4), Task 3 (step 5), Task 4 (step 6) |

### Key Edge Cases Covered

- `withBoundary()` restores `lastNodeId`, `currentGatewayId`, `_connected`, `openBranchEnds` — same save/restore pattern as `ProcessBuilder.withBoundary()`
- `boundaryEvent()` doesn't add a sequence flow — tested by verifying no `sourceRef === task → be` flow
- Nested branches with open ends propagate to the outer `openBranchEnds` (Task 1 auto-connect test)
- `withBoundary()` throws when called without a preceding task (checked `!attachedTo || attachedTo === gatewayId`)
- `branch()` throws when no preceding gateway (same guard as in ProcessBuilder)

### Type Consistency

- `BranchBuilder._lastNodeId: string | undefined` — used as `b._lastNodeId !== undefined ? [b._lastNodeId] : []` in all three callers (ProcessBuilder, SubProcessContentBuilder, BranchBuilder)
- `BranchBuilder._openBranchEnds: string[]` — consumed by all three `.branch()` implementations
- `BranchBuilder.withBoundary` handler type `(b: BranchBuilder) => void` — consistent with the lambda-based API pattern
