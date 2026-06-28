# Builder: Abstract Task (.task()) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `.task(id, options?)` fluent builder method that emits a plain `<bpmn:task>` with no Zeebe extension elements, to all three builder classes (`ProcessBuilder`, `BranchBuilder`, `SubProcessContentBuilder`).

**Architecture:** `makeFlowElement(id, "task", options)` already works — `"task"` is a valid `BpmnElementType` and `makeFlowElement` already has a `case "task"` branch. We only need to expose it as a builder method mirroring `sendTask`/`receiveTask`. No new factory function, no new type, no new exports beyond docs.

**Tech Stack:** TypeScript (strict), Vitest, Biome, pnpm/Turborepo monorepo.

## Global Constraints

- Zero TypeScript errors, zero Biome warnings.
- All existing tests must pass.
- New method has no Zeebe `extensionElements` — abstract task is intentionally extension-free.
- Follow existing JSDoc style (one-line summary).
- Update `doc/progress.md` and `doc/features.md` (CLAUDE.md requirement: every change).

---

### Task 1: Add `.task()` to all three builder classes + tests

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts`
  - `BranchBuilder` around line 799 (after `callActivity`)
  - `SubProcessContentBuilder` around line 972 (after `receiveTask`)
  - `ProcessBuilder` around line 1373 (after `callActivity`)
- Modify: `packages/core/tests/bpmn-builder.test.ts` (add tests after the `receiveTask` test ~line 280)

**Interfaces:**
- Consumes: `makeFlowElement(id, "task", options)` — already exists at line 290 of `bpmn-builder.ts`
- Produces: `.task(id: string, options?: ElementOptions): this` on all three builder classes

- [ ] **Step 1: Write the failing tests**

Add after the `"creates a receive task"` test (~line 280 in `bpmn-builder.test.ts`):

```typescript
it("creates an abstract task with no extension elements", () => {
  const process = firstProcess(
    Bpmn.createProcess("proc").task("t1", { name: "Phase 1" }).build(),
  )

  const el = defined(process.flowElements.find((n) => n.id === "t1"))
  expect(el.type).toBe("task")
  expect(el.name).toBe("Phase 1")
  expect(el.extensionElements).toHaveLength(0)
})

it("creates an abstract task with no options", () => {
  const process = firstProcess(
    Bpmn.createProcess("proc").task("t2").build(),
  )

  const el = defined(process.flowElements.find((n) => n.id === "t2"))
  expect(el.type).toBe("task")
  expect(el.name).toBeUndefined()
  expect(el.extensionElements).toHaveLength(0)
})

it("abstract task round-trips through export → parse unchanged", () => {
  const defs = Bpmn.createProcess("proc")
    .startEvent("s")
    .task("t1", { name: "Phase 1" })
    .endEvent("e")
    .build()

  const xml = Bpmn.export(defs)
  const parsed = Bpmn.parse(xml)

  const el = defined(parsed.processes[0]?.flowElements.find((n) => n.id === "t1"))
  expect(el.type).toBe("task")
  expect(el.name).toBe("Phase 1")
  expect(el.extensionElements).toHaveLength(0)
  // No <zeebe:*> leakage
  expect(xml).not.toContain("zeebe:taskDefinition")
  expect(xml).toContain('<bpmn:task id="t1"')
})

it("abstract task works in a branch", () => {
  const process = firstProcess(
    Bpmn.createProcess("proc")
      .exclusiveGateway("gw")
      .branch("A", (b) => b.task("t-a", { name: "Path A" }).connectTo("merge"))
      .branch("B", (b) => b.task("t-b", { name: "Path B" }).connectTo("merge"))
      .exclusiveGateway("merge")
      .build(),
  )

  const ta = defined(process.flowElements.find((n) => n.id === "t-a"))
  const tb = defined(process.flowElements.find((n) => n.id === "t-b"))
  expect(ta.type).toBe("task")
  expect(tb.type).toBe("task")
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm vitest run packages/core/tests/bpmn-builder.test.ts 2>&1 | grep -A3 "abstract task"
```

Expected: `TypeError` or `not a function` errors on `.task(`.

- [ ] **Step 3: Add `.task()` to `BranchBuilder`**

In `packages/core/src/bpmn/bpmn-builder.ts`, in `BranchBuilder` after the `callActivity` method (line ~799):

```typescript
	/** Add an abstract task with no Zeebe extensions. */
	task(id: string, options?: ElementOptions): this {
		return this.addElement(makeFlowElement(id, "task", options))
	}
```

- [ ] **Step 4: Add `.task()` to `SubProcessContentBuilder`**

In `SubProcessContentBuilder` after the `receiveTask` method (line ~972):

```typescript
	/** Add an abstract task with no Zeebe extensions. */
	task(id: string, options?: ElementOptions): this {
		return this.addElement(makeFlowElement(id, "task", options))
	}
```

- [ ] **Step 5: Add `.task()` to `ProcessBuilder`**

In `ProcessBuilder` after the `callActivity` method (line ~1373):

```typescript
	/** Add an abstract task with no Zeebe extensions. */
	task(id: string, options?: ElementOptions): this {
		this.addFlowElement(makeFlowElement(id, "task", options))
		return this
	}
```

Note: `ProcessBuilder` methods call `this.addFlowElement(...)` and return `this` manually (unlike `BranchBuilder`/`SubProcessContentBuilder` which use `return this.addElement(...)`). Match the existing pattern.

- [ ] **Step 6: Run tests to confirm they pass**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm vitest run packages/core/tests/bpmn-builder.test.ts
```

Expected: all tests pass, including the 4 new abstract task tests.

- [ ] **Step 7: Run full check (lint + typecheck + tests)**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo check && pnpm turbo typecheck && pnpm turbo test
```

Expected: zero errors, zero warnings, all tests pass.

- [ ] **Step 8: Update docs**

Append to `doc/progress.md` (find the current last entry and add after it):

```markdown
### 2026-06-28 — Builder: abstract `.task()` method

Added `.task(id, options?)` to `ProcessBuilder`, `BranchBuilder`, and `SubProcessContentBuilder`. Emits a plain `<bpmn:task>` with no Zeebe extension elements — the correct BPMN element for documentation-grade / overview diagrams where the task type is unspecified. Resolves issue #109.
```

Append to `doc/features.md` under the Builder section — add a line like:

```markdown
- **2026-06-28** `ProcessBuilder.task()` / `BranchBuilder.task()` / `SubProcessContentBuilder.task()` — emits abstract `<bpmn:task>` with no Zeebe extensions, for documentation-grade diagrams.
```

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/bpmn/bpmn-builder.ts \
        packages/core/tests/bpmn-builder.test.ts \
        doc/progress.md \
        doc/features.md
git commit -m "feat(core): add fluent .task() builder method for abstract bpmn:task"
```
