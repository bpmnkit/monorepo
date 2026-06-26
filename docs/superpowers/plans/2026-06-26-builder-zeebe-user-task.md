# Builder: Emit `zeebe:userTask` Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `zeebeUserTask` option to the fluent builder's `.userTask()` so it can emit `<zeebe:userTask />` inside `<bpmn:extensionElements>`, marking the task as a Camunda 8 native user task.

**Architecture:** Add the `zeebeUserTask` boolean flag to `UserTaskOptions` and a corresponding `userTask?: true` marker to `ZeebeExtensions`. Wire it through `zeebeExtensionsToXmlElements()` which already handles all other extension serialization. Update `makeUserTaskEl()` to pass the flag when set. Three builder classes all delegate to `makeUserTaskEl()`, so one function change covers all three.

**Tech Stack:** TypeScript strict mode, Vitest, pnpm monorepo, Biome linting/formatting.

## Global Constraints

- Zero TypeScript errors after changes.
- Zero Biome warnings or errors after changes.
- All existing tests must continue to pass.
- New tests must be deterministic — no timing or order dependencies.
- Touch only what the task requires — no adjacent cleanup.
- `<zeebe:userTask />` is a self-closing marker element: `{ name: "zeebe:userTask", attributes: {}, children: [] }`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/core/src/bpmn/zeebe-extensions.ts` | Modify | Add `userTask?: true` to `ZeebeExtensions`; emit it in `zeebeExtensionsToXmlElements()` |
| `packages/core/src/bpmn/bpmn-builder.ts` | Modify | Add `zeebeUserTask?: boolean` to `UserTaskOptions`; pass it in `makeUserTaskEl()` |
| `packages/core/tests/bpmn-builder.test.ts` | Modify | Add regression tests for the new option |

---

### Task 1: Add `userTask` marker to `ZeebeExtensions` and serialize it

**Files:**
- Modify: `packages/core/src/bpmn/zeebe-extensions.ts:68-80` (interface) and `:149-164` (serialization)

**Interfaces:**
- Produces: `ZeebeExtensions.userTask?: true` — consumed by Task 2's call to `zeebeExtensionsToXmlElements()`

- [ ] **Step 1: Write the failing test**

In `packages/core/tests/bpmn-builder.test.ts`, find the `"creates a user task with form reference"` test (~line 148) and add a new test directly after it:

```typescript
it("creates a zeebe user task with zeebeUserTask flag", () => {
  const process = firstProcess(
    Bpmn.createProcess("proc").userTask("ut2", { name: "Review", zeebeUserTask: true }).build(),
  )

  const el = defined(process.flowElements.find((n) => n.id === "ut2"))
  expect(el.type).toBe("userTask")
  const zeebeUserTaskEl = el.extensionElements.find((e) => e.name === "zeebe:userTask")
  expect(zeebeUserTaskEl).toBeDefined()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -A5 "zeebe user task"
```

Expected: FAIL — TypeScript compile error or test not found (since `zeebeUserTask` doesn't exist on `UserTaskOptions` yet).

- [ ] **Step 3: Add `userTask` to `ZeebeExtensions` interface**

In `packages/core/src/bpmn/zeebe-extensions.ts`, in the `ZeebeExtensions` interface (lines 68-80), add after the `calledDecision` line:

```typescript
/** Marks this as a Camunda 8 native user task (zeebe:userTask). */
userTask?: true
```

So the interface becomes:
```typescript
export interface ZeebeExtensions {
  taskDefinition?: ZeebeTaskDefinition
  ioMapping?: ZeebeIoMapping
  taskHeaders?: ZeebeTaskHeaders
  properties?: ZeebeProperties
  adHoc?: ZeebeAdHoc
  /** Camunda Form linked to a user task (zeebe:formDefinition). */
  formDefinition?: ZeebeFormDefinition
  /** DMN decision invoked by a business rule task (zeebe:calledDecision). */
  calledDecision?: ZeebeCalledDecision
  /** Marks this as a Camunda 8 native user task (zeebe:userTask). */
  userTask?: true
  /** Unrecognized extension elements preserved for roundtrip. */
  unknownElements?: XmlElement[]
}
```

- [ ] **Step 4: Emit `zeebe:userTask` in `zeebeExtensionsToXmlElements()`**

In `packages/core/src/bpmn/zeebe-extensions.ts`, in the `zeebeExtensionsToXmlElements()` function, add the new block **before** the `formDefinition` block (before line 158). Place it after the `adHoc` block:

```typescript
if (extensions.userTask) {
  elements.push({ name: "zeebe:userTask", attributes: {}, children: [] })
}
```

The relevant section in `zeebeExtensionsToXmlElements()` should look like:

```typescript
  if (extensions.adHoc) {
    const attrs: Record<string, string> = {}
    const { outputCollection, outputElement, activeElementsCollection } = extensions.adHoc
    if (outputCollection) attrs.outputCollection = outputCollection
    if (outputElement) attrs.outputElement = outputElement
    if (activeElementsCollection) attrs.activeElementsCollection = activeElementsCollection
    elements.push({ name: "zeebe:adHoc", attributes: attrs, children: [] })
  }

  if (extensions.userTask) {
    elements.push({ name: "zeebe:userTask", attributes: {}, children: [] })
  }

  if (extensions.formDefinition) {
    elements.push({
      name: "zeebe:formDefinition",
      attributes: { formId: extensions.formDefinition.formId },
      children: [],
    })
  }
```

- [ ] **Step 5: Add `zeebeUserTask` to `UserTaskOptions` in `bpmn-builder.ts`**

In `packages/core/src/bpmn/bpmn-builder.ts`, in the `UserTaskOptions` interface (lines 95-101), add:

```typescript
export interface UserTaskOptions {
  /** Display name. */
  name?: string
  /** Form key or form reference. */
  formId?: string
  /** Emit <zeebe:userTask /> to mark as a Camunda 8 native user task. */
  zeebeUserTask?: boolean
}
```

- [ ] **Step 6: Update `makeUserTaskEl()` to pass the flag**

In `packages/core/src/bpmn/bpmn-builder.ts`, replace `makeUserTaskEl()` (lines 526-531):

```typescript
function makeUserTaskEl(id: string, options?: UserTaskOptions): BpmnFlowElement {
  const ext = zeebeExtensionsToXmlElements({
    ...(options?.zeebeUserTask ? { userTask: true } : {}),
    ...(options?.formId ? { formDefinition: { formId: options.formId } } : {}),
  })
  return makeFlowElement(id, "userTask", { name: options?.name, extensionElements: ext })
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|zeebe user task|form reference"
```

Expected: both `"creates a user task with form reference"` and `"creates a zeebe user task with zeebeUserTask flag"` pass.

- [ ] **Step 8: Add a combined test (zeebeUserTask + formId)**

In `packages/core/tests/bpmn-builder.test.ts`, after the test added in Step 1, add:

```typescript
it("creates a zeebe user task with both zeebeUserTask flag and formId", () => {
  const process = firstProcess(
    Bpmn.createProcess("proc")
      .userTask("ut3", { name: "Review", zeebeUserTask: true, formId: "form-456" })
      .build(),
  )

  const el = defined(process.flowElements.find((n) => n.id === "ut3"))
  const zeebeUserTaskEl = el.extensionElements.find((e) => e.name === "zeebe:userTask")
  expect(zeebeUserTaskEl).toBeDefined()
  const formDef = defined(el.extensionElements.find((e) => e.name === "zeebe:formDefinition"))
  expect(formDef.attributes.formId).toBe("form-456")
  // zeebe:userTask should appear before zeebe:formDefinition
  const zeebeIdx = el.extensionElements.findIndex((e) => e.name === "zeebe:userTask")
  const formIdx = el.extensionElements.findIndex((e) => e.name === "zeebe:formDefinition")
  expect(zeebeIdx).toBeLessThan(formIdx)
})
```

- [ ] **Step 9: Run full test + typecheck + lint**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core
pnpm turbo typecheck --filter=@bpmnkit/core
pnpm biome check packages/core/src/bpmn/zeebe-extensions.ts packages/core/src/bpmn/bpmn-builder.ts packages/core/tests/bpmn-builder.test.ts
```

Expected: all pass, zero warnings.

- [ ] **Step 10: Update doc/progress.md**

Add an entry at the top of `packages/core/doc/progress.md`:

```markdown
## [date] — Builder: emit `<zeebe:userTask />` marker

Added `zeebeUserTask?: boolean` option to `UserTaskOptions`. When `true`, the builder emits `<zeebe:userTask />` inside `<bpmn:extensionElements>`, marking the task as a Camunda 8 native user task. Compatible with `formId`; `<zeebe:userTask />` appears before `<zeebe:formDefinition />`.
```

- [ ] **Step 11: Commit**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
git add packages/core/src/bpmn/zeebe-extensions.ts \
        packages/core/src/bpmn/bpmn-builder.ts \
        packages/core/tests/bpmn-builder.test.ts \
        packages/core/doc/progress.md
git commit -m "feat(core): add zeebeUserTask option to builder userTask"
```
