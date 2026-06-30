# receiveTask/sendTask messageName → messageRef Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `receiveTask` and `sendTask` the same `messageName → root <bpmn:message> + messageRef` resolution that message events already have.

**Architecture:** Three-layer fix: (1) add `messageRef` to the model types for send/receive tasks, (2) wire the parser and serializer to read/write that attribute, (3) update the builder's six task methods (two types × three builder classes) to resolve the name through `rootMessages` and set the attribute. Extract a shared `resolveMessage` helper so the resolution logic lives in one place.

**Tech Stack:** TypeScript strict, Vitest, Biome, pnpm turbo

## Global Constraints

- TypeScript strict mode — zero type errors
- Biome — zero lint warnings/errors
- All existing tests must pass
- `pnpm turbo test` / `pnpm turbo typecheck` / `pnpm biome check .` must all exit 0
- Touch only the four files listed below; match existing style exactly
- No new packages, no new files

---

### Task 1: Model — add `messageRef` to send/receive task types

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-model.ts:246-254`

**Interfaces:**
- Produces: `BpmnSendTask.messageRef?: string` and `BpmnReceiveTask.messageRef?: string` — read by Tasks 2, 3, 4

- [ ] **Step 1: Add `messageRef` to `BpmnSendTask`**

In `bpmn-model.ts`, find (currently at line 246):
```typescript
export interface BpmnSendTask extends BpmnFlowNodeBase {
	type: "sendTask"
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
}
```
Replace with:
```typescript
export interface BpmnSendTask extends BpmnFlowNodeBase {
	type: "sendTask"
	messageRef?: string
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
}
```

- [ ] **Step 2: Add `messageRef` to `BpmnReceiveTask`**

In `bpmn-model.ts`, find (currently at line 251):
```typescript
export interface BpmnReceiveTask extends BpmnFlowNodeBase {
	type: "receiveTask"
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
}
```
Replace with:
```typescript
export interface BpmnReceiveTask extends BpmnFlowNodeBase {
	type: "receiveTask"
	messageRef?: string
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
}
```

- [ ] **Step 3: Typecheck to confirm no new errors**

```bash
cd /home/adam/github.com/bpmnkit/monorepo && pnpm tsc --noEmit 2>&1 | head -20
```
Expected: zero errors (or only pre-existing ones unrelated to these two interfaces).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/bpmn/bpmn-model.ts
git commit -m "feat(core): add messageRef to BpmnSendTask and BpmnReceiveTask models"
```

---

### Task 2: Parser — read `messageRef` for send/receive tasks

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-parser.ts:348-358`

**Interfaces:**
- Consumes: `BpmnSendTask.messageRef` and `BpmnReceiveTask.messageRef` from Task 1
- Produces: parsed model with `messageRef` populated when the XML attribute is present

- [ ] **Step 1: Write the failing test**

In `packages/core/tests/bpmn-builder.test.ts`, find the `"creates a receive task"` test (currently around line 272). After its closing `})`, add a new `it` block inside the same `describe`:

```typescript
it("receiveTask round-trips messageRef through export → parse", () => {
    const defs = Bpmn.createProcess("proc")
        .startEvent("s")
        .receiveTask("rt", { name: "Await ping", messageName: "PingMsg" })
        .endEvent("e")
        .build()

    const xml = Bpmn.export(defs)
    const parsed = Bpmn.parse(xml)

    const el = defined(parsed.processes[0]?.flowElements.find((n) => n.id === "rt"))
    if (el.type !== "receiveTask") throw new Error("expected receiveTask")
    expect(el.messageRef).toBeDefined()
    // Must resolve to the root message ID, not raw name
    const rootMsg = parsed.messages.find((m) => m.name === "PingMsg")
    expect(rootMsg).toBeDefined()
    expect(el.messageRef).toBe(rootMsg?.id)
})
```

- [ ] **Step 2: Run test — confirm FAIL**

```bash
cd /home/adam/github.com/bpmnkit/monorepo && pnpm vitest run packages/core/tests/bpmn-builder.test.ts --reporter=verbose 2>&1 | grep -A5 "receiveTask round-trips messageRef"
```
Expected: FAIL (messageRef undefined because builder doesn't set it yet).

- [ ] **Step 3: Implement — parse `messageRef` in the send/receive task case**

In `bpmn-parser.ts`, find the `sendTask`/`receiveTask` case (currently lines 348-358):
```typescript
		case "task":
		case "serviceTask":
		case "scriptTask":
		case "userTask":
		case "sendTask":
		case "receiveTask":
		case "businessRuleTask":
		case "manualTask":
		case "callActivity":
			return {
				...base,
				type: ln,
				loopCharacteristics: parseLoopCharacteristics(element),
				isForCompensation: attr(element, "isForCompensation") === "true" ? true : undefined,
			}
```

Split the send/receive cases out so they also capture `messageRef`:
```typescript
		case "task":
		case "serviceTask":
		case "scriptTask":
		case "userTask":
		case "businessRuleTask":
		case "manualTask":
		case "callActivity":
			return {
				...base,
				type: ln,
				loopCharacteristics: parseLoopCharacteristics(element),
				isForCompensation: attr(element, "isForCompensation") === "true" ? true : undefined,
			}

		case "sendTask":
		case "receiveTask":
			return {
				...base,
				type: ln,
				messageRef: attr(element, "messageRef"),
				loopCharacteristics: parseLoopCharacteristics(element),
				isForCompensation: attr(element, "isForCompensation") === "true" ? true : undefined,
			}
```

- [ ] **Step 4: Run tests — confirm still FAIL (builder not wired yet)**

```bash
cd /home/adam/github.com/bpmnkit/monorepo && pnpm vitest run packages/core/tests/bpmn-builder.test.ts --reporter=verbose 2>&1 | grep -A5 "receiveTask round-trips messageRef"
```
Expected: Still FAIL — `el.messageRef` is undefined because the builder hasn't set it on export yet and the serializer doesn't emit it yet.

- [ ] **Step 5: Typecheck**

```bash
cd /home/adam/github.com/bpmnkit/monorepo && pnpm tsc --noEmit 2>&1 | head -20
```
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/bpmn/bpmn-parser.ts packages/core/tests/bpmn-builder.test.ts
git commit -m "feat(core): parse messageRef attribute for sendTask/receiveTask"
```

---

### Task 3: Serializer — emit `messageRef` for send/receive tasks

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-serializer.ts:228-238`

**Interfaces:**
- Consumes: `BpmnSendTask.messageRef` and `BpmnReceiveTask.messageRef` from Task 1
- Produces: XML with `messageRef="…"` attribute on `<bpmn:sendTask>` / `<bpmn:receiveTask>` when set

- [ ] **Step 1: Emit `messageRef` in the serializer**

In `bpmn-serializer.ts`, find the `sendTask`/`receiveTask` serialize case (currently lines 228-238):
```typescript
		case "task":
		case "serviceTask":
		case "scriptTask":
		case "userTask":
		case "sendTask":
		case "receiveTask":
		case "businessRuleTask":
		case "manualTask":
		case "callActivity":
			children.push(...serializeLoopCharacteristics(fe.loopCharacteristics, bp))
			break
```

Split so send/receive also emit `messageRef`:
```typescript
		case "task":
		case "serviceTask":
		case "scriptTask":
		case "userTask":
		case "businessRuleTask":
		case "manualTask":
		case "callActivity":
			children.push(...serializeLoopCharacteristics(fe.loopCharacteristics, bp))
			break

		case "sendTask":
		case "receiveTask":
			if (fe.messageRef) attrs.messageRef = fe.messageRef
			children.push(...serializeLoopCharacteristics(fe.loopCharacteristics, bp))
			break
```

- [ ] **Step 2: Run round-trip test — still FAIL (builder not wired)**

```bash
cd /home/adam/github.com/bpmnkit/monorepo && pnpm vitest run packages/core/tests/bpmn-builder.test.ts --reporter=verbose 2>&1 | grep -A5 "receiveTask round-trips messageRef"
```
Expected: still FAIL (builder doesn't produce the model yet).

- [ ] **Step 3: Typecheck**

```bash
cd /home/adam/github.com/bpmnkit/monorepo && pnpm tsc --noEmit 2>&1 | head -20
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/bpmn/bpmn-serializer.ts
git commit -m "feat(core): serialize messageRef attribute for sendTask/receiveTask"
```

---

### Task 4: Builder — resolve messageName to root message + messageRef

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts` (six task methods + one helper + one new interface)

**Interfaces:**
- Consumes: `BpmnReceiveTask.messageRef`, `BpmnSendTask.messageRef` from Task 1
- Produces: exported `MessageTaskOptions` interface; `ProcessBuilder.receiveTask/sendTask` and `BranchBuilder.receiveTask/sendTask` resolve messageName → root `BpmnMessage` + set `messageRef`

**Context for this task:**

The builder has three classes that implement `receiveTask` and `sendTask`:

1. **`ProcessBuilder`** (line ~1530) — has `private readonly rootMessages: BpmnMessage[]` instance field.
2. **`BranchBuilder`** (line ~877) — has `private readonly rootMessages: BpmnMessage[]` passed in constructor; the ProcessBuilder's `branch()` method passes its own `rootMessages` array so mutations accumulate in the parent's list.
3. **`SubProcessContentBuilder`** (line ~1093) — has no `rootMessages` field (pre-existing limitation; same applies to message events inside sub-processes).

The message resolution logic currently lives inline inside `buildEventDefinitions` (line ~306-316):
```typescript
if (opts.messageName !== undefined) {
    let messageRef: string | undefined = opts.messageName
    if (rootMessages) {
        let existing = rootMessages.find((m) => m.name === opts.messageName)
        if (!existing) {
            existing = { id: generateId("Message"), name: opts.messageName, unknownAttributes: {} }
            rootMessages.push(existing)
        }
        messageRef = existing.id
    }
    defs.push({ type: "message", messageRef })
}
```

We will extract that "find or create" part into a standalone helper and call it from the task methods.

- [ ] **Step 1: Write the full set of failing tests**

Add the following `it` blocks to `bpmn-builder.test.ts`. Find the existing `"creates a receive task"` test block and add after it (still inside the same `describe("element types — aspirational")`):

```typescript
it("receiveTask with messageName emits root bpmn:message and sets messageRef on task", () => {
    const defs = Bpmn.createProcess("proc")
        .startEvent("s")
        .receiveTask("rt", { name: "Await ping", messageName: "PingMsg" })
        .endEvent("e")
        .build()

    expect(defs.messages).toHaveLength(1)
    const rootMsg = defs.messages[0]
    expect(rootMsg?.name).toBe("PingMsg")

    const el = defined(defs.processes[0]?.flowElements.find((n) => n.id === "rt"))
    if (el.type !== "receiveTask") throw new Error("expected receiveTask")
    expect(el.messageRef).toBe(rootMsg?.id)
})

it("sendTask with messageName emits root bpmn:message and sets messageRef on task", () => {
    const defs = Bpmn.createProcess("proc")
        .startEvent("s")
        .sendTask("st", { name: "Send ping", messageName: "PingMsg" })
        .endEvent("e")
        .build()

    expect(defs.messages).toHaveLength(1)
    const rootMsg = defs.messages[0]
    expect(rootMsg?.name).toBe("PingMsg")

    const el = defined(defs.processes[0]?.flowElements.find((n) => n.id === "st"))
    if (el.type !== "sendTask") throw new Error("expected sendTask")
    expect(el.messageRef).toBe(rootMsg?.id)
})

it("receiveTask without messageName emits a bare task (no messageRef)", () => {
    const defs = Bpmn.createProcess("proc")
        .startEvent("s")
        .receiveTask("rt", { name: "Bare receive" })
        .endEvent("e")
        .build()

    expect(defs.messages).toHaveLength(0)
    const el = defined(defs.processes[0]?.flowElements.find((n) => n.id === "rt"))
    if (el.type !== "receiveTask") throw new Error("expected receiveTask")
    expect(el.messageRef).toBeUndefined()
})

it("messageName is de-duplicated across receiveTask and message start event", () => {
    const defs = Bpmn.createProcess("proc")
        .startEvent("s", { messageName: "SharedMsg" })
        .receiveTask("rt", { name: "Await", messageName: "SharedMsg" })
        .endEvent("e")
        .build()

    // Only one root message despite two usages
    expect(defs.messages).toHaveLength(1)
    const rootMsg = defs.messages[0]
    expect(rootMsg?.name).toBe("SharedMsg")

    // Start event references the same root
    const start = defs.processes[0]?.flowElements.find((n) => n.id === "s")
    if (start?.type === "startEvent") {
        const def = start.eventDefinitions[0]
        if (def?.type === "message") expect(def.messageRef).toBe(rootMsg?.id)
    }

    // Receive task also references the same root
    const el = defined(defs.processes[0]?.flowElements.find((n) => n.id === "rt"))
    if (el.type !== "receiveTask") throw new Error("expected receiveTask")
    expect(el.messageRef).toBe(rootMsg?.id)
})

it("receiveTask messageName in a branch emits root message and sets messageRef", () => {
    const defs = Bpmn.createProcess("proc")
        .startEvent("s")
        .exclusiveGateway("gw")
        .branch("A", (b) =>
            b.receiveTask("rt", { name: "Wait", messageName: "BranchMsg" }).connectTo("e"),
        )
        .branch("B", (b) => b.endEvent("e2"))
        .endEvent("e")
        .build()

    expect(defs.messages).toHaveLength(1)
    const rootMsg = defs.messages[0]
    expect(rootMsg?.name).toBe("BranchMsg")

    const el = defined(defs.processes[0]?.flowElements.find((n) => n.id === "rt"))
    if (el.type !== "receiveTask") throw new Error("expected receiveTask")
    expect(el.messageRef).toBe(rootMsg?.id)
})
```

- [ ] **Step 2: Run tests — confirm all new tests FAIL**

```bash
cd /home/adam/github.com/bpmnkit/monorepo && pnpm vitest run packages/core/tests/bpmn-builder.test.ts --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|receiveTask with message|sendTask with message|de-duplicated across|without messageName|in a branch emits)"
```
Expected: All 5 new tests FAIL. All pre-existing tests PASS.

- [ ] **Step 3: Export `MessageTaskOptions` interface**

In `bpmn-builder.ts`, find the `ElementOptions` interface (currently around line 36):
```typescript
export interface ElementOptions {
	name?: string
	isForCompensation?: boolean
}
```

Add the new interface immediately after it:
```typescript
/** Options for send/receive task elements. */
export interface MessageTaskOptions extends ElementOptions {
	/** Message name — generates or reuses a root <bpmn:message> and sets messageRef. */
	messageName?: string
}
```

- [ ] **Step 4: Extract `resolveMessage` helper**

In `bpmn-builder.ts`, find the `buildEventDefinitions` function (around line 264). Just before it, add:
```typescript
function resolveMessage(messageName: string, rootMessages: BpmnMessage[]): string {
	let existing = rootMessages.find((m) => m.name === messageName)
	if (!existing) {
		existing = { id: generateId("Message"), name: messageName, unknownAttributes: {} }
		rootMessages.push(existing)
	}
	return existing.id
}
```

Then simplify the inline block inside `buildEventDefinitions` (lines ~306-316) to use it:
```typescript
	if (opts.messageName !== undefined) {
		const messageRef = rootMessages
			? resolveMessage(opts.messageName, rootMessages)
			: opts.messageName
		defs.push({ type: "message", messageRef })
	}
```

- [ ] **Step 5: Update `BranchBuilder.sendTask` and `BranchBuilder.receiveTask`**

Find the BranchBuilder methods (currently around lines 877-887):
```typescript
	sendTask(id: string, options?: ElementOptions): this {
		const el = makeFlowElement(id, "sendTask", options)
		if (options?.isForCompensation) el.isForCompensation = true
		return this.addElement(el)
	}

	receiveTask(id: string, options?: ElementOptions): this {
		const el = makeFlowElement(id, "receiveTask", options)
		if (options?.isForCompensation) el.isForCompensation = true
		return this.addElement(el)
	}
```

Replace with:
```typescript
	sendTask(id: string, options?: MessageTaskOptions): this {
		const el = makeFlowElement(id, "sendTask", options) as BpmnSendTask
		if (options?.isForCompensation) el.isForCompensation = true
		if (options?.messageName) el.messageRef = resolveMessage(options.messageName, this.rootMessages)
		return this.addElement(el)
	}

	receiveTask(id: string, options?: MessageTaskOptions): this {
		const el = makeFlowElement(id, "receiveTask", options) as BpmnReceiveTask
		if (options?.isForCompensation) el.isForCompensation = true
		if (options?.messageName) el.messageRef = resolveMessage(options.messageName, this.rootMessages)
		return this.addElement(el)
	}
```

- [ ] **Step 6: Update `SubProcessContentBuilder.sendTask` and `SubProcessContentBuilder.receiveTask`**

Find the SubProcessContentBuilder methods (currently around lines 1093-1103):
```typescript
	sendTask(id: string, options?: ElementOptions): this {
		const el = makeFlowElement(id, "sendTask", options)
		if (options?.isForCompensation) el.isForCompensation = true
		return this.addElement(el)
	}

	receiveTask(id: string, options?: ElementOptions): this {
		const el = makeFlowElement(id, "receiveTask", options)
		if (options?.isForCompensation) el.isForCompensation = true
		return this.addElement(el)
	}
```

Replace with (note: SubProcessContentBuilder has no rootMessages, so messageRef = raw name, same as message events in sub-process context):
```typescript
	sendTask(id: string, options?: MessageTaskOptions): this {
		const el = makeFlowElement(id, "sendTask", options) as BpmnSendTask
		if (options?.isForCompensation) el.isForCompensation = true
		if (options?.messageName) el.messageRef = options.messageName
		return this.addElement(el)
	}

	receiveTask(id: string, options?: MessageTaskOptions): this {
		const el = makeFlowElement(id, "receiveTask", options) as BpmnReceiveTask
		if (options?.isForCompensation) el.isForCompensation = true
		if (options?.messageName) el.messageRef = options.messageName
		return this.addElement(el)
	}
```

- [ ] **Step 7: Update `ProcessBuilder.sendTask` and `ProcessBuilder.receiveTask`**

Find the ProcessBuilder methods (currently around lines 1530-1543):
```typescript
	/** Add a send task (aspirational). */
	sendTask(id: string, options?: ElementOptions): this {
		const el = makeFlowElement(id, "sendTask", options)
		if (options?.isForCompensation) el.isForCompensation = true
		this.addFlowElement(el)
		return this
	}

	/** Add a receive task (aspirational). */
	receiveTask(id: string, options?: ElementOptions): this {
		const el = makeFlowElement(id, "receiveTask", options)
		if (options?.isForCompensation) el.isForCompensation = true
		this.addFlowElement(el)
		return this
	}
```

Replace with:
```typescript
	/** Add a send task (aspirational). */
	sendTask(id: string, options?: MessageTaskOptions): this {
		const el = makeFlowElement(id, "sendTask", options) as BpmnSendTask
		if (options?.isForCompensation) el.isForCompensation = true
		if (options?.messageName) el.messageRef = resolveMessage(options.messageName, this.rootMessages)
		this.addFlowElement(el)
		return this
	}

	/** Add a receive task (aspirational). */
	receiveTask(id: string, options?: MessageTaskOptions): this {
		const el = makeFlowElement(id, "receiveTask", options) as BpmnReceiveTask
		if (options?.isForCompensation) el.isForCompensation = true
		if (options?.messageName) el.messageRef = resolveMessage(options.messageName, this.rootMessages)
		this.addFlowElement(el)
		return this
	}
```

- [ ] **Step 8: Check that `BpmnSendTask` and `BpmnReceiveTask` are imported where needed**

The cast `as BpmnSendTask` and `as BpmnReceiveTask` require those types to be in scope. Run:
```bash
grep -n "^import\|BpmnSendTask\|BpmnReceiveTask" /home/adam/github.com/bpmnkit/monorepo/packages/core/src/bpmn/bpmn-builder.ts | head -20
```
If `BpmnSendTask` or `BpmnReceiveTask` are not already imported from `./bpmn-model`, add them to the existing import.

- [ ] **Step 9: Run all tests — confirm all new tests pass**

```bash
cd /home/adam/github.com/bpmnkit/monorepo && pnpm vitest run packages/core/tests/bpmn-builder.test.ts --reporter=verbose 2>&1 | tail -20
```
Expected: All tests PASS including the 5 new ones and the round-trip test from Task 2.

- [ ] **Step 10: Typecheck and lint**

```bash
cd /home/adam/github.com/bpmnkit/monorepo && pnpm tsc --noEmit 2>&1 | head -20
cd /home/adam/github.com/bpmnkit/monorepo && pnpm biome check packages/core/src/bpmn/bpmn-builder.ts packages/core/src/bpmn/bpmn-model.ts packages/core/src/bpmn/bpmn-parser.ts packages/core/src/bpmn/bpmn-serializer.ts 2>&1 | tail -10
```
Expected: zero errors, zero warnings.

- [ ] **Step 11: Run full turbo test to catch any regressions**

```bash
cd /home/adam/github.com/bpmnkit/monorepo && pnpm turbo test 2>&1 | tail -30
```
Expected: all packages pass.

- [ ] **Step 12: Commit**

```bash
git add packages/core/src/bpmn/bpmn-builder.ts packages/core/tests/bpmn-builder.test.ts
git commit -m "feat(core): receiveTask/sendTask messageName → root bpmn:message + messageRef"
```

---

### Task 5: Documentation update

**Files:**
- Modify: `doc/progress.md`
- Modify: `doc/features.md`

**Interfaces:** none

- [ ] **Step 1: Update `doc/progress.md`**

Add an entry at the top of the changelog describing this change. Match the existing format.

- [ ] **Step 2: Update `doc/features.md`**

Update the receive/send task entry (or add one) to note that `messageName` is now supported with root message de-duplication.

- [ ] **Step 3: Commit**

```bash
git add doc/progress.md doc/features.md
git commit -m "docs: document receiveTask/sendTask messageName support"
```

---

## Self-Review

### Spec coverage

| Acceptance criterion | Task |
|---|---|
| `receiveTask(id, { messageName })` emits root + sets messageRef | Task 4 (ProcessBuilder + BranchBuilder) |
| De-dup by name across all positions | Task 4 test "de-duplicated across" |
| `sendTask(id, { messageName })` same | Task 4 (ProcessBuilder + BranchBuilder) |
| Round-trip parse → export without losing message/ref | Task 2 test |
| Omit messageName → bare task, no dangling ref | Task 4 test "without messageName" |

All five acceptance criteria are covered.

### Placeholder scan

No TBDs. All code blocks are complete and exact.

### Type consistency

- `MessageTaskOptions` introduced in Task 4, Step 3; used in Steps 5, 6, 7 — consistent.
- `resolveMessage(messageName, rootMessages)` introduced in Task 4, Step 4; called in Steps 5 and 7 — consistent.
- `BpmnSendTask.messageRef` and `BpmnReceiveTask.messageRef` introduced in Task 1; read by parser (Task 2 Step 3) and serializer (Task 3 Step 1); set by builder (Task 4 Steps 5–7) — consistent.
