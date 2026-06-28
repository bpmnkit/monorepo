# Event Ref Root Declarations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every event that carries a name/code ref (`signalName`, `messageName`, `escalationCode`, `errorCode`, `errorRef`) automatically emit the corresponding root `<bpmn:signal|message|escalation|error>` element under `<bpmn:definitions>` and point the event's ref at its generated ID — with de-duplication across multiple events sharing the same name/code.

**Architecture:** All changes are in a single file — `packages/core/src/bpmn/bpmn-builder.ts`. The fix has three parts: (1) add `rootSignals` and `rootEscalations` tracking arrays to `ProcessBuilder`, (2) teach `buildEventDefinitions()` to emit roots for signals and escalations (and to de-duplicate for all types, and to treat `errorRef` the same as `errorCode`), (3) thread those arrays through all event method calls and expose them in `build()`. Tests live in `packages/core/tests/bpmn-builder.test.ts`.

**Tech Stack:** TypeScript strict, Vitest, pnpm workspaces, Biome for lint/format.

## Global Constraints

- Zero TypeScript errors, zero Biome warnings.
- All existing tests must pass after every commit.
- Every `signalRef`/`messageRef`/`escalationRef`/`errorRef` in exported XML must point to a declared root element ID — never a raw name/code string.
- De-duplicate: two events with the same `signalName` → one `<bpmn:signal>` root.
- Existing working cases (`messageName` on start event, `errorCode` on boundary) must be unchanged in behaviour (just de-duplicated).
- Do NOT touch `BranchBuilder` or `SubProcessContentBuilder` — they don't own `BpmnDefinitions` and are out of scope.

---

### Task 1: Write failing tests

**Files:**
- Modify: `packages/core/tests/bpmn-builder.test.ts:1474-1529` (update existing "event definition values" tests to assert correct behaviour)
- Modify: `packages/core/tests/bpmn-builder.test.ts` (add new describe block for all acceptance-criteria cases)

**Interfaces:**
- Consumes: existing `Bpmn.createProcess` API, `BpmnDefinitions.signals`, `BpmnDefinitions.escalations`
- Produces: a test suite that fails until Task 2 is implemented

---

#### Step 1a: Update the three existing "event definition values" tests that assert broken behaviour

These tests currently pass because they assert the broken raw-string behaviour. Update them to assert the correct behaviour (root element emitted, ref = generated ID).

Find the `describe("event definition values"` block (around line 1473) and replace its three `it()` bodies:

- [ ] **Step 1: Open `packages/core/tests/bpmn-builder.test.ts`**

- [ ] **Step 2: Replace the three existing tests in `describe("event definition values")`**

Old test at ~line 1474:
```typescript
it("stores messageName as messageRef", () => {
    const process = firstProcess(
        Bpmn.createProcess("proc")
            .startEvent("s")
            .intermediateThrowEvent("msg", { messageName: "order-placed" })
            .endEvent("e")
            .build(),
    )

    const ite = defined(process.flowElements.find((n) => n.id === "msg"))
    if (ite.type === "intermediateThrowEvent") {
        const def = defined(ite.eventDefinitions[0])
        expect(def.type).toBe("message")
        if (def.type === "message") {
            expect(def.messageRef).toBe("order-placed")
        }
    }
})
```

Replace with:
```typescript
it("intermediateThrowEvent messageName emits root message and sets messageRef to its ID", () => {
    const defs = Bpmn.createProcess("proc")
        .startEvent("s")
        .intermediateThrowEvent("msg", { messageName: "order-placed" })
        .endEvent("e")
        .build()

    expect(defs.messages).toHaveLength(1)
    const rootMsg = defs.messages[0]
    expect(rootMsg?.name).toBe("order-placed")

    const ite = defs.processes[0]?.flowElements.find((n) => n.id === "msg")
    if (ite?.type === "intermediateThrowEvent") {
        const def = ite.eventDefinitions[0]
        expect(def?.type).toBe("message")
        if (def?.type === "message") {
            expect(def.messageRef).toBe(rootMsg?.id)
        }
    }
})
```

Old test at ~line 1493:
```typescript
it("stores signalName as signalRef", () => {
    const process = firstProcess(
        Bpmn.createProcess("proc")
            .startEvent("s")
            .intermediateCatchEvent("sig", { signalName: "data-ready" })
            .endEvent("e")
            .build(),
    )

    const ice = defined(process.flowElements.find((n) => n.id === "sig"))
    if (ice.type === "intermediateCatchEvent") {
        const def = defined(ice.eventDefinitions[0])
        expect(def.type).toBe("signal")
        if (def.type === "signal") {
            expect(def.signalRef).toBe("data-ready")
        }
    }
})
```

Replace with:
```typescript
it("intermediateCatchEvent signalName emits root signal and sets signalRef to its ID", () => {
    const defs = Bpmn.createProcess("proc")
        .startEvent("s")
        .intermediateCatchEvent("sig", { signalName: "data-ready" })
        .endEvent("e")
        .build()

    expect(defs.signals).toHaveLength(1)
    const rootSig = defs.signals[0]
    expect(rootSig?.name).toBe("data-ready")

    const ice = defs.processes[0]?.flowElements.find((n) => n.id === "sig")
    if (ice?.type === "intermediateCatchEvent") {
        const def = ice.eventDefinitions[0]
        expect(def?.type).toBe("signal")
        if (def?.type === "signal") {
            expect(def.signalRef).toBe(rootSig?.id)
        }
    }
})
```

Old test at ~line 1512:
```typescript
it("stores escalationCode as escalationRef", () => {
    const process = firstProcess(
        Bpmn.createProcess("proc")
            .startEvent("s")
            .intermediateThrowEvent("esc", { escalationCode: "ESC_001" })
            .endEvent("e")
            .build(),
    )

    const ite = defined(process.flowElements.find((n) => n.id === "esc"))
    if (ite.type === "intermediateThrowEvent") {
        const def = defined(ite.eventDefinitions[0])
        expect(def.type).toBe("escalation")
        if (def.type === "escalation") {
            expect(def.escalationRef).toBe("ESC_001")
        }
    }
})
```

Replace with:
```typescript
it("intermediateThrowEvent escalationCode emits root escalation and sets escalationRef to its ID", () => {
    const defs = Bpmn.createProcess("proc")
        .startEvent("s")
        .intermediateThrowEvent("esc", { escalationCode: "ESC_001" })
        .endEvent("e")
        .build()

    expect(defs.escalations).toHaveLength(1)
    const rootEsc = defs.escalations[0]
    expect(rootEsc?.escalationCode).toBe("ESC_001")

    const ite = defs.processes[0]?.flowElements.find((n) => n.id === "esc")
    if (ite?.type === "intermediateThrowEvent") {
        const def = ite.eventDefinitions[0]
        expect(def?.type).toBe("escalation")
        if (def?.type === "escalation") {
            expect(def.escalationRef).toBe(rootEsc?.id)
        }
    }
})
```

- [ ] **Step 3: Run the updated tests to confirm they now fail**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm --filter @bpmnkit/core test -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|✓|×|intermediateThrow|intermediateCatch|escalation" | head -30
```

Expected: the three updated tests now FAIL (the others still pass).

---

#### Step 1b: Add new tests for all remaining acceptance-criteria cases

Add a new `describe` block after the "event definition values" block (after the closing `})` of that block). Insert these tests:

- [ ] **Step 4: Add new `describe("event ref root declarations")` block**

```typescript
describe("event ref root declarations", () => {
    it("intermediateThrowEvent signalName emits root signal and sets signalRef to its ID", () => {
        const defs = Bpmn.createProcess("proc")
            .startEvent("s")
            .intermediateThrowEvent("throw", { signalName: "OrderShipped" })
            .endEvent("e")
            .build()

        expect(defs.signals).toHaveLength(1)
        const rootSig = defs.signals[0]
        expect(rootSig?.name).toBe("OrderShipped")

        const ev = defs.processes[0]?.flowElements.find((n) => n.id === "throw")
        if (ev?.type === "intermediateThrowEvent") {
            const def = ev.eventDefinitions[0]
            expect(def?.type).toBe("signal")
            if (def?.type === "signal") expect(def.signalRef).toBe(rootSig?.id)
        }
    })

    it("intermediateCatchEvent messageName emits root message and sets messageRef to its ID", () => {
        const defs = Bpmn.createProcess("proc")
            .startEvent("s")
            .intermediateCatchEvent("catch", { messageName: "PaymentConfirmed" })
            .endEvent("e")
            .build()

        expect(defs.messages).toHaveLength(1)
        const rootMsg = defs.messages[0]
        expect(rootMsg?.name).toBe("PaymentConfirmed")

        const ev = defs.processes[0]?.flowElements.find((n) => n.id === "catch")
        if (ev?.type === "intermediateCatchEvent") {
            const def = ev.eventDefinitions[0]
            expect(def?.type).toBe("message")
            if (def?.type === "message") expect(def.messageRef).toBe(rootMsg?.id)
        }
    })

    it("boundaryEvent signalName emits root signal and sets signalRef to its ID", () => {
        const defs = Bpmn.createProcess("proc")
            .startEvent("s")
            .serviceTask("task", { name: "T", taskType: "t" })
            .boundaryEvent("bnd", { attachedTo: "task", signalName: "Cancelled" })
            .endEvent("e")
            .build()

        expect(defs.signals).toHaveLength(1)
        const rootSig = defs.signals[0]
        expect(rootSig?.name).toBe("Cancelled")

        const ev = defs.processes[0]?.flowElements.find((n) => n.id === "bnd")
        if (ev?.type === "boundaryEvent") {
            const def = ev.eventDefinitions[0]
            expect(def?.type).toBe("signal")
            if (def?.type === "signal") expect(def.signalRef).toBe(rootSig?.id)
        }
    })

    it("boundaryEvent messageName emits root message and sets messageRef to its ID", () => {
        const defs = Bpmn.createProcess("proc")
            .startEvent("s")
            .serviceTask("task", { name: "T", taskType: "t" })
            .boundaryEvent("bnd", { attachedTo: "task", messageName: "Retry" })
            .endEvent("e")
            .build()

        expect(defs.messages).toHaveLength(1)
        const rootMsg = defs.messages[0]
        expect(rootMsg?.name).toBe("Retry")

        const ev = defs.processes[0]?.flowElements.find((n) => n.id === "bnd")
        if (ev?.type === "boundaryEvent") {
            const def = ev.eventDefinitions[0]
            expect(def?.type).toBe("message")
            if (def?.type === "message") expect(def.messageRef).toBe(rootMsg?.id)
        }
    })

    it("boundaryEvent errorRef emits root error and sets errorRef to its ID", () => {
        const defs = Bpmn.createProcess("proc")
            .startEvent("s")
            .serviceTask("task", { name: "T", taskType: "t" })
            .boundaryEvent("bnd", { attachedTo: "task", errorRef: "MyError" })
            .endEvent("e")
            .build()

        expect(defs.errors).toHaveLength(1)
        const rootErr = defs.errors[0]
        expect(rootErr?.name).toBe("MyError")

        const ev = defs.processes[0]?.flowElements.find((n) => n.id === "bnd")
        if (ev?.type === "boundaryEvent") {
            const def = ev.eventDefinitions[0]
            expect(def?.type).toBe("error")
            if (def?.type === "error") expect(def.errorRef).toBe(rootErr?.id)
        }
    })

    it("de-duplicates signals: two events with same signalName share one root", () => {
        const defs = Bpmn.createProcess("proc")
            .startEvent("s")
            .intermediateThrowEvent("t1", { signalName: "Shared" })
            .intermediateThrowEvent("t2", { signalName: "Shared" })
            .endEvent("e")
            .build()

        expect(defs.signals).toHaveLength(1)
        const rootSig = defs.signals[0]

        const t1 = defs.processes[0]?.flowElements.find((n) => n.id === "t1")
        const t2 = defs.processes[0]?.flowElements.find((n) => n.id === "t2")
        if (t1?.type === "intermediateThrowEvent" && t2?.type === "intermediateThrowEvent") {
            const def1 = t1.eventDefinitions[0]
            const def2 = t2.eventDefinitions[0]
            if (def1?.type === "signal" && def2?.type === "signal") {
                expect(def1.signalRef).toBe(rootSig?.id)
                expect(def2.signalRef).toBe(rootSig?.id)
            }
        }
    })

    it("de-duplicates messages: two events with same messageName share one root", () => {
        const defs = Bpmn.createProcess("proc")
            .startEvent("s")
            .intermediateCatchEvent("c1", { messageName: "Shared" })
            .intermediateCatchEvent("c2", { messageName: "Shared" })
            .endEvent("e")
            .build()

        expect(defs.messages).toHaveLength(1)
        const rootMsg = defs.messages[0]

        const c1 = defs.processes[0]?.flowElements.find((n) => n.id === "c1")
        const c2 = defs.processes[0]?.flowElements.find((n) => n.id === "c2")
        if (c1?.type === "intermediateCatchEvent" && c2?.type === "intermediateCatchEvent") {
            const def1 = c1.eventDefinitions[0]
            const def2 = c2.eventDefinitions[0]
            if (def1?.type === "message" && def2?.type === "message") {
                expect(def1.messageRef).toBe(rootMsg?.id)
                expect(def2.messageRef).toBe(rootMsg?.id)
            }
        }
    })

    it("no ref points at raw name string — all refs resolve to a declared root ID", () => {
        const defs = Bpmn.createProcess("proc")
            .startEvent("s")
            .intermediateThrowEvent("sig-throw", { signalName: "Sig1" })
            .intermediateCatchEvent("msg-catch", { messageName: "Msg1" })
            .intermediateThrowEvent("esc-throw", { escalationCode: "ESC_1" })
            .endEvent("e")
            .build()

        const allRootIds = new Set([
            ...defs.signals.map((s) => s.id),
            ...defs.messages.map((m) => m.id),
            ...defs.escalations.map((e) => e.id),
            ...defs.errors.map((e) => e.id),
        ])

        for (const el of defs.processes[0]?.flowElements ?? []) {
            const evDefs =
                el.type === "intermediateThrowEvent" ||
                el.type === "intermediateCatchEvent" ||
                el.type === "boundaryEvent"
                    ? el.eventDefinitions
                    : []
            for (const def of evDefs) {
                if (def.type === "signal" && def.signalRef) {
                    expect(allRootIds.has(def.signalRef)).toBe(true)
                }
                if (def.type === "message" && def.messageRef) {
                    expect(allRootIds.has(def.messageRef)).toBe(true)
                }
                if (def.type === "escalation" && def.escalationRef) {
                    expect(allRootIds.has(def.escalationRef)).toBe(true)
                }
                if (def.type === "error" && def.errorRef) {
                    expect(allRootIds.has(def.errorRef)).toBe(true)
                }
            }
        }
    })

    it("existing working case unchanged: messageName on startEvent emits root message", () => {
        const defs = Bpmn.createProcess("proc")
            .startEvent("s", { messageName: "webhook-trigger" })
            .endEvent("e")
            .build()

        expect(defs.messages).toHaveLength(1)
        expect(defs.messages[0]?.name).toBe("webhook-trigger")

        const start = defs.processes[0]?.flowElements.find((n) => n.id === "s")
        if (start?.type === "startEvent") {
            const def = start.eventDefinitions[0]
            if (def?.type === "message") {
                expect(def.messageRef).toBe(defs.messages[0]?.id)
            }
        }
    })

    it("existing working case unchanged: errorCode on boundaryEvent emits root error", () => {
        const defs = Bpmn.createProcess("proc")
            .startEvent("s")
            .serviceTask("task", { name: "T", taskType: "t" })
            .boundaryEvent("bnd", { attachedTo: "task", errorCode: "BOOM" })
            .endEvent("e")
            .build()

        expect(defs.errors).toHaveLength(1)
        expect(defs.errors[0]?.errorCode).toBe("BOOM")

        const ev = defs.processes[0]?.flowElements.find((n) => n.id === "bnd")
        if (ev?.type === "boundaryEvent") {
            const def = ev.eventDefinitions[0]
            if (def?.type === "error") {
                expect(def.errorRef).toBe(defs.errors[0]?.id)
            }
        }
    })
})
```

- [ ] **Step 5: Run tests to confirm all new tests fail**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm --filter @bpmnkit/core test -- --reporter=verbose 2>&1 | grep -E "FAIL|✗|×|event ref root" | head -20
```

Expected: all tests in `describe("event ref root declarations")` FAIL plus the 3 updated tests in "event definition values".

- [ ] **Step 6: Commit failing tests**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
git add packages/core/tests/bpmn-builder.test.ts
git commit -m "test(core): add failing tests for event ref root declarations

Tests cover all acceptance criteria from issue #113:
- intermediateThrowEvent/Catch with signalName, messageName, escalationCode
- boundaryEvent with signalName, messageName, errorRef
- de-duplication of roots for same name/code
- no ref points at raw name string"
```

---

### Task 2: Implement the fix in bpmn-builder.ts

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:240-288` (`buildEventDefinitions` function)
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:1105-1106` (`ProcessBuilder` fields)
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:1176` (`startEvent` call)
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:1218` (`endEvent` call)
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:1229` (`intermediateThrowEvent` call)
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:1240` (`intermediateCatchEvent` call)
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:1257` (`boundaryEvent` call)
- Modify: `packages/core/src/bpmn/bpmn-builder.ts:1726-1729` (`build()` method)

**Interfaces:**
- Consumes: `BpmnSignal`, `BpmnEscalation` from `bpmn-model.ts` (already imported)
- Produces: correct `BpmnDefinitions` with populated `signals` and `escalations` arrays

---

- [ ] **Step 1: Add `rootSignals` and `rootEscalations` fields to `ProcessBuilder`**

Find the two lines (around 1105-1106):
```typescript
private readonly rootErrors: BpmnError[] = []
private readonly rootMessages: BpmnMessage[] = []
```

Change to:
```typescript
private readonly rootErrors: BpmnError[] = []
private readonly rootMessages: BpmnMessage[] = []
private readonly rootSignals: BpmnSignal[] = []
private readonly rootEscalations: BpmnEscalation[] = []
```

- [ ] **Step 2: Update the `buildEventDefinitions` function signature and body**

Replace the entire `buildEventDefinitions` function (lines 240-288):

```typescript
function buildEventDefinitions(
	opts: {
		timerDuration?: string
		timerDate?: string
		timerCycle?: string
		errorCode?: string
		errorRef?: string
		messageName?: string
		signalName?: string
		escalationCode?: string
	},
	rootErrors?: BpmnError[],
	rootMessages?: BpmnMessage[],
	rootSignals?: BpmnSignal[],
	rootEscalations?: BpmnEscalation[],
): BpmnEventDefinition[] {
	const defs: BpmnEventDefinition[] = []
	if (opts.timerDuration || opts.timerDate || opts.timerCycle) {
		defs.push({
			type: "timer",
			timeDuration: opts.timerDuration,
			timeDate: opts.timerDate,
			timeCycle: opts.timerCycle,
		})
	}
	if (opts.errorCode !== undefined || opts.errorRef !== undefined) {
		const codeOrRef = opts.errorCode ?? opts.errorRef
		let errorRef: string | undefined
		if (codeOrRef !== undefined && rootErrors) {
			let existing = rootErrors.find((e) => e.errorCode === codeOrRef || e.name === codeOrRef)
			if (!existing) {
				existing = { id: generateId("Error"), name: codeOrRef, errorCode: codeOrRef }
				rootErrors.push(existing)
			}
			errorRef = existing.id
		} else {
			errorRef = opts.errorRef
		}
		defs.push({ type: "error", errorRef })
	}
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
	if (opts.signalName !== undefined) {
		let signalRef: string | undefined = opts.signalName
		if (rootSignals) {
			let existing = rootSignals.find((s) => s.name === opts.signalName)
			if (!existing) {
				existing = { id: generateId("Signal"), name: opts.signalName }
				rootSignals.push(existing)
			}
			signalRef = existing.id
		}
		defs.push({ type: "signal", signalRef })
	}
	if (opts.escalationCode !== undefined) {
		let escalationRef: string | undefined = opts.escalationCode
		if (rootEscalations) {
			let existing = rootEscalations.find((e) => e.escalationCode === opts.escalationCode)
			if (!existing) {
				existing = {
					id: generateId("Escalation"),
					name: opts.escalationCode,
					escalationCode: opts.escalationCode,
				}
				rootEscalations.push(existing)
			}
			escalationRef = existing.id
		}
		defs.push({ type: "escalation", escalationRef })
	}
	return defs
}
```

- [ ] **Step 3: Thread root arrays through all event methods in `ProcessBuilder`**

Update `startEvent` call (around line 1176) from:
```typescript
element.eventDefinitions = buildEventDefinitions(options, this.rootErrors, this.rootMessages)
```
to:
```typescript
element.eventDefinitions = buildEventDefinitions(options, this.rootErrors, this.rootMessages, this.rootSignals, this.rootEscalations)
```

Update `endEvent` call (around line 1218) from:
```typescript
element.eventDefinitions = buildEventDefinitions(options, this.rootErrors, this.rootMessages)
```
to:
```typescript
element.eventDefinitions = buildEventDefinitions(options, this.rootErrors, this.rootMessages, this.rootSignals, this.rootEscalations)
```

Update `intermediateThrowEvent` call (around line 1229) from:
```typescript
element.eventDefinitions = buildEventDefinitions(options)
```
to:
```typescript
element.eventDefinitions = buildEventDefinitions(options, this.rootErrors, this.rootMessages, this.rootSignals, this.rootEscalations)
```

Update `intermediateCatchEvent` call (around line 1240) from:
```typescript
element.eventDefinitions = buildEventDefinitions(options)
```
to:
```typescript
element.eventDefinitions = buildEventDefinitions(options, this.rootErrors, this.rootMessages, this.rootSignals, this.rootEscalations)
```

Update `boundaryEvent` call (around line 1257) from:
```typescript
element.eventDefinitions = buildEventDefinitions(options, this.rootErrors, this.rootMessages)
```
to:
```typescript
element.eventDefinitions = buildEventDefinitions(options, this.rootErrors, this.rootMessages, this.rootSignals, this.rootEscalations)
```

- [ ] **Step 4: Fix `build()` to emit `rootSignals` and `rootEscalations`**

Find in `build()` (around lines 1727-1729):
```typescript
errors: this.rootErrors,
escalations: [],
messages: this.rootMessages,
signals: [],
```

Change to:
```typescript
errors: this.rootErrors,
escalations: this.rootEscalations,
messages: this.rootMessages,
signals: this.rootSignals,
```

- [ ] **Step 5: Run typecheck**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm --filter @bpmnkit/core exec tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 6: Run linter**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm biome check packages/core/src/bpmn/bpmn-builder.ts 2>&1
```

Expected: zero errors or warnings.

- [ ] **Step 7: Run tests**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm --filter @bpmnkit/core test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 8: Commit the implementation**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
git add packages/core/src/bpmn/bpmn-builder.ts
git commit -m "fix(core): emit root declarations for all event name/code refs

- Add rootSignals and rootEscalations tracking arrays to ProcessBuilder
- buildEventDefinitions now creates root <bpmn:signal/escalation> elements
  and de-duplicates all root types (signal, message, escalation, error)
- errorRef treated same as errorCode: always emits a root <bpmn:error>
- Thread all 4 root arrays through intermediateThrowEvent, intermediateCatchEvent,
  boundaryEvent, endEvent, and startEvent
- build() now outputs rootSignals and rootEscalations instead of []

Fixes dangling signalRef/messageRef/escalationRef/errorRef in exported XML
that caused bpmnlint 'unresolved reference' errors and Camunda 8 deployment
failures on intermediate and boundary events."
```

---

### Task 3: Update docs

**Files:**
- Modify: `packages/core/doc/progress.md`

**Interfaces:**
- Consumes: nothing
- Produces: updated changelog entry

- [ ] **Step 1: Prepend a new entry to `packages/core/doc/progress.md`**

Add after the `# Progress` heading:

```markdown
## 2026-06-28 — Builder: emit root declarations for all event name/code refs

All event positions (`intermediateThrowEvent`, `intermediateCatchEvent`, `boundaryEvent`, `endEvent`, `startEvent`) now consistently emit root `<bpmn:signal>`, `<bpmn:message>`, `<bpmn:escalation>`, and `<bpmn:error>` elements under `<bpmn:definitions>` whenever a name/code ref option is set. Previously, intermediate and boundary events wrote the raw name/code string directly into `signalRef`/`messageRef`/`escalationRef`, producing dangling references rejected by `bpmnlint` and Camunda 8. Roots are de-duplicated: two events sharing the same `signalName` resolve to one `<bpmn:signal>` element. The `errorRef` option now creates a root error element (consistent with `errorCode`).
```

- [ ] **Step 2: Commit**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
git add packages/core/doc/progress.md
git commit -m "docs(core): log event ref root declarations fix in progress"
```

---

## Self-Review

**Spec coverage:**
- `intermediateThrowEvent({ signalName })` → Task 1 test + Task 2 fix ✓
- `intermediateCatchEvent({ messageName })` → Task 1 test + Task 2 fix ✓
- `intermediateCatchEvent({ signalName })` → Task 1 test + Task 2 fix ✓
- `boundaryEvent({ signalName })` → Task 1 test + Task 2 fix ✓
- `boundaryEvent({ messageName })` → Task 1 test + Task 2 fix ✓
- `intermediateThrowEvent({ escalationCode })` → Task 1 test + Task 2 fix ✓
- `boundaryEvent({ errorRef })` → Task 1 test + Task 2 fix ✓
- De-duplication by name/code → Task 1 de-dup tests + Task 2 find-before-push logic ✓
- Existing working cases unchanged → Task 1 regression tests ✓
- No ref points at raw string → Task 1 "no ref points at raw name string" test ✓

**Placeholder scan:** No TBD, no "add appropriate error handling", all code blocks are complete. ✓

**Type consistency:**
- `rootSignals: BpmnSignal[]` added in Step 2.1, used in Step 2.3 as `this.rootSignals` ✓
- `rootEscalations: BpmnEscalation[]` added in Step 2.1, used in Step 2.3 as `this.rootEscalations` ✓
- `buildEventDefinitions` new params are optional so `BranchBuilder`/`SubProcessContentBuilder` calls (which omit them) stay valid ✓
- `defs.signals` and `defs.escalations` used in tests — both are arrays on `BpmnDefinitions` ✓
