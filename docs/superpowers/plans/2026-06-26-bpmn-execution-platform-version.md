# BPMN ExecutionPlatformVersion Setter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fluent `.executionPlatformVersion(version)` method to `ProcessBuilder` and `DiagramBuilder`, replacing the hardcoded `"8.6.0"` literal, mirroring the existing `FormBuilder` API.

**Architecture:** Both builder classes get a private `_executionPlatformVersion` field defaulting to `"8.6.0"`, and a fluent setter. The field replaces the hardcoded literal in `build()`. No new files needed — all changes are in `bpmn-builder.ts` and its test file.

**Tech Stack:** TypeScript strict mode, Vitest, Biome.

## Global Constraints

- Default version must remain `"8.6.0"` (no breaking change for existing callers).
- Method name: `executionPlatformVersion(version: string): this` — identical signature to `FormBuilder`.
- Zero new external dependencies.
- All Biome checks must pass (`pnpm biome check .`).
- All tests must pass (`pnpm turbo test`).

---

### Task 1: Add `executionPlatformVersion` to `ProcessBuilder`

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:1054-1636`
- Test: `packages/core/tests/bpmn-builder.test.ts`

**Interfaces:**
- Produces: `ProcessBuilder#executionPlatformVersion(version: string): this`

- [ ] **Step 1: Write the failing test**

Add this test inside the `describe("BpmnProcessBuilder", ...)` block in `packages/core/tests/bpmn-builder.test.ts`, after the existing top-level `describe` blocks (e.g. after `linear flow`):

```typescript
describe("executionPlatformVersion", () => {
  it("defaults to 8.6.0", () => {
    const defs = Bpmn.createProcess("p1").startEvent("s").endEvent("e").build()
    expect(defs.unknownAttributes?.["modeler:executionPlatformVersion"]).toBe("8.6.0")
  })

  it("accepts a custom version", () => {
    const defs = Bpmn.createProcess("p1")
      .executionPlatformVersion("8.8.0")
      .startEvent("s")
      .endEvent("e")
      .build()
    expect(defs.unknownAttributes?.["modeler:executionPlatformVersion"]).toBe("8.8.0")
  })

  it("is chainable", () => {
    const builder = Bpmn.createProcess("p1")
    expect(builder.executionPlatformVersion("8.7.0")).toBe(builder)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -A3 "executionPlatformVersion"
```

Expected: FAIL — `builder.executionPlatformVersion is not a function`.

- [ ] **Step 3: Add private field to `ProcessBuilder`**

In `packages/core/src/bpmn/bpmn-builder.ts`, add a private field after `_autoLayout` (line ~1066):

```typescript
// Before (existing):
private _autoLayout = false
private _serviceTaskDefaults: { retries?: string } = {}

// After:
private _autoLayout = false
private _executionPlatformVersion = "8.6.0"
private _serviceTaskDefaults: { retries?: string } = {}
```

- [ ] **Step 4: Add the fluent setter method to `ProcessBuilder`**

Add after `withAutoLayout()` (line ~1077), before `defaults()`:

```typescript
/** Set the Camunda execution platform version stamped into the BPMN definitions. Defaults to `"8.6.0"`. */
executionPlatformVersion(version: string): this {
    this._executionPlatformVersion = version
    return this
}
```

- [ ] **Step 5: Replace the hardcoded literal in `ProcessBuilder.build()`**

In `ProcessBuilder.build()` (around line 1626), change:

```typescript
// Before:
"modeler:executionPlatformVersion": "8.6.0",

// After:
"modeler:executionPlatformVersion": this._executionPlatformVersion,
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|executionPlatformVersion)"
```

Expected: all three new tests PASS, all pre-existing tests still PASS.

- [ ] **Step 7: Run Biome check**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm biome check packages/core/src/bpmn/bpmn-builder.ts packages/core/tests/bpmn-builder.test.ts
```

Expected: no errors, no warnings.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/bpmn/bpmn-builder.ts packages/core/tests/bpmn-builder.test.ts
git commit -m "feat(core): add executionPlatformVersion setter to ProcessBuilder"
```

---

### Task 2: Add `executionPlatformVersion` to `DiagramBuilder`

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:1704-1752`
- Test: `packages/core/tests/bpmn-builder.test.ts`

**Interfaces:**
- Produces: `DiagramBuilder#executionPlatformVersion(version: string): this`

- [ ] **Step 1: Write the failing test**

Add a new `describe("DiagramBuilder")` block in `packages/core/tests/bpmn-builder.test.ts` (at the bottom of the file, inside the top-level describe or as a sibling):

```typescript
describe("DiagramBuilder", () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it("defaults executionPlatformVersion to 8.6.0", () => {
    const defs = Bpmn.createDiagram("D1")
      .process("p1", (b) => b.startEvent("s").endEvent("e"))
      .build()
    expect(defs.unknownAttributes?.["modeler:executionPlatformVersion"]).toBe("8.6.0")
  })

  it("accepts a custom executionPlatformVersion", () => {
    const defs = Bpmn.createDiagram("D1")
      .executionPlatformVersion("8.9.0")
      .process("p1", (b) => b.startEvent("s").endEvent("e"))
      .build()
    expect(defs.unknownAttributes?.["modeler:executionPlatformVersion"]).toBe("8.9.0")
  })

  it("executionPlatformVersion is chainable", () => {
    const builder = Bpmn.createDiagram("D1")
    expect(builder.executionPlatformVersion("8.7.0")).toBe(builder)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -A3 "DiagramBuilder"
```

Expected: FAIL — `builder.executionPlatformVersion is not a function`.

- [ ] **Step 3: Add private field to `DiagramBuilder`**

In `packages/core/src/bpmn/bpmn-builder.ts`, inside `DiagramBuilder` class (around line 1704), add after `_messages`:

```typescript
// Before (existing fields):
private readonly _errors: BpmnError[] = []
private readonly _messages: BpmnMessage[] = []

// After:
private readonly _errors: BpmnError[] = []
private readonly _messages: BpmnMessage[] = []
private _executionPlatformVersion = "8.6.0"
```

- [ ] **Step 4: Add the fluent setter method to `DiagramBuilder`**

Add after the constructor (line ~1712), before the `process()` method:

```typescript
/** Set the Camunda execution platform version stamped into the BPMN definitions. Defaults to `"8.6.0"`. */
executionPlatformVersion(version: string): this {
    this._executionPlatformVersion = version
    return this
}
```

- [ ] **Step 5: Replace the hardcoded literal in `DiagramBuilder.build()`**

Around line 1741, change:

```typescript
// Before:
"modeler:executionPlatformVersion": "8.6.0",

// After:
"modeler:executionPlatformVersion": this._executionPlatformVersion,
```

- [ ] **Step 6: Run all tests**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 7: Run Biome check**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm biome check packages/core/src/bpmn/bpmn-builder.ts packages/core/tests/bpmn-builder.test.ts
```

Expected: no errors, no warnings.

- [ ] **Step 8: Run full typecheck**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo typecheck --filter=@bpmnkit/core 2>&1 | tail -10
```

Expected: exit 0, zero errors.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/bpmn/bpmn-builder.ts packages/core/tests/bpmn-builder.test.ts
git commit -m "feat(core): add executionPlatformVersion setter to DiagramBuilder"
```

---

### Task 3: Update documentation

**Files:**
- Modify: `doc/progress.md`
- Modify: `doc/features.md`

- [ ] **Step 1: Update `doc/progress.md`**

Add an entry at the top (after the `# Progress` heading):

```markdown
## 2026-06-26 — feat(core): add executionPlatformVersion setter to BPMN builders

`ProcessBuilder` and `DiagramBuilder` now expose `.executionPlatformVersion(version)` — a fluent setter that overrides the default `"8.6.0"` stamp in the generated BPMN XML. Mirrors the existing `FormBuilder` API.
```

- [ ] **Step 2: Update `doc/features.md`**

Find the section covering BPMN builder features and add:

```markdown
- **`executionPlatformVersion` setter** (2026-06-26): `ProcessBuilder` and `DiagramBuilder` accept `.executionPlatformVersion("8.x.0")` to control the `modeler:executionPlatformVersion` attribute in generated BPMN. Default remains `8.6.0`.
```

- [ ] **Step 3: Commit**

```bash
git add doc/progress.md doc/features.md
git commit -m "docs: document executionPlatformVersion setter for BPMN builders"
```
