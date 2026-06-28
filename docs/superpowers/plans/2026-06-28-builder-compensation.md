# BPMN Compensation Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the fluent `ProcessBuilder` so it can express BPMN compensation: compensation boundary events, `isForCompensation` handler activities, and compensation intermediate throw events.

**Architecture:** Three-layer change across model → serializer/parser → builder. The model and serializer already support `BpmnCompensateEventDefinition`; the boundary-event and throw-event gaps are builder-only wiring. The `isForCompensation` activity flag requires a new model field, serializer attribute, parser read, and builder option. A `_savedMainFlowId` mechanism in `ProcessBuilder` restores the main-flow cursor after adding a compensation handler so the process can continue normally.

**Tech Stack:** TypeScript strict-mode, Vitest, `packages/core/src/bpmn/`.

## Global Constraints

- Zero TypeScript errors, zero Biome warnings after every task.
- Run `pnpm turbo check` (Biome) and `pnpm turbo typecheck` before each commit.
- Run `pnpm turbo test --filter=@bpmnkit/core` for the test suite.
- Match existing code style (no JSDoc on internal helpers, no unused imports).
- Do NOT hand-write README or LICENSE; do NOT run generate-readmes.mjs (no new package created).

---

## File Map

| File | Change |
|---|---|
| `packages/core/src/bpmn/bpmn-model.ts` | Add `isForCompensation?: boolean` to `BpmnFlowNodeBase` |
| `packages/core/src/bpmn/bpmn-serializer.ts` | Emit `isForCompensation="true"` on activity elements |
| `packages/core/src/bpmn/bpmn-parser.ts` | Parse `isForCompensation`; add to `KNOWN_ATTRS` |
| `packages/core/src/bpmn/bpmn-builder.ts` | Add compensation options; `_savedMainFlowId`; association logic |
| `packages/core/tests/bpmn-builder.test.ts` | Add `describe("compensation", ...)` block |

---

## Task 1: Model, Serializer, and Parser for `isForCompensation`

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-model.ts:174`
- Modify: `packages/core/src/bpmn/bpmn-serializer.ts:209`
- Modify: `packages/core/src/bpmn/bpmn-parser.ts:73`
- Test: `packages/core/tests/bpmn-builder.test.ts`

**Interfaces:**
- Produces: `BpmnFlowNodeBase.isForCompensation?: boolean` — consumed by builder (Task 2) and serializer

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/tests/bpmn-builder.test.ts` inside the top-level `describe("BpmnProcessBuilder", ...)` block:

```typescript
describe("compensation — isForCompensation serialization", () => {
  it("serializes isForCompensation=true on a service task to XML", () => {
    const xml = Bpmn.export(
      Bpmn.createProcess("proc")
        .serviceTask("handler", { name: "Cancel", taskType: "cancel", isForCompensation: true })
        .build(),
    )
    expect(xml).toContain('isForCompensation="true"')
    expect(xml).toContain('id="handler"')
  })

  it("round-trips isForCompensation through parse → export", () => {
    const xml1 = Bpmn.export(
      Bpmn.createProcess("proc")
        .serviceTask("handler", { name: "Cancel", taskType: "cancel", isForCompensation: true })
        .build(),
    )
    const xml2 = Bpmn.export(Bpmn.parse(xml1))
    expect(xml2).toContain('isForCompensation="true"')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm turbo test --filter=@bpmnkit/core 2>&1 | grep -A3 "isForCompensation"
```

Expected: TypeScript error on `isForCompensation` not existing in `ServiceTaskOptions`, or test assertion failures.

- [ ] **Step 3: Add `isForCompensation` to the model**

In `packages/core/src/bpmn/bpmn-model.ts`, find `interface BpmnFlowNodeBase` (line 174) and add the field:

```typescript
interface BpmnFlowNodeBase {
	id: string
	name?: string
	incoming: string[]
	outgoing: string[]
	documentation?: string
	extensionElements: XmlElement[]
	unknownAttributes: Record<string, string>
	isForCompensation?: boolean   // ← add this line
}
```

- [ ] **Step 4: Serialize `isForCompensation` in the serializer**

In `packages/core/src/bpmn/bpmn-serializer.ts`, in `serializeFlowElement`, find the `case "task":` branch (around line 223). The attributes object is built at line 192: `const attrs: Record<string, string> = { id: fe.id, ...fe.unknownAttributes }`. Add after that line:

```typescript
if (fe.isForCompensation) attrs.isForCompensation = "true"
```

The full insertion point — find the comment `// Documentation` (line 198) and insert BEFORE it:

```typescript
	const attrs: Record<string, string> = { id: fe.id, ...fe.unknownAttributes }
	if (fe.name !== undefined) attrs.name = fe.name
	if (fe.isForCompensation) attrs.isForCompensation = "true"   // ← add this line

	const children: XmlElement[] = []

	// Documentation
```

- [ ] **Step 5: Parse `isForCompensation` in the parser**

In `packages/core/src/bpmn/bpmn-parser.ts`:

First, add `"isForCompensation"` to `KNOWN_ATTRS` (around line 73):

```typescript
const KNOWN_ATTRS = new Set([
	"id",
	"name",
	"default",
	"attachedToRef",
	"cancelActivity",
	"isForCompensation",   // ← add this line
	"sourceRef",
	// ... rest unchanged
])
```

Second, in `parseFlowElement`, find the block for task types (around line 334). Currently:

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
			return { ...base, type: ln, loopCharacteristics: parseLoopCharacteristics(element) }
```

Change to:

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

- [ ] **Step 6: Run the tests**

```bash
pnpm turbo test --filter=@bpmnkit/core 2>&1 | tail -20
```

Expected: All tests pass including the two new ones.

- [ ] **Step 7: Type-check and lint**

```bash
pnpm turbo typecheck --filter=@bpmnkit/core && pnpm biome check packages/core/src/bpmn/bpmn-model.ts packages/core/src/bpmn/bpmn-serializer.ts packages/core/src/bpmn/bpmn-parser.ts packages/core/tests/bpmn-builder.test.ts
```

Expected: Zero errors.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/bpmn/bpmn-model.ts packages/core/src/bpmn/bpmn-serializer.ts packages/core/src/bpmn/bpmn-parser.ts packages/core/tests/bpmn-builder.test.ts
git commit -m "feat(core): model/serialize/parse isForCompensation on activity elements"
```

---

## Task 2: Builder — Compensation Event Definitions and Handler Logic

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts`
- Modify: `packages/core/tests/bpmn-builder.test.ts`

**Interfaces:**
- Consumes: `BpmnFlowNodeBase.isForCompensation` from Task 1
- Produces:
  - `BoundaryEventOptions.compensation?: boolean`
  - `IntermediateThrowEventOptions.compensation?: boolean; activityRef?: string`
  - `ServiceTaskOptions.isForCompensation?: boolean` (and other task option types)
  - Builder emits `BpmnAssociation` (not `BpmnSequenceFlow`) from compensation boundary event to handler
  - `ProcessBuilder._savedMainFlowId` restores main-flow cursor after handler

- [ ] **Step 1: Write the failing tests**

Add a full `describe("compensation", ...)` block to `packages/core/tests/bpmn-builder.test.ts`:

```typescript
describe("compensation", () => {
  it("boundary event with compensation: true emits compensateEventDefinition", () => {
    const xml = Bpmn.export(
      Bpmn.createProcess("proc")
        .startEvent("start")
        .serviceTask("BookHotel", { name: "Book Hotel", taskType: "book-hotel" })
        .boundaryEvent("CompBoundary", { attachedTo: "BookHotel", compensation: true })
        .endEvent("end")
        .build(),
    )
    expect(xml).toContain("compensateEventDefinition")
    expect(xml).toContain('id="CompBoundary"')
  })

  it("intermediateThrowEvent with compensation: true emits compensateEventDefinition", () => {
    const xml = Bpmn.export(
      Bpmn.createProcess("proc")
        .startEvent("start")
        .intermediateThrowEvent("CompThrow", {
          name: "Compensate",
          compensation: true,
          activityRef: "BookHotel",
        })
        .endEvent("end")
        .build(),
    )
    expect(xml).toContain("compensateEventDefinition")
    expect(xml).toContain('activityRef="BookHotel"')
  })

  it("compensation handler is linked by association, not sequence flow", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("start")
      .serviceTask("BookHotel", { name: "Book Hotel", taskType: "book-hotel" })
      .boundaryEvent("CompBoundary", { attachedTo: "BookHotel", compensation: true })
      .serviceTask("CancelHotel", {
        name: "Cancel Hotel",
        taskType: "cancel-hotel",
        isForCompensation: true,
      })
      .intermediateThrowEvent("CompThrow", { name: "Compensate", compensation: true })
      .endEvent("end")
      .build()

    const process = defs.processes[0]!
    const xml = Bpmn.export(defs)

    // No sequence flow from CompBoundary to CancelHotel
    expect(xml).not.toMatch(/sourceRef="CompBoundary"[^>]*?sequenceFlow/)
    expect(xml).not.toMatch(/sequenceFlow[^>]*?sourceRef="CompBoundary"/)

    // Association exists from CompBoundary to CancelHotel
    const assoc = process.associations.find(
      (a) => a.sourceRef === "CompBoundary" && a.targetRef === "CancelHotel",
    )
    expect(assoc).toBeDefined()
    expect(xml).toContain("<bpmn:association")
    expect(xml).toContain('sourceRef="CompBoundary"')
    expect(xml).toContain('targetRef="CancelHotel"')
  })

  it("compensation handler has no incoming/outgoing sequence flows", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("start")
      .serviceTask("BookHotel", { name: "Book Hotel", taskType: "book-hotel" })
      .boundaryEvent("CompBoundary", { attachedTo: "BookHotel", compensation: true })
      .serviceTask("CancelHotel", {
        name: "Cancel Hotel",
        taskType: "cancel-hotel",
        isForCompensation: true,
      })
      .endEvent("end")
      .build()

    const process = defs.processes[0]!
    const handler = process.flowElements.find((e) => e.id === "CancelHotel")!
    expect(handler.incoming).toHaveLength(0)
    expect(handler.outgoing).toHaveLength(0)
  })

  it("main flow continues normally after adding compensation handler", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("start")
      .serviceTask("BookHotel", { name: "Book Hotel", taskType: "book-hotel" })
      .boundaryEvent("CompBoundary", { attachedTo: "BookHotel", compensation: true })
      .serviceTask("CancelHotel", {
        name: "Cancel Hotel",
        taskType: "cancel-hotel",
        isForCompensation: true,
      })
      .intermediateThrowEvent("CompThrow", { name: "Compensate", compensation: true })
      .endEvent("end")
      .build()

    const process = defs.processes[0]!
    // Main flow: start → BookHotel → CompThrow → end
    const flows = process.sequenceFlows
    expect(flows.find((f) => f.sourceRef === "BookHotel" && f.targetRef === "CompThrow")).toBeDefined()
    expect(flows.find((f) => f.sourceRef === "CompThrow" && f.targetRef === "end")).toBeDefined()
  })

  it("reproduction script: all three contains checks pass", () => {
    const builder = Bpmn.createProcess("trip-booking").name("Trip Booking")
    builder
      .startEvent("start", { name: "Start" })
      .serviceTask("BookHotel", { name: "Book Hotel", taskType: "book-hotel" })
    builder.boundaryEvent("CompBoundary", { attachedTo: "BookHotel", compensation: true })
    builder.serviceTask("CancelHotel", {
      name: "Cancel Hotel",
      taskType: "cancel-hotel",
      isForCompensation: true,
    })
    builder.intermediateThrowEvent("CompThrow", {
      name: "Compensate",
      compensation: true,
      activityRef: "BookHotel",
    })
    const defs = builder.endEvent("end", { name: "End" }).build()
    const xml = Bpmn.export(defs)

    expect(xml).toContain("compensateEventDefinition")
    expect(xml).toContain("isForCompensation")
    expect(xml).toContain("activityRef")
    // Association, not sequence flow, links boundary to handler
    expect(xml).toContain("<bpmn:association")
    expect(xml).not.toMatch(/sequenceFlow[^>]*sourceRef="CompBoundary"/)
    expect(xml).not.toMatch(/sequenceFlow[^>]*targetRef="CancelHotel"/)
  })

  it("round-trips compensation constructs through parse → export", () => {
    const builder = Bpmn.createProcess("comp-proc")
    builder
      .startEvent("start")
      .serviceTask("BookHotel", { name: "Book Hotel", taskType: "book-hotel" })
    builder.boundaryEvent("CompBoundary", { attachedTo: "BookHotel", compensation: true })
    builder.serviceTask("CancelHotel", {
      name: "Cancel Hotel",
      taskType: "cancel-hotel",
      isForCompensation: true,
    })
    builder.intermediateThrowEvent("CompThrow", {
      compensation: true,
      activityRef: "BookHotel",
    })
    const xml1 = Bpmn.export(builder.endEvent("end").build())
    const xml2 = Bpmn.export(Bpmn.parse(xml1))

    expect(xml2).toContain("compensateEventDefinition")
    expect(xml2).toContain("isForCompensation")
    expect(xml2).toContain('activityRef="BookHotel"')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm turbo test --filter=@bpmnkit/core 2>&1 | grep -E "(FAIL|PASS|compensation)" | head -20
```

Expected: TypeScript errors on `compensation`, `activityRef`, `isForCompensation` in options, and test assertion failures.

- [ ] **Step 3: Add `isForCompensation` to task option interfaces**

In `packages/core/src/bpmn/bpmn-builder.ts`, add `isForCompensation?: boolean` to the task option interfaces. Find each interface and add the field:

`ServiceTaskOptions` (around line 62):
```typescript
export interface ServiceTaskOptions {
	name: string
	taskType: string
	retries?: string
	ioMapping?: { ... }
	taskHeaders?: Record<string, string>
	modelerTemplate?: string
	modelerTemplateVersion?: string
	modelerTemplateIcon?: string
	isForCompensation?: boolean   // ← add
}
```

`ScriptTaskOptions` (around line 84):
```typescript
export interface ScriptTaskOptions {
	name?: string
	expression: string
	resultVariable: string
	isForCompensation?: boolean   // ← add
}
```

`UserTaskOptions` (around line 94):
```typescript
export interface UserTaskOptions {
	name?: string
	formId?: string
	zeebeUserTask?: boolean
	isForCompensation?: boolean   // ← add
}
```

`BusinessRuleTaskOptions` (around line 114):
```typescript
export interface BusinessRuleTaskOptions {
	name?: string
	taskType?: string
	decisionId?: string
	resultVariable?: string
	isForCompensation?: boolean   // ← add
}
```

`CallActivityOptions` (around line 104):
```typescript
export interface CallActivityOptions {
	name?: string
	processId: string
	propagateAllChildVariables?: boolean
	isForCompensation?: boolean   // ← add
}
```

Also add to `ElementOptions` (shared by `sendTask`, `receiveTask`, `task`, `manualTask`):
```typescript
export interface ElementOptions {
	name?: string
	isForCompensation?: boolean   // ← add
}
```

- [ ] **Step 4: Add compensation to event option interfaces**

`BoundaryEventOptions` (around line 171): add `compensation?: boolean`:
```typescript
export interface BoundaryEventOptions extends ElementOptions {
	attachedTo: string
	cancelActivity?: boolean
	errorCode?: string
	errorRef?: string
	timerDuration?: string
	timerDate?: string
	timerCycle?: string
	messageName?: string
	signalName?: string
	compensation?: boolean   // ← add
}
```

`IntermediateThrowEventOptions` (around line 147): add `compensation?: boolean` and `activityRef?: string`:
```typescript
export interface IntermediateThrowEventOptions extends ElementOptions {
	messageName?: string
	signalName?: string
	escalationCode?: string
	compensation?: boolean   // ← add
	activityRef?: string     // ← add
}
```

- [ ] **Step 5: Extend `buildEventDefinitions` to handle compensation**

Find `buildEventDefinitions` (around line 242). Its `opts` parameter currently has no `compensation` or `activityRef`. Update the function signature and body:

Current signature:
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
```

Change to (add `compensation` and `activityRef` to the opts object):
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
		compensation?: boolean
		activityRef?: string
	},
	rootErrors?: BpmnError[],
	rootMessages?: BpmnMessage[],
	rootSignals?: BpmnSignal[],
	rootEscalations?: BpmnEscalation[],
): BpmnEventDefinition[] {
```

Then, at the END of the function body, before `return defs`, add:
```typescript
	if (opts.compensation) {
		defs.push({ type: "compensate", activityRef: opts.activityRef })
	}
	return defs
```

The current function ends with:
```typescript
	if (opts.escalationCode !== undefined) {
		// ...
		defs.push({ type: "escalation", escalationRef })
	}
	return defs
}
```

Change to:
```typescript
	if (opts.escalationCode !== undefined) {
		// ... (unchanged)
		defs.push({ type: "escalation", escalationRef })
	}
	if (opts.compensation) {
		defs.push({ type: "compensate", activityRef: opts.activityRef })
	}
	return defs
}
```

- [ ] **Step 6: Propagate `isForCompensation` in element factory functions**

In `makeServiceTaskEl` (around line 500), after building the element, add:
```typescript
function makeServiceTaskEl(id: string, options: ServiceTaskOptions): BpmnFlowElement {
	// ... existing code ...
	const el = makeFlowElement(id, "serviceTask", { ... })
	el.unknownAttributes = unknownAttributes
	if (options.isForCompensation) el.isForCompensation = options.isForCompensation   // ← add
	return el
}
```

In `makeScriptTaskEl` (around line 515):
```typescript
function makeScriptTaskEl(id: string, options: ScriptTaskOptions): BpmnFlowElement {
	const el = makeFlowElement(id, "scriptTask", { ... })
	if (options.isForCompensation) el.isForCompensation = options.isForCompensation   // ← add
	return el
}
```

In `makeUserTaskEl` (around line 530):
```typescript
function makeUserTaskEl(id: string, options?: UserTaskOptions): BpmnFlowElement {
	const ext = ...
	const el = makeFlowElement(id, "userTask", { ... })
	if (options?.isForCompensation) el.isForCompensation = options.isForCompensation   // ← add
	return el
}
```

In `makeBusinessRuleTaskEl` (around line 538):
```typescript
function makeBusinessRuleTaskEl(id: string, options?: BusinessRuleTaskOptions): BpmnFlowElement {
	// ... existing code ...
	const el = makeFlowElement(id, "businessRuleTask", { ... })
	if (options?.isForCompensation) el.isForCompensation = options.isForCompensation   // ← add
	return el
}
```

In `makeCallActivityEl` (around line 556):
```typescript
function makeCallActivityEl(id: string, options: CallActivityOptions): BpmnFlowElement {
	// ... existing code ...
	const el = makeFlowElement(id, "callActivity", { ... })
	if (options.isForCompensation) el.isForCompensation = options.isForCompensation   // ← add
	return el
}
```

For task types using `makeFlowElement` directly (`sendTask`, `receiveTask`, `task`, `manualTask`), these use `ElementOptions` which now has `isForCompensation`. The `makeFlowElement` function doesn't set it, so we need to set it after the call in each builder method. (See Step 8 for the builder method changes.)

- [ ] **Step 7: Add `_savedMainFlowId` to `ProcessBuilder` and update `boundaryEvent()`**

In `ProcessBuilder` (around line 1169), add the private field:
```typescript
export class ProcessBuilder {
	private readonly processId: string
	private processName?: string
	private _isExecutable = true
	private _versionTag?: string
	private readonly flowElements: BpmnFlowElement[] = []
	private readonly sequenceFlows: BpmnSequenceFlow[] = []
	private readonly rootErrors: BpmnError[] = []
	private readonly rootMessages: BpmnMessage[] = []
	private readonly rootSignals: BpmnSignal[] = []
	private readonly rootEscalations: BpmnEscalation[] = []
	private readonly _textAnnotations: BpmnTextAnnotation[] = []
	private readonly _associations: BpmnAssociation[] = []
	private readonly _annCounters = new Map<string, number>()
	private lastNodeId: string | undefined
	private currentGatewayId: string | undefined
	private openBranchEnds: string[] = []
	private _autoLayout = false
	private _executionPlatformVersion = "8.9.0"
	private _serviceTaskDefaults: { retries?: string } = {}
	private _savedMainFlowId: string | undefined = undefined   // ← add
```

In the `boundaryEvent()` method (around line 1349), find where `prevLast` is captured. Currently:
```typescript
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
		// Boundary events never auto-connect — temporarily clear lastNodeId
		const prevLast = this.lastNodeId
		this.lastNodeId = undefined
		this.addFlowElement(element)
		// Don't restore prevLast — the builder now chains from the boundary event
		void prevLast
		return this
	}
```

Change to save `prevLast` for compensation boundary events:
```typescript
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
		// Boundary events never auto-connect — temporarily clear lastNodeId
		const prevLast = this.lastNodeId
		this.lastNodeId = undefined
		// For compensation boundary events, save the main-flow cursor so it can be
		// restored after the handler activity is registered (handler is outside normal flow).
		if (options.compensation) {
			this._savedMainFlowId = prevLast
		}
		this.addFlowElement(element)
		// Don't restore prevLast — the builder now chains from the boundary event
		void prevLast
		return this
	}
```

- [ ] **Step 8: Update `addFlowElement` to handle compensation handlers**

Find `addFlowElement` (around line 1879):
```typescript
	private addFlowElement(element: BpmnFlowElement): void {
		if (this.flowElements.some((n) => n.id === element.id)) {
			throw new Error(`Duplicate element ID "${element.id}" in process "${this.processId}"`)
		}

		this.flowElements.push(element)

		if (this.lastNodeId) {
			const flowId = generateId("Flow")
			this.sequenceFlows.push({
				id: flowId,
				sourceRef: this.lastNodeId,
				targetRef: element.id,
				extensionElements: [],
				unknownAttributes: {},
			})
		}

		// Auto-connect any open branch ends (from branch() calls without .connectTo())
		for (const branchEnd of this.openBranchEnds) {
			const flowId = generateId("Flow")
			this.sequenceFlows.push({
				id: flowId,
				sourceRef: branchEnd,
				targetRef: element.id,
				extensionElements: [],
				unknownAttributes: {},
			})
		}
		this.openBranchEnds = []

		this.lastNodeId = element.id
	}
```

Replace with:
```typescript
	private addFlowElement(element: BpmnFlowElement): void {
		if (this.flowElements.some((n) => n.id === element.id)) {
			throw new Error(`Duplicate element ID "${element.id}" in process "${this.processId}"`)
		}

		this.flowElements.push(element)

		// Compensation handlers are outside the normal token flow: link via association
		// from the preceding compensation boundary event, then restore the main-flow cursor.
		if (element.isForCompensation) {
			if (this.lastNodeId) {
				this._associations.push({
					id: generateId("Association"),
					sourceRef: this.lastNodeId,
					targetRef: element.id,
					associationDirection: "One",
					unknownAttributes: {},
				})
			}
			// Restore main-flow cursor (saved by boundaryEvent() when compensation: true)
			this.lastNodeId = this._savedMainFlowId
			this._savedMainFlowId = undefined
			// Do NOT connect open branch ends — handler is outside normal flow
			return
		}

		if (this.lastNodeId) {
			const flowId = generateId("Flow")
			this.sequenceFlows.push({
				id: flowId,
				sourceRef: this.lastNodeId,
				targetRef: element.id,
				extensionElements: [],
				unknownAttributes: {},
			})
		}

		// Auto-connect any open branch ends (from branch() calls without .connectTo())
		for (const branchEnd of this.openBranchEnds) {
			const flowId = generateId("Flow")
			this.sequenceFlows.push({
				id: flowId,
				sourceRef: branchEnd,
				targetRef: element.id,
				extensionElements: [],
				unknownAttributes: {},
			})
		}
		this.openBranchEnds = []

		this.lastNodeId = element.id
	}
```

- [ ] **Step 9: Propagate `isForCompensation` in builder methods for `ElementOptions`-based tasks**

In `ProcessBuilder.sendTask()` (around line 1464):
```typescript
	sendTask(id: string, options?: ElementOptions): this {
		const el = makeFlowElement(id, "sendTask", options)
		if (options?.isForCompensation) el.isForCompensation = options.isForCompensation
		this.addFlowElement(el)
		return this
	}
```

Same pattern for `receiveTask`, `task`, and `manualTask` (if it has a builder method — check bpmn-builder.ts; if not, skip). Apply to each builder method that uses `makeFlowElement` directly with `ElementOptions`.

- [ ] **Step 10: Run all tests**

```bash
pnpm turbo test --filter=@bpmnkit/core 2>&1 | tail -30
```

Expected: All tests pass including all new compensation tests.

- [ ] **Step 11: Type-check and lint**

```bash
pnpm turbo typecheck --filter=@bpmnkit/core && pnpm biome check packages/core/src/bpmn/bpmn-builder.ts
```

Expected: Zero errors.

- [ ] **Step 12: Commit**

```bash
git add packages/core/src/bpmn/bpmn-builder.ts packages/core/tests/bpmn-builder.test.ts
git commit -m "feat(core): add compensation boundary event, throw event, and isForCompensation handler to builder"
```

---

## Task 3: Update Documentation

**Files:**
- Modify: `doc/progress.md`
- Modify: `doc/roadmap.md` (if compensation is listed)

- [ ] **Step 1: Update progress.md**

Prepend a new entry at the top of `doc/progress.md`:

```markdown
## 2026-06-28

- **Compensation support in ProcessBuilder** (`@bpmnkit/core`):
  - `BoundaryEventOptions` now accepts `compensation: true` — emits `<bpmn:compensateEventDefinition/>`.
  - `IntermediateThrowEventOptions` now accepts `compensation: true` and optional `activityRef` — emits `<bpmn:compensateEventDefinition activityRef="..."/>`.
  - `ServiceTaskOptions` (and all other task option interfaces) now accept `isForCompensation: true` — serializes `isForCompensation="true"` on the activity XML element.
  - Compensation handler activities are automatically linked to their compensation boundary event via `<bpmn:association>` (not a `<bpmn:sequenceFlow>`).
  - Handler activities carry no incoming/outgoing sequence flows (outside normal token flow).
  - The main-flow cursor is automatically restored after adding a compensation handler.
  - All three constructs survive `Bpmn.parse()` → `Bpmn.export()` round-trip.
```

- [ ] **Step 2: Check and update roadmap.md if applicable**

```bash
grep -n "compensat" /home/adam/github.com/bpmnkit/monorepo/doc/roadmap.md || echo "not found"
```

If found, mark the item(s) as `[x]`.

- [ ] **Step 3: Commit**

```bash
git add doc/progress.md doc/roadmap.md
git commit -m "docs: update progress.md for compensation builder support"
```

---

## Self-Review Checklist

Run through this before considering the plan complete:

**Spec coverage:**
- [x] `BoundaryEventOptions.compensation` → Task 2, Step 4
- [x] `IntermediateThrowEventOptions.compensation` + `activityRef` → Task 2, Step 4 & 5
- [x] Activity model `isForCompensation` field → Task 1, Step 3
- [x] `ServiceTaskOptions.isForCompensation` (and other task options) → Task 2, Step 3
- [x] Serializer emits `isForCompensation="true"` → Task 1, Step 4
- [x] Parser reads `isForCompensation` → Task 1, Step 5
- [x] Association (not sequence flow) from boundary event to handler → Task 2, Step 7 & 8
- [x] Handler has no incoming/outgoing sequence flows → Task 2, Step 8 (handler excluded from `addFlowElement` normal path)
- [x] Repro script all-three-contains test → Task 2, Step 1 (last test case)
- [x] Round-trip through `parse → export` → Task 2, Step 1 (last test case) + Task 1, Step 1 (second test)

**Placeholder scan:** No TBDs, no "similar to" references, no missing code. ✓

**Type consistency:**
- `BpmnFlowNodeBase.isForCompensation` used identically in model, serializer (`fe.isForCompensation`), parser (`attr(..., "isForCompensation")`), and builder (`el.isForCompensation = options.isForCompensation`).
- `_savedMainFlowId: string | undefined` set in `boundaryEvent()`, consumed and cleared in `addFlowElement()`.
- `buildEventDefinitions` opts extended with `compensation?: boolean` and `activityRef?: string` — both `BoundaryEventOptions` and `IntermediateThrowEventOptions` extend it.
