# Fix Event Sub-Process Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three structural defects in `ProcessBuilder.eventSubProcess()` so it emits canonical, interoperable BPMN accepted by bpmn-moddle and the Camunda toolchain.

**Architecture:** Three independent defects — wrong XML element tag, no `isInterrupting` option on the inner start event, and illegal auto-wired sequence flows — are fixed by routing the builder through the existing `subProcess` model type (with `triggeredByEvent: true`), skipping the normal `addFlowElement` flow-wiring path, and threading `isInterrupting` through model → builder option → serializer.

**Tech Stack:** TypeScript (strict), Vitest, Biome (lint/format)

## Global Constraints

- Zero TypeScript errors across the monorepo after each task.
- Zero Biome warnings/errors after each task.
- All existing tests pass after each task.
- Run `pnpm turbo test` to verify tests; `pnpm biome check .` to verify lint/format.
- Do **not** remove or alias `BpmnEventSubProcess` from the model — it is still needed by the parser for backward-compatible round-tripping of existing XML that contains `<bpmn:eventSubProcess>`.
- The `eventSubProcess` case in `bpmn-serializer.ts` must also stay — for the same reason.
- The `isBpmnEventSubProcess()` type guard in `type-guards.ts` is not touched.

---

## File Map

| File | Change |
|------|--------|
| `packages/core/src/bpmn/bpmn-model.ts:189-192` | Add `isInterrupting?: boolean` to `BpmnStartEvent` |
| `packages/core/src/bpmn/bpmn-serializer.ts:210-215` | Emit `isInterrupting="false"` in `startEvent` case |
| `packages/core/src/bpmn/bpmn-parser.ts:317-321` | Parse `isInterrupting` attribute in `startEvent` case |
| `packages/core/src/bpmn/bpmn-builder.ts:42-60` | Add `isInterrupting?: boolean` to `StartEventOptions` |
| `packages/core/src/bpmn/bpmn-builder.ts:1029-1032` | Set `element.isInterrupting` in `SubProcessContentBuilder.startEvent()` |
| `packages/core/src/bpmn/bpmn-builder.ts:1284-1318` | Set `element.isInterrupting` in `ProcessBuilder.startEvent()` |
| `packages/core/src/bpmn/bpmn-builder.ts:1787-1805` | Rewrite `eventSubProcess()`: use `subProcess` type, set `triggeredByEvent: true`, no flow wiring, no lastNodeId update |
| `packages/core/tests/bpmn-builder.test.ts:790-818` | Update existing "creates an event sub-process" test |
| `packages/core/tests/bpmn-builder.test.ts` | Add new tests: XML output assertions, `isInterrupting` |
| `doc/progress.md` | Add changelog entry |

---

### Task 1: Fix the element tag and illegal flows

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:1787-1805`
- Test: `packages/core/tests/bpmn-builder.test.ts:790-818`

**Interfaces:**
- Produces: `eventSubProcess()` returns a `BpmnSubProcess` (type `"subProcess"`) with `triggeredByEvent: true`, no incoming/outgoing sequence flows, `lastNodeId` unchanged from before the call.

- [ ] **Step 1: Write failing tests**

Replace the entire "event sub-process (aspirational)" describe block in `packages/core/tests/bpmn-builder.test.ts` (lines 786-818) with:

```ts
// -----------------------------------------------------------------------
// Event sub-process
// -----------------------------------------------------------------------

describe("event sub-process", () => {
  it("creates a subProcess with triggeredByEvent=true", () => {
    const process = firstProcess(
      Bpmn.createProcess("proc")
        .startEvent("s")
        .eventSubProcess(
          "evtsub1",
          (sub) => {
            sub
              .startEvent("err-start", { name: "Error Start" })
              .serviceTask("handle-err", { taskType: "error-handler" })
              .endEvent("err-end")
          },
          { name: "Error Handler" },
        )
        .endEvent("e")
        .build(),
    )

    const evtSub = defined(process.flowElements.find((n) => n.id === "evtsub1"))
    // (a) correct element type
    expect(evtSub.type).toBe("subProcess")
    expect(evtSub.name).toBe("Error Handler")

    if (evtSub.type === "subProcess") {
      // (a) canonical attribute
      expect(evtSub.triggeredByEvent).toBe(true)
      // internal flows preserved
      expect(evtSub.flowElements).toHaveLength(3)
      expect(evtSub.sequenceFlows).toHaveLength(2)
    }

    // (c) no illegal incoming/outgoing on the sub-process
    expect(evtSub.incoming).toHaveLength(0)
    expect(evtSub.outgoing).toHaveLength(0)

    // (c) no sequence flow references evtsub1 as source or target
    expect(
      process.sequenceFlows.every(
        (f) => f.sourceRef !== "evtsub1" && f.targetRef !== "evtsub1",
      ),
    ).toBe(true)

    // cursor advances past event sub-process as if it wasn't there: s → e
    const sToE = process.sequenceFlows.find(
      (f) => f.sourceRef === "s" && f.targetRef === "e",
    )
    expect(sToE).toBeDefined()
  })

  it("emits <bpmn:subProcess triggeredByEvent='true'> in XML — no <bpmn:eventSubProcess>", () => {
    const xml = Bpmn.export(
      Bpmn.createProcess("proc")
        .startEvent("s")
        .eventSubProcess("esp", (sub) => {
          sub.startEvent("t-start", { timerDuration: "PT1H" }).endEvent("t-end")
        })
        .endEvent("e")
        .build(),
    )

    // (a) canonical tag
    expect(xml).toContain('triggeredByEvent="true"')
    expect(xml).not.toContain("<bpmn:eventSubProcess")

    // (c) no flows to/from esp
    expect(xml).not.toContain('sourceRef="esp"')
    expect(xml).not.toContain('targetRef="esp"')

    // (c) no incoming/outgoing on sub-process
    // (the serializer emits incoming/outgoing only when the arrays are non-empty)
    // We verify by checking the flow count: s→e = 1 flow at process level
    const flowMatches = [...xml.matchAll(/<bpmn:sequenceFlow /g)]
    // internal: t-start→t-end = 1; process level: s→e = 1; total = 2
    expect(flowMatches).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -A5 "event sub-process"
```

Expected: The two new tests FAIL (type is "eventSubProcess" not "subProcess", and XML contains `<bpmn:eventSubProcess>`).

- [ ] **Step 3: Fix `eventSubProcess()` in the builder**

In `packages/core/src/bpmn/bpmn-builder.ts`, replace the `eventSubProcess` method (lines 1786-1806):

**Old:**
```ts
/** Add an event sub-process (aspirational). */
eventSubProcess(
  id: string,
  content: (b: SubProcessContentBuilder) => void,
  options?: ElementOptions,
): this {
  const sub = new SubProcessContentBuilder()
  content(sub)
  insertJoinGateways(sub._elements, sub._flows)
  recomputeIncomingOutgoing(sub._elements, sub._flows)

  const element = makeFlowElement(id, "eventSubProcess", options)
  if (element.type === "eventSubProcess") {
    element.flowElements = sub._elements
    element.sequenceFlows = sub._flows
    element.textAnnotations = sub._textAnnotations
    element.associations = sub._associations
  }
  this.addFlowElement(element)
  return this
}
```

**New:**
```ts
/** Add an event sub-process. Triggered by its start event — no incoming or outgoing sequence flows. */
eventSubProcess(
  id: string,
  content: (b: SubProcessContentBuilder) => void,
  options?: ElementOptions,
): this {
  const sub = new SubProcessContentBuilder()
  content(sub)
  insertJoinGateways(sub._elements, sub._flows)
  recomputeIncomingOutgoing(sub._elements, sub._flows)

  const element = makeFlowElement(id, "subProcess", options)
  if (element.type === "subProcess") {
    element.triggeredByEvent = true
    element.flowElements = sub._elements
    element.sequenceFlows = sub._flows
    element.textAnnotations = sub._textAnnotations
    element.associations = sub._associations
  }

  // Event sub-processes have no incoming/outgoing sequence flows and must not
  // advance the flow cursor — the surrounding process wires around them.
  if (this.flowElements.some((n) => n.id === element.id)) {
    throw new Error(`Duplicate element ID "${element.id}" in process "${this.processId}"`)
  }
  this.flowElements.push(element)
  return this
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -A3 "event sub-process"
```

Expected: Both new tests PASS.

- [ ] **Step 5: Run full test suite and lint**

```bash
pnpm turbo test
pnpm biome check .
```

Expected: All tests pass, zero lint errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/bpmn/bpmn-builder.ts packages/core/tests/bpmn-builder.test.ts
git commit -m "fix(core): eventSubProcess() emits canonical subProcess with triggeredByEvent=true, no illegal flows"
```

---

### Task 2: Add `isInterrupting` support to start events

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-model.ts:189-192`
- Modify: `packages/core/src/bpmn/bpmn-serializer.ts:210-215`
- Modify: `packages/core/src/bpmn/bpmn-parser.ts:317-321`
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:42-60,1029-1032,1284-1318`
- Test: `packages/core/tests/bpmn-builder.test.ts`

**Interfaces:**
- Consumes: `StartEventOptions.isInterrupting?: boolean` (new field)
- Produces: When `isInterrupting: false` is passed, the serialized XML contains `isInterrupting="false"` on the start event. When omitted or `true`, no attribute is emitted.

- [ ] **Step 1: Write failing tests**

Add the following tests inside the `"event sub-process"` describe block, after the two existing tests from Task 1:

```ts
it("emits isInterrupting='false' on non-interrupting start event", () => {
  const xml = Bpmn.export(
    Bpmn.createProcess("proc")
      .eventSubProcess("esp", (sub) => {
        sub
          .startEvent("t-start", { timerDuration: "PT1H", isInterrupting: false })
          .endEvent("t-end")
      })
      .build(),
  )

  expect(xml).toContain('isInterrupting="false"')
})

it("omits isInterrupting attribute for interrupting (default) start event", () => {
  const xml = Bpmn.export(
    Bpmn.createProcess("proc")
      .eventSubProcess("esp", (sub) => {
        sub.startEvent("t-start", { timerDuration: "PT1H" }).endEvent("t-end")
      })
      .build(),
  )

  expect(xml).not.toContain("isInterrupting")
})
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -A3 "isInterrupting"
```

Expected: Both tests FAIL (no `isInterrupting` attribute emitted yet).

- [ ] **Step 3: Add `isInterrupting` to the model**

In `packages/core/src/bpmn/bpmn-model.ts`, update `BpmnStartEvent` (lines 189-192):

**Old:**
```ts
export interface BpmnStartEvent extends BpmnFlowNodeBase {
  type: "startEvent"
  eventDefinitions: BpmnEventDefinition[]
}
```

**New:**
```ts
export interface BpmnStartEvent extends BpmnFlowNodeBase {
  type: "startEvent"
  eventDefinitions: BpmnEventDefinition[]
  isInterrupting?: boolean
}
```

- [ ] **Step 4: Add `isInterrupting` to `StartEventOptions` in the builder**

In `packages/core/src/bpmn/bpmn-builder.ts`, update `StartEventOptions` (lines 43-60):

**Old:**
```ts
/** Options for creating a start event. */
export interface StartEventOptions extends ElementOptions {
  /** Timer duration (ISO 8601) — creates a timer start event. */
  timerDuration?: string
  /** Timer date (ISO 8601) — creates a timer start event. */
  timerDate?: string
  /** Timer cycle (ISO 8601) — creates a timer start event. */
  timerCycle?: string
  /** Message name — creates a message start event. */
  messageName?: string
  /** Zeebe properties (e.g. webhook connector config). */
  zeebeProperties?: Array<{ name: string; value: string }>
  /** Zeebe modeler template ID. */
  modelerTemplate?: string
  /** Zeebe modeler template version. */
  modelerTemplateVersion?: string
  /** Zeebe modeler template icon (data URI). */
  modelerTemplateIcon?: string
}
```

**New:**
```ts
/** Options for creating a start event. */
export interface StartEventOptions extends ElementOptions {
  /** Timer duration (ISO 8601) — creates a timer start event. */
  timerDuration?: string
  /** Timer date (ISO 8601) — creates a timer start event. */
  timerDate?: string
  /** Timer cycle (ISO 8601) — creates a timer start event. */
  timerCycle?: string
  /** Message name — creates a message start event. */
  messageName?: string
  /** Zeebe properties (e.g. webhook connector config). */
  zeebeProperties?: Array<{ name: string; value: string }>
  /** Zeebe modeler template ID. */
  modelerTemplate?: string
  /** Zeebe modeler template version. */
  modelerTemplateVersion?: string
  /** Zeebe modeler template icon (data URI). */
  modelerTemplateIcon?: string
  /**
   * Non-interrupting flag — only meaningful for start events inside event sub-processes.
   * Pass `false` to emit `isInterrupting="false"`. Omit for the default interrupting behavior.
   */
  isInterrupting?: boolean
}
```

- [ ] **Step 5: Apply `isInterrupting` in `SubProcessContentBuilder.startEvent()` (line 1029)**

In `packages/core/src/bpmn/bpmn-builder.ts`, update `SubProcessContentBuilder.startEvent()`:

**Old:**
```ts
startEvent(id?: string, options?: StartEventOptions): this {
  const el = makeFlowElement(id ?? generateId("StartEvent"), "startEvent", options)
  if (el.type === "startEvent" && options) el.eventDefinitions = buildEventDefinitions(options)
  return this.addElement(el)
}
```

**New:**
```ts
startEvent(id?: string, options?: StartEventOptions): this {
  const el = makeFlowElement(id ?? generateId("StartEvent"), "startEvent", options)
  if (el.type === "startEvent" && options) {
    el.eventDefinitions = buildEventDefinitions(options)
    if (options.isInterrupting === false) el.isInterrupting = false
  }
  return this.addElement(el)
}
```

- [ ] **Step 6: Apply `isInterrupting` in `ProcessBuilder.startEvent()` (line 1298)**

In `packages/core/src/bpmn/bpmn-builder.ts`, inside `ProcessBuilder.startEvent()`, find the block starting at line 1298:

**Old:**
```ts
if (element.type === "startEvent" && options) {
  element.eventDefinitions = buildEventDefinitions(
    options,
    this.rootErrors,
    this.rootMessages,
    this.rootSignals,
    this.rootEscalations,
  )
}
```

**New:**
```ts
if (element.type === "startEvent" && options) {
  element.eventDefinitions = buildEventDefinitions(
    options,
    this.rootErrors,
    this.rootMessages,
    this.rootSignals,
    this.rootEscalations,
  )
  if (options.isInterrupting === false) element.isInterrupting = false
}
```

- [ ] **Step 7: Update the serializer to emit `isInterrupting`**

In `packages/core/src/bpmn/bpmn-serializer.ts`, split the `startEvent` case to handle `isInterrupting`. The current code at lines 210-215 is:

```ts
switch (fe.type) {
  case "startEvent":
  case "endEvent":
  case "intermediateCatchEvent":
  case "intermediateThrowEvent":
    children.push(...serializeEventDefinitions(fe.eventDefinitions, bp))
    break
```

**New** (split `startEvent` out of the fall-through):
```ts
switch (fe.type) {
  case "startEvent":
    if (fe.isInterrupting === false) attrs.isInterrupting = "false"
    children.push(...serializeEventDefinitions(fe.eventDefinitions, bp))
    break

  case "endEvent":
  case "intermediateCatchEvent":
  case "intermediateThrowEvent":
    children.push(...serializeEventDefinitions(fe.eventDefinitions, bp))
    break
```

- [ ] **Step 8: Update the parser to parse `isInterrupting`**

In `packages/core/src/bpmn/bpmn-parser.ts`, split `startEvent` from the fall-through at lines 317-321.

**Old:**
```ts
case "startEvent":
case "endEvent":
case "intermediateCatchEvent":
case "intermediateThrowEvent":
  return { ...base, type: ln, eventDefinitions: parseEventDefinitions(element) }
```

**New:**
```ts
case "startEvent": {
  const isInterruptingAttr = attr(element, "isInterrupting")
  return {
    ...base,
    type: "startEvent",
    eventDefinitions: parseEventDefinitions(element),
    ...(isInterruptingAttr === "false" ? { isInterrupting: false } : {}),
  }
}

case "endEvent":
case "intermediateCatchEvent":
case "intermediateThrowEvent":
  return { ...base, type: ln, eventDefinitions: parseEventDefinitions(element) }
```

Note: `attr` is already imported/available in the parser module.

- [ ] **Step 9: Run tests and verify they pass**

```bash
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -A3 "isInterrupting"
```

Expected: Both `isInterrupting` tests PASS.

- [ ] **Step 10: Run full suite and lint**

```bash
pnpm turbo test
pnpm biome check .
```

Expected: All tests pass, zero lint errors.

- [ ] **Step 11: Commit**

```bash
git add packages/core/src/bpmn/bpmn-model.ts \
        packages/core/src/bpmn/bpmn-builder.ts \
        packages/core/src/bpmn/bpmn-serializer.ts \
        packages/core/src/bpmn/bpmn-parser.ts \
        packages/core/tests/bpmn-builder.test.ts
git commit -m "feat(core): add isInterrupting option to startEvent for non-interrupting event sub-processes"
```

---

### Task 3: Update documentation

**Files:**
- Modify: `doc/progress.md`
- Modify: `doc/features.md` (line 1101 — update the eventSubProcess entry)

**Interfaces:**
- Consumes: completed Tasks 1 and 2

- [ ] **Step 1: Prepend a changelog entry to `doc/progress.md`**

Add at the very top of `doc/progress.md` (before any existing entries):

```markdown
## 2026-06-28 — Fix eventSubProcess() canonical BPMN output (issue #116)

**Defects fixed:**

- **(a) Wrong element tag** — `eventSubProcess()` now emits `<bpmn:subProcess triggeredByEvent="true">` instead of the non-standard `<bpmn:eventSubProcess>`, making it interoperable with bpmn-moddle and the Camunda toolchain.
- **(b) Missing isInterrupting option** — `StartEventOptions` now includes `isInterrupting?: boolean`. Pass `false` to emit `isInterrupting="false"` on the start event (non-interrupting trigger). Omit for the default interrupting behavior (no attribute emitted).
- **(c) Illegal sequence flows** — The event sub-process is no longer auto-wired with incoming/outgoing sequence flows. The surrounding process flow cursor is unchanged, so the next element connects from the element preceding the event sub-process.
```

- [ ] **Step 2: Update `doc/features.md` line 1101**

Find the line:
```
- **Sub-process builders** — `adHocSubProcess()`, `subProcess()`, `eventSubProcess()` with nested content
```

Replace with:
```
- **Sub-process builders** — `adHocSubProcess()`, `subProcess()`, `eventSubProcess()` with nested content; `eventSubProcess()` emits canonical `<bpmn:subProcess triggeredByEvent="true">` with no illegal sequence flows; start events inside event sub-processes accept `isInterrupting: false` for non-interrupting triggers
```

- [ ] **Step 3: Commit**

```bash
git add doc/progress.md doc/features.md
git commit -m "docs: update progress and features for eventSubProcess fix"
```

---

## Acceptance Criteria Checklist

Verify these manually after all tasks complete by running the reproduction script from the issue:

- [ ] `eventSubProcess()` emits `<bpmn:subProcess triggeredByEvent="true">`; no `<bpmn:eventSubProcess>` tag.
- [ ] Round-trip through `bpmn-moddle.fromXML()` produces **zero warnings**; the parsed process contains a `bpmn:SubProcess` with `triggeredByEvent === true`.
- [ ] The exported sub-process has no `<bpmn:incoming>` and no `<bpmn:outgoing>` children.
- [ ] Zero `<bpmn:sequenceFlow>` with `sourceRef` or `targetRef` equal to the event sub-process id.
- [ ] For the reproduction process, the only process-level flow spanning the sub-process is `Review → End`.
- [ ] `startEvent(..., { isInterrupting: false })` inside an event sub-process emits `isInterrupting="false"`.
- [ ] Omitting `isInterrupting` emits **no** `isInterrupting` attribute.
- [ ] Internal sequence flows inside the event sub-process are preserved.
