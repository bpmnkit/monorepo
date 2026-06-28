# Fix Illegal EventBasedGateway Join Auto-Insertion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `insertJoinGateways()` so that when an `eventBasedGateway` split's branches converge, the auto-inserted join gateway is typed `exclusiveGateway` (not `eventBasedGateway`, which is illegal BPMN).

**Architecture:** One-line logic fix in `insertJoinGateways()` — map split type to the semantically correct join type using an explicit lookup; `eventBasedGateway` → `exclusiveGateway`, all others mirror as before. Add a unit test that asserts the join type, plus a regression test confirming existing gateway types are unchanged.

**Tech Stack:** TypeScript (strict), Vitest, pnpm, Turborepo.

## Global Constraints

- TypeScript strict mode — zero type errors.
- Biome — zero lint/format warnings.
- All existing tests must pass.
- New tests must be deterministic; use `resetIdCounter()` in `beforeEach` where ID stability matters.
- Run `pnpm turbo test --filter=@bpmnkit/core` to verify tests.
- Run `pnpm turbo check --filter=@bpmnkit/core` to verify lint/format.
- Run `pnpm turbo typecheck --filter=@bpmnkit/core` to verify types.

---

### Task 1: Fix `insertJoinGateways` and add tests

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:663-673`
- Modify: `packages/core/tests/bpmn-builder.test.ts` (add inside `describe("auto-join gateways")` at line ~2287)

**Interfaces:**
- No interface changes. Internal fix only.

- [ ] **Step 1: Write the failing test**

Open `packages/core/tests/bpmn-builder.test.ts`. Find the `describe("auto-join gateways")` block (around line 2287). Add two new `it` blocks **before** the closing `})` of that describe block (around line 2350):

```typescript
it("inserts an exclusiveGateway join (not eventBasedGateway) when eventBasedGateway branches converge", () => {
    const process = firstProcess(
        Bpmn.createProcess("proc")
            .startEvent("s")
            .eventBasedGateway("wait", { name: "Wait for response" })
            .branch("msg", (b) =>
                b
                    .intermediateCatchEvent("onMessage", {
                        name: "Message received",
                        messageName: "ResponseMessage",
                    })
                    .connectTo("converge"),
            )
            .branch("timer", (b) =>
                b
                    .intermediateCatchEvent("onTimeout", {
                        name: "Timeout",
                        timerDuration: "PT1H",
                    })
                    .connectTo("converge"),
            )
            .serviceTask("converge", { name: "Handle outcome", taskType: "handle" })
            .endEvent("end")
            .build(),
    )

    const join = process.flowElements.find((e) => e.id === "wait_join")
    expect(join).toBeDefined()
    // Must NOT be eventBasedGateway — that is illegal BPMN (split-only type)
    expect(join?.type).not.toBe("eventBasedGateway")
    // Must be exclusiveGateway — event-based branches are mutually exclusive
    expect(join?.type).toBe("exclusiveGateway")

    // Both catch events should flow into the join
    expect(
        process.sequenceFlows.some((f) => f.sourceRef === "onMessage" && f.targetRef === "wait_join"),
    ).toBe(true)
    expect(
        process.sequenceFlows.some((f) => f.sourceRef === "onTimeout" && f.targetRef === "wait_join"),
    ).toBe(true)

    // Join flows to converge task
    expect(
        process.sequenceFlows.some((f) => f.sourceRef === "wait_join" && f.targetRef === "converge"),
    ).toBe(true)
})

it("still inserts parallelGateway join for parallelGateway splits (regression)", () => {
    const process = firstProcess(
        Bpmn.createProcess("proc")
            .startEvent("s")
            .parallelGateway("split")
            .branch("a", (b) => b.serviceTask("ta", { name: "A", taskType: "x" }).connectTo("merge"))
            .branch("b", (b) => b.serviceTask("tb", { name: "B", taskType: "y" }).connectTo("merge"))
            .serviceTask("merge", { name: "After", taskType: "z" })
            .endEvent("end")
            .build(),
    )

    const join = process.flowElements.find((e) => e.id === "split_join")
    expect(join).toBeDefined()
    expect(join?.type).toBe("parallelGateway")
})
```

- [ ] **Step 2: Run the new tests to verify they FAIL**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core -- --reporter=verbose 2>&1 | grep -A3 "exclusiveGateway join\|parallelGateway join\|FAIL\|PASS" | head -40
```

Expected: the `eventBasedGateway` test fails with `expect(join?.type).toBe("exclusiveGateway")` — received `"eventBasedGateway"`. The `parallelGateway` regression test passes.

- [ ] **Step 3: Apply the fix**

Open `packages/core/src/bpmn/bpmn-builder.ts`. Find lines 663–671 inside `insertJoinGateways`:

```typescript
		for (const [splitId, convergingFlows] of splitToFlows) {
			if (convergingFlows.length < 2) continue
			const gwType = elementTypes.get(splitId)
			if (!gwType) continue
			const targetType = elementTypes.get(targetId)
			if (targetType === gwType) continue
			const joinId = `${splitId}_join`
			if (elementTypes.has(joinId)) continue
			const joinElement = makeFlowElement(joinId, gwType as BpmnElementType, {})
			elements.push(joinElement)
			elementTypes.set(joinId, gwType)
```

Replace the block so the join type is resolved through an explicit map:

```typescript
		for (const [splitId, convergingFlows] of splitToFlows) {
			if (convergingFlows.length < 2) continue
			const gwType = elementTypes.get(splitId)
			if (!gwType) continue
			// eventBasedGateway is split-only; converge through an XOR join instead
			const joinType: BpmnElementType =
				gwType === "eventBasedGateway" ? "exclusiveGateway" : (gwType as BpmnElementType)
			const targetType = elementTypes.get(targetId)
			if (targetType === joinType) continue
			const joinId = `${splitId}_join`
			if (elementTypes.has(joinId)) continue
			const joinElement = makeFlowElement(joinId, joinType, {})
			elements.push(joinElement)
			elementTypes.set(joinId, joinType)
```

The `if (targetType === gwType) continue` guard must also use `joinType` (not `gwType`) so an existing `exclusiveGateway` target is correctly recognized as already-joined even when the split was an `eventBasedGateway`.

The rest of the loop body (the `for...of convergingFlows` and `flows.push`) is unchanged.

- [ ] **Step 4: Run all tests**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core
```

Expected: all tests pass, including the two new ones.

- [ ] **Step 5: Typecheck and lint**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo typecheck --filter=@bpmnkit/core
pnpm turbo check --filter=@bpmnkit/core
```

Expected: zero errors, zero warnings.

- [ ] **Step 6: Update doc/progress.md**

Append to `packages/core/doc/progress.md`:

```
## [0.0.24+] Fix illegal eventBasedGateway join (2026-06-28)

`insertJoinGateways()` now maps `eventBasedGateway` splits to an `exclusiveGateway` join instead of mirroring the split type. Event-based gateways are split-only constructs; the XOR join is semantically correct because exactly one branch fires.
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/bpmn/bpmn-builder.ts \
        packages/core/tests/bpmn-builder.test.ts \
        packages/core/doc/progress.md
git commit -m "fix(core): use exclusiveGateway join for eventBasedGateway splits

eventBasedGateway is a split-only BPMN construct. insertJoinGateways()
was mirroring the split type to the auto-generated join, producing an
illegal eventBasedGateway with 2+ incoming flows.

Map eventBasedGateway → exclusiveGateway for the join; event-based
branches are mutually exclusive so an XOR merge is semantically correct.
All other split types continue to use matching join types."
```
