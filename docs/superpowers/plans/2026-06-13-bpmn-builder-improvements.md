# BPMN Builder SDK Improvements Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate copy-paste across builder classes, add sub-process branching, improve boundary event ergonomics, add build-time validation, add multi-process support, and add task defaults.

**Architecture:** All changes are in `packages/core/src/bpmn/bpmn-builder.ts` (1630 lines). Tasks are ordered by dependency: Task 1 extracts shared factories (prerequisite for Tasks 2–4), Tasks 3–7 are independently additive. No existing public APIs are removed — all changes are additive or pure refactors.

**Tech Stack:** TypeScript strict, Vitest, `@bpmnkit/core` package, pnpm workspaces.

---

## Context

`bpmn-builder.ts` has three builder classes — `ProcessBuilder`, `BranchBuilder`, `SubProcessContentBuilder` — that all duplicate the same task-element creation logic (~300 lines of copy-paste). `SubProcessContentBuilder` has no gateway or branching support, making it impossible to model decision logic inside sub-processes. There is no build-time validation of flow references, and boundary event ergonomics require string-based forward references. See: `packages/core/src/bpmn/bpmn-builder.ts`.

Test command from `packages/core/`: `pnpm test`
Typecheck: `pnpm typecheck`
Lint: `pnpm check`
Commit: `git -c commit.gpgsign=false commit`

---

## File Structure

**Modified:**
- `packages/core/src/bpmn/bpmn-builder.ts` — all tasks; adds factory fns, new methods, new classes
- `packages/core/src/bpmn/index.ts` — Task 6: add `Bpmn.createDiagram()`
- `packages/core/src/index.ts` — Task 6: export `DiagramBuilder`
- `packages/core/tests/bpmn-builder.test.ts` — all tasks: new test suites appended

---

## Task 1: Extract element factory functions (pure refactor)

`ProcessBuilder`, `BranchBuilder`, and `SubProcessContentBuilder` each duplicate the same element-creation logic for `serviceTask`, `scriptTask`, `userTask`, `businessRuleTask`, `callActivity`, `exclusiveGateway`, and `inclusiveGateway`. This task extracts shared factory functions and makes the class methods thin wrappers. **No behavior change — all existing tests must pass.**

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts`
- Test: `packages/core/tests/bpmn-builder.test.ts`

- [ ] **Step 1: Write the regression tests first**

Append to `packages/core/tests/bpmn-builder.test.ts`:

```typescript
// -----------------------------------------------------------------------
// Task 1 regression — factory extraction
// -----------------------------------------------------------------------

describe("factory extraction regression", () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it("service task with modeler template in a branch still sets unknownAttributes", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .exclusiveGateway("gw")
      .branch("yes", (b) =>
        b
          .defaultFlow()
          .serviceTask("t1", {
            name: "Templated",
            taskType: "worker",
            modelerTemplate: "io.example.v1",
            modelerTemplateVersion: "3",
          })
          .connectTo("end"),
      )
      .branch("no", (b) => b.condition("= false").endEvent())
      .endEvent("end")
      .build()

    const p = defs.processes[0]!
    const t1 = p.flowElements.find((e) => e.id === "t1")!
    expect(t1.unknownAttributes["zeebe:modelerTemplate"]).toBe("io.example.v1")
    expect(t1.unknownAttributes["zeebe:modelerTemplateVersion"]).toBe("3")
  })

  it("user task with formId in a sub-process sets zeebe:formDefinition extension", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .subProcess("sub", (b) => {
        b.startEvent("ss").userTask("ut", { formId: "form-abc" }).endEvent("se")
      })
      .endEvent("e")
      .build()

    const p = defs.processes[0]!
    const sub = p.flowElements.find((e) => e.id === "sub")!
    if (sub.type !== "subProcess") throw new Error("expected subProcess")
    const ut = sub.flowElements.find((e) => e.id === "ut")!
    const formDef = ut.extensionElements.find((x) => x.name === "zeebe:formDefinition")
    expect(formDef).toBeDefined()
    expect(formDef?.attributes.formId).toBe("form-abc")
  })
})
```

- [ ] **Step 2: Run tests — they should pass already (baseline)**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
```

Expected: all tests pass (including the two new ones, since the factories we're extracting should preserve exact behavior).

Wait — the `userTask` in `SubProcessContentBuilder` currently has a bug: it ignores `formId`. The second test above will FAIL. That's expected and intentional — it proves the bug, which the refactor fixes.

- [ ] **Step 3: Add the seven factory functions**

In `packages/core/src/bpmn/bpmn-builder.ts`, after the `makeConditionExpression` function (currently ~line 488, before the `// --------------- Branch builder` comment), add:

```typescript
// ---------------------------------------------------------------------------
// Element factory functions — shared by all three builder classes
// ---------------------------------------------------------------------------

function makeServiceTaskEl(id: string, options: ServiceTaskOptions): BpmnFlowElement {
	const unknownAttributes: Record<string, string> = {}
	if (options.modelerTemplate) unknownAttributes["zeebe:modelerTemplate"] = options.modelerTemplate
	if (options.modelerTemplateVersion)
		unknownAttributes["zeebe:modelerTemplateVersion"] = options.modelerTemplateVersion
	if (options.modelerTemplateIcon)
		unknownAttributes["zeebe:modelerTemplateIcon"] = options.modelerTemplateIcon
	const el = makeFlowElement(id, "serviceTask", {
		name: options.name,
		extensionElements: buildServiceTaskExtensions(options),
	})
	el.unknownAttributes = unknownAttributes
	return el
}

function makeScriptTaskEl(id: string, options: ScriptTaskOptions): BpmnFlowElement {
	return makeFlowElement(id, "scriptTask", {
		name: options.name,
		extensionElements: zeebeExtensionsToXmlElements({
			unknownElements: [
				{
					name: "zeebe:script",
					attributes: { expression: options.expression, resultVariable: options.resultVariable },
					children: [],
				},
			],
		}),
	})
}

function makeUserTaskEl(id: string, options?: UserTaskOptions): BpmnFlowElement {
	const ext = options?.formId
		? zeebeExtensionsToXmlElements({ formDefinition: { formId: options.formId } })
		: []
	return makeFlowElement(id, "userTask", { name: options?.name, extensionElements: ext })
}

function makeBusinessRuleTaskEl(id: string, options?: BusinessRuleTaskOptions): BpmnFlowElement {
	const ext: XmlElement[] = []
	if (options?.taskType) {
		ext.push(...zeebeExtensionsToXmlElements({ taskDefinition: { type: options.taskType } }))
	}
	if (options?.decisionId) {
		ext.push(
			...zeebeExtensionsToXmlElements({
				calledDecision: {
					decisionId: options.decisionId,
					resultVariable: options.resultVariable ?? "result",
				},
			}),
		)
	}
	return makeFlowElement(id, "businessRuleTask", { name: options?.name, extensionElements: ext })
}

function makeCallActivityEl(id: string, options: CallActivityOptions): BpmnFlowElement {
	const attrs: Record<string, string> = { processId: options.processId }
	if (options.propagateAllChildVariables !== undefined) {
		attrs.propagateAllChildVariables = String(options.propagateAllChildVariables)
	}
	return makeFlowElement(id, "callActivity", {
		name: options.name,
		extensionElements: zeebeExtensionsToXmlElements({
			unknownElements: [{ name: "zeebe:calledElement", attributes: attrs, children: [] }],
		}),
	})
}

function makeExclusiveGatewayEl(id: string, options?: GatewayOptions): BpmnFlowElement {
	const el = makeFlowElement(id, "exclusiveGateway", options)
	if (options?.defaultFlow && el.type === "exclusiveGateway") {
		;(el as { default?: string }).default = options.defaultFlow
	}
	return el
}

function makeInclusiveGatewayEl(id: string, options?: GatewayOptions): BpmnFlowElement {
	const el = makeFlowElement(id, "inclusiveGateway", options)
	if (options?.defaultFlow && el.type === "inclusiveGateway") {
		;(el as { default?: string }).default = options.defaultFlow
	}
	return el
}
```

- [ ] **Step 4: Refactor `BranchBuilder` task methods to use factories**

Replace the bodies of these methods in `BranchBuilder` (lines ~597–754):

```typescript
// BranchBuilder — replace all task method bodies with factory calls

serviceTask(id: string, options: ServiceTaskOptions): this {
  return this.addElement(makeServiceTaskEl(id, options))
}

userTask(id: string, options?: UserTaskOptions): this {
  return this.addElement(makeUserTaskEl(id, options))
}

scriptTask(id: string, options: ScriptTaskOptions): this {
  return this.addElement(makeScriptTaskEl(id, options))
}

businessRuleTask(id: string, options?: BusinessRuleTaskOptions): this {
  return this.addElement(makeBusinessRuleTaskEl(id, options))
}

callActivity(id: string, options: CallActivityOptions): this {
  return this.addElement(makeCallActivityEl(id, options))
}

exclusiveGateway(id: string, options?: GatewayOptions): this {
  return this.addElement(makeExclusiveGatewayEl(id, options))
}

inclusiveGateway(id: string, options?: GatewayOptions): this {
  return this.addElement(makeInclusiveGatewayEl(id, options))
}
```

Keep `sendTask`, `receiveTask`, `startEvent`, `endEvent`, `intermediateThrowEvent`, `intermediateCatchEvent`, `parallelGateway`, `eventBasedGateway` unchanged — they're short and don't have the same duplication issue.

- [ ] **Step 5: Refactor `SubProcessContentBuilder` task methods**

Replace the bodies of these methods in `SubProcessContentBuilder` (lines ~796–856):

```typescript
// SubProcessContentBuilder — replace with factory calls

serviceTask(id: string, options: ServiceTaskOptions): this {
  return this.addElement(makeServiceTaskEl(id, options))
}

userTask(id: string, options?: UserTaskOptions): this {
  return this.addElement(makeUserTaskEl(id, options))
}

scriptTask(id: string, options: ScriptTaskOptions): this {
  return this.addElement(makeScriptTaskEl(id, options))
}

callActivity(id: string, options: CallActivityOptions): this {
  return this.addElement(makeCallActivityEl(id, options))
}
```

Note: `SubProcessContentBuilder` currently doesn't have `businessRuleTask` at all — this is added in Task 2.

- [ ] **Step 6: Refactor `ProcessBuilder` task methods**

Replace the bodies of these methods in `ProcessBuilder` (lines ~1030–1174):

```typescript
// ProcessBuilder — replace with factory calls

serviceTask(id: string, options: ServiceTaskOptions): this {
  this.addFlowElement(makeServiceTaskEl(id, options))
  return this
}

scriptTask(id: string, options: ScriptTaskOptions): this {
  this.addFlowElement(makeScriptTaskEl(id, options))
  return this
}

userTask(id: string, options?: UserTaskOptions): this {
  this.addFlowElement(makeUserTaskEl(id, options))
  return this
}

businessRuleTask(id: string, options?: BusinessRuleTaskOptions): this {
  this.addFlowElement(makeBusinessRuleTaskEl(id, options))
  return this
}

callActivity(id: string, options: CallActivityOptions): this {
  this.addFlowElement(makeCallActivityEl(id, options))
  return this
}

exclusiveGateway(id: string, options?: GatewayOptions): this {
  this.addFlowElement(makeExclusiveGatewayEl(id, options))
  this.currentGatewayId = id
  return this
}

inclusiveGateway(id: string, options?: GatewayOptions): this {
  this.addFlowElement(makeInclusiveGatewayEl(id, options))
  this.currentGatewayId = id
  return this
}
```

- [ ] **Step 7: Run tests — both regression tests should now pass**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
```

Expected: all tests pass including the `user task with formId in a sub-process` test (the `SubProcessContentBuilder.userTask` bug is now fixed via `makeUserTaskEl`).

- [ ] **Step 8: Typecheck and lint**

```bash
cd packages/core && pnpm typecheck && pnpm check
```

Expected: zero errors, zero warnings.

- [ ] **Step 9: Commit**

```bash
git -c commit.gpgsign=false commit -am "refactor(core): extract element factory functions, fix userTask formId in SubProcess"
```

---

## Task 2: SubProcessContentBuilder branching

`SubProcessContentBuilder` currently only supports linear sequences (start → tasks → end). This task adds full gateway and branch support so sub-processes can model decision logic. Also extracts `insertJoinGateways` and `traceBackToSplit` as standalone functions so sub-process content benefits from the same auto-join logic.

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts`
- Test: `packages/core/tests/bpmn-builder.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/tests/bpmn-builder.test.ts`:

```typescript
// -----------------------------------------------------------------------
// Task 2 — SubProcessContentBuilder branching
// -----------------------------------------------------------------------

describe("SubProcessContentBuilder branching", () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it("sub-process supports exclusive gateway with branches", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .subProcess("sub", (b) => {
        b.startEvent("ss")
          .exclusiveGateway("gw")
          .branch("approve", (br) =>
            br.condition("= approved").serviceTask("approve-task", { name: "Approve", taskType: "approve" }).connectTo("se"),
          )
          .branch("reject", (br) =>
            br.defaultFlow().serviceTask("reject-task", { name: "Reject", taskType: "reject" }).connectTo("se"),
          )
          .endEvent("se")
      })
      .endEvent("e")
      .build()

    const sub = defs.processes[0]!.flowElements.find((e) => e.id === "sub")!
    if (sub.type !== "subProcess") throw new Error("expected subProcess")
    expect(sub.flowElements.some((e) => e.id === "approve-task")).toBe(true)
    expect(sub.flowElements.some((e) => e.id === "reject-task")).toBe(true)
    // Verify flows: gateway → approve-task and gateway → reject-task
    expect(sub.sequenceFlows.some((f) => f.sourceRef === "gw" && f.targetRef === "approve-task")).toBe(true)
    expect(sub.sequenceFlows.some((f) => f.sourceRef === "gw" && f.targetRef === "reject-task")).toBe(true)
  })

  it("sub-process auto-inserts join gateway when branches converge", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .subProcess("sub", (b) => {
        b.startEvent("ss")
          .exclusiveGateway("gw")
          .branch("a", (br) =>
            br.condition("= x > 0").serviceTask("ta", { name: "A", taskType: "a" }).connectTo("merge"),
          )
          .branch("b", (br) =>
            br.defaultFlow().serviceTask("tb", { name: "B", taskType: "b" }).connectTo("merge"),
          )
          .serviceTask("merge", { name: "After", taskType: "after" })
          .endEvent("se")
      })
      .endEvent("e")
      .build()

    const sub = defs.processes[0]!.flowElements.find((e) => e.id === "sub")!
    if (sub.type !== "subProcess") throw new Error("expected subProcess")
    // join gateway inserted before "merge"
    const join = sub.flowElements.find((e) => e.id === "gw_join")
    expect(join).toBeDefined()
    expect(join?.type).toBe("exclusiveGateway")
  })

  it("sub-process supports connectTo for loop back", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .subProcess("sub", (b) => {
        b.startEvent("ss")
          .serviceTask("work", { name: "Work", taskType: "work" })
          .exclusiveGateway("check")
          .branch("done", (br) => br.condition("= done").endEvent("se"))
          .branch("retry", (br) => br.defaultFlow().connectTo("work"))
      })
      .endEvent("e")
      .build()

    const sub = defs.processes[0]!.flowElements.find((e) => e.id === "sub")!
    if (sub.type !== "subProcess") throw new Error("expected subProcess")
    // retry branch flows back to "work"
    expect(sub.sequenceFlows.some((f) => f.sourceRef === "check" && f.targetRef === "work")).toBe(true)
  })

  it("sub-process supports businessRuleTask and sendTask", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .subProcess("sub", (b) => {
        b.startEvent("ss")
          .businessRuleTask("rule", { decisionId: "approval-decision", resultVariable: "decision" })
          .sendTask("notify", { name: "Notify" })
          .endEvent("se")
      })
      .endEvent("e")
      .build()

    const sub = defs.processes[0]!.flowElements.find((e) => e.id === "sub")!
    if (sub.type !== "subProcess") throw new Error("expected subProcess")
    expect(sub.flowElements.some((e) => e.id === "rule")).toBe(true)
    expect(sub.flowElements.some((e) => e.id === "notify")).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — all 4 should fail**

```bash
cd packages/core && pnpm test 2>&1 | grep "SubProcessContentBuilder branching" -A 10
```

Expected: 4 failures with errors like `b.exclusiveGateway is not a function`.

- [ ] **Step 3: Extract `insertJoinGateways` and `traceBackToSplit` as module-level functions**

In `packages/core/src/bpmn/bpmn-builder.ts`, add these two standalone functions directly before the `// --------------- Branch builder` comment block (~line 489, after the factory functions added in Task 1):

```typescript
// ---------------------------------------------------------------------------
// Shared graph helpers — used by ProcessBuilder and SubProcessContentBuilder
// ---------------------------------------------------------------------------

function insertJoinGateways(elements: BpmnFlowElement[], flows: BpmnSequenceFlow[]): void {
	const GATEWAY_TYPES = new Set([
		"exclusiveGateway",
		"parallelGateway",
		"inclusiveGateway",
		"eventBasedGateway",
	])

	const elementTypes = new Map<string, string>()
	for (const el of elements) elementTypes.set(el.id, el.type)

	const outCount = new Map<string, number>()
	for (const flow of flows) {
		outCount.set(flow.sourceRef, (outCount.get(flow.sourceRef) ?? 0) + 1)
	}
	const splitGateways = new Set<string>()
	for (const [id, count] of outCount) {
		const type = elementTypes.get(id)
		if (type && GATEWAY_TYPES.has(type) && count >= 2) splitGateways.add(id)
	}
	if (splitGateways.size === 0) return

	const incoming = new Map<string, BpmnSequenceFlow[]>()
	for (const flow of flows) {
		const arr = incoming.get(flow.targetRef)
		if (arr) arr.push(flow)
		else incoming.set(flow.targetRef, [flow])
	}

	for (const [targetId, inFlows] of incoming) {
		if (inFlows.length < 2) continue
		const splitToFlows = new Map<string, BpmnSequenceFlow[]>()
		for (const flow of inFlows) {
			const split = traceBackToSplit(flow.sourceRef, splitGateways, flows)
			if (split) {
				const arr = splitToFlows.get(split)
				if (arr) arr.push(flow)
				else splitToFlows.set(split, [flow])
			}
		}
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
			for (const flow of convergingFlows) flow.targetRef = joinId
			flows.push({
				id: generateId("Flow"),
				sourceRef: joinId,
				targetRef: targetId,
				extensionElements: [],
				unknownAttributes: {},
			})
		}
	}
}

function traceBackToSplit(
	nodeId: string,
	splitGateways: Set<string>,
	flows: BpmnSequenceFlow[],
): string | undefined {
	const visited = new Set<string>()
	let current = nodeId
	while (current) {
		if (visited.has(current)) return undefined
		visited.add(current)
		if (splitGateways.has(current)) return current
		const inFlows = flows.filter((f) => f.targetRef === current)
		if (inFlows.length !== 1) return undefined
		const prev = inFlows[0]
		if (!prev) return undefined
		current = prev.sourceRef
	}
	return undefined
}
```

- [ ] **Step 4: Remove `insertJoinGateways` and `traceBackToSplit` private methods from `ProcessBuilder`**

In `ProcessBuilder` (currently lines ~1490–1595), delete the `private insertJoinGateways()` method and `private traceBackToSplit()` method entirely.

Then in `ProcessBuilder.build()`, change the call from:
```typescript
this.insertJoinGateways()
```
to:
```typescript
insertJoinGateways(this.flowElements, this.sequenceFlows)
```

- [ ] **Step 5: Upgrade `SubProcessContentBuilder` with branching support**

Replace the `SubProcessContentBuilder` class body (currently lines ~760–881). The new version adds `currentGatewayId`, `openBranchEnds`, gateway methods, and branching:

```typescript
export class SubProcessContentBuilder {
	/** @internal */
	readonly _elements: BpmnFlowElement[] = []
	/** @internal */
	readonly _flows: BpmnSequenceFlow[] = []
	private lastNodeId: string | undefined
	private currentGatewayId: string | undefined
	private openBranchEnds: string[] = []

	private addElement(element: BpmnFlowElement): this {
		if (this._elements.some((n) => n.id === element.id)) {
			throw new Error(`Duplicate element ID "${element.id}" in sub-process`)
		}
		this._elements.push(element)
		if (this.lastNodeId) {
			this._flows.push({
				id: generateId("Flow"),
				sourceRef: this.lastNodeId,
				targetRef: element.id,
				extensionElements: [],
				unknownAttributes: {},
			})
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

	// ---- Events ----

	startEvent(id?: string, options?: StartEventOptions): this {
		const el = makeFlowElement(id ?? generateId("StartEvent"), "startEvent", options)
		if (el.type === "startEvent" && options) el.eventDefinitions = buildEventDefinitions(options)
		return this.addElement(el)
	}

	endEvent(id?: string, options?: ElementOptions): this {
		return this.addElement(makeFlowElement(id ?? generateId("EndEvent"), "endEvent", options))
	}

	intermediateThrowEvent(id?: string, options?: IntermediateThrowEventOptions): this {
		const el = makeFlowElement(id ?? generateId("IntermediateThrowEvent"), "intermediateThrowEvent", options)
		if (el.type === "intermediateThrowEvent" && options) el.eventDefinitions = buildEventDefinitions(options)
		return this.addElement(el)
	}

	intermediateCatchEvent(id?: string, options?: IntermediateCatchEventOptions): this {
		const el = makeFlowElement(id ?? generateId("IntermediateCatchEvent"), "intermediateCatchEvent", options)
		if (el.type === "intermediateCatchEvent" && options) el.eventDefinitions = buildEventDefinitions(options)
		return this.addElement(el)
	}

	// ---- Tasks ----

	serviceTask(id: string, options: ServiceTaskOptions): this {
		return this.addElement(makeServiceTaskEl(id, options))
	}

	scriptTask(id: string, options: ScriptTaskOptions): this {
		return this.addElement(makeScriptTaskEl(id, options))
	}

	userTask(id: string, options?: UserTaskOptions): this {
		return this.addElement(makeUserTaskEl(id, options))
	}

	businessRuleTask(id: string, options?: BusinessRuleTaskOptions): this {
		return this.addElement(makeBusinessRuleTaskEl(id, options))
	}

	callActivity(id: string, options: CallActivityOptions): this {
		return this.addElement(makeCallActivityEl(id, options))
	}

	sendTask(id: string, options?: ElementOptions): this {
		return this.addElement(makeFlowElement(id, "sendTask", options))
	}

	receiveTask(id: string, options?: ElementOptions): this {
		return this.addElement(makeFlowElement(id, "receiveTask", options))
	}

	// ---- Gateways ----

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

	// ---- Branching & flow control ----

	branch(name: string, callback: (b: BranchBuilder) => void): this {
		if (!this.currentGatewayId) {
			throw new Error("branch() must be called after a gateway element")
		}
		const b = new BranchBuilder(this.currentGatewayId, name)
		callback(b)

		for (const el of b._elements) {
			if (this._elements.some((n) => n.id === el.id)) {
				throw new Error(`Duplicate element ID "${el.id}"`)
			}
			this._elements.push(el)
		}
		for (const fl of b._flows) this._flows.push(fl)

		if (b._defaultFlowId) {
			const gw = this._elements.find((n) => n.id === this.currentGatewayId)
			if (gw && (gw.type === "exclusiveGateway" || gw.type === "inclusiveGateway")) {
				gw.default = b._defaultFlowId
			}
		}

		if (!b._connected && b._elements.length > 0) {
			const lastEl = b._elements[b._elements.length - 1]
			if (lastEl && lastEl.type !== "endEvent") {
				this.openBranchEnds.push(b._lastNodeId)
			}
		}

		this.lastNodeId = undefined
		return this
	}

	connectTo(targetId: string): this {
		if (this.lastNodeId) {
			this._flows.push({
				id: generateId("Flow"),
				sourceRef: this.lastNodeId,
				targetRef: targetId,
				extensionElements: [],
				unknownAttributes: {},
			})
		}
		this.lastNodeId = undefined
		return this
	}

	element(elementId: string): this {
		if (!this._elements.some((n) => n.id === elementId)) {
			throw new Error(`Element "${elementId}" not found in sub-process`)
		}
		this.lastNodeId = elementId
		this.currentGatewayId = undefined
		return this
	}
}
```

- [ ] **Step 6: Call `insertJoinGateways` on sub-process content in `ProcessBuilder`**

In `ProcessBuilder`, update the three sub-process methods to call `insertJoinGateways` before `recomputeIncomingOutgoing`:

In `subProcess()` (currently ~line 1378):
```typescript
subProcess(id, content, options?) {
  const sub = new SubProcessContentBuilder()
  content(sub)
  insertJoinGateways(sub._elements, sub._flows)   // ← ADD THIS LINE
  recomputeIncomingOutgoing(sub._elements, sub._flows)
  // ... rest unchanged
}
```

In `adHocSubProcess()` (currently ~line 1306):
```typescript
// After: content(sub)
insertJoinGateways(sub._elements, sub._flows)   // ← ADD THIS LINE
recomputeIncomingOutgoing(sub._elements, sub._flows)
```

In `eventSubProcess()` (currently ~line 1400):
```typescript
// After: content(sub)
insertJoinGateways(sub._elements, sub._flows)   // ← ADD THIS LINE
recomputeIncomingOutgoing(sub._elements, sub._flows)
```

- [ ] **Step 7: Run the tests**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
```

Expected: all tests pass, including all 4 new `SubProcessContentBuilder branching` tests.

- [ ] **Step 8: Typecheck and lint**

```bash
cd packages/core && pnpm typecheck && pnpm check
```

Expected: zero errors.

- [ ] **Step 9: Commit**

```bash
git -c commit.gpgsign=false commit -am "feat(core): add gateway/branch support to SubProcessContentBuilder"
```

---

## Task 3: Build-time validation

`connectTo("nonexistent-id")` currently produces a broken diagram silently. This task adds validation at `build()` time and a `strict` option that throws when auto-join gateways are inserted (encouraging explicit topology).

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts`
- Test: `packages/core/tests/bpmn-builder.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/tests/bpmn-builder.test.ts`:

```typescript
// -----------------------------------------------------------------------
// Task 3 — Build-time validation
// -----------------------------------------------------------------------

describe("build-time validation", () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it("throws when connectTo references an ID that does not exist", () => {
    expect(() =>
      Bpmn.createProcess("proc")
        .startEvent("s")
        .serviceTask("t1", { name: "T", taskType: "x" })
        .connectTo("nonexistent")
        .endEvent("e")
        .build(),
    ).toThrow(/nonexistent/)
  })

  it("allows connectTo with a forward reference that is satisfied later", () => {
    expect(() =>
      Bpmn.createProcess("proc")
        .startEvent("s")
        .exclusiveGateway("gw")
        .branch("a", (b) => b.condition("= x").serviceTask("t1", { name: "A", taskType: "a" }).connectTo("end"))
        .branch("b", (b) => b.defaultFlow().connectTo("end"))
        .endEvent("end")
        .build(),
    ).not.toThrow()
  })

  it("strict mode throws when auto-join gateway would be inserted", () => {
    expect(() =>
      Bpmn.createProcess("proc")
        .startEvent("s")
        .exclusiveGateway("gw")
        .branch("a", (b) =>
          b.condition("= x").serviceTask("t1", { name: "A", taskType: "a" }).connectTo("after"),
        )
        .branch("b", (b) => b.defaultFlow().connectTo("after"))
        .serviceTask("after", { name: "After", taskType: "z" })
        .endEvent("end")
        .build({ strict: true }),
    ).toThrow(/auto-join/)
  })

  it("strict mode passes when join gateway is explicit", () => {
    expect(() =>
      Bpmn.createProcess("proc")
        .startEvent("s")
        .exclusiveGateway("gw")
        .branch("a", (b) =>
          b.condition("= x").serviceTask("t1", { name: "A", taskType: "a" }).connectTo("join"),
        )
        .branch("b", (b) => b.defaultFlow().connectTo("join"))
        .exclusiveGateway("join")
        .endEvent("end")
        .build({ strict: true }),
    ).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests — all 4 should fail**

```bash
cd packages/core && pnpm test 2>&1 | grep "build-time validation" -A 15
```

Expected: 4 failures.

- [ ] **Step 3: Add `validate()` private method and update `build()` signature**

In `ProcessBuilder`, update `build()` to accept options and add a `validate()` call:

```typescript
build(options?: { strict?: boolean }): BpmnDefinitions {
  const beforeCount = this.flowElements.length
  insertJoinGateways(this.flowElements, this.sequenceFlows)

  if (options?.strict && this.flowElements.length > beforeCount) {
    const inserted = this.flowElements
      .slice(beforeCount)
      .map((e) => e.id)
      .join(", ")
    throw new Error(
      `Auto-join gateways were inserted: ${inserted}. ` +
        `Use explicit .connectTo(joinId) to make gateway topology explicit, or remove { strict: true }.`,
    )
  }

  this.validate()
  recomputeIncomingOutgoing(this.flowElements, this.sequenceFlows)
  // ... rest of build() unchanged
}

private validate(): void {
  const elementIds = new Set(this.flowElements.map((el) => el.id))
  for (const flow of this.sequenceFlows) {
    if (!elementIds.has(flow.targetRef)) {
      throw new Error(
        `Sequence flow "${flow.id}" in process "${this.processId}" references unknown ` +
          `element "${flow.targetRef}". Check connectTo() calls — target must exist.`,
      )
    }
    if (!elementIds.has(flow.sourceRef)) {
      throw new Error(
        `Sequence flow "${flow.id}" in process "${this.processId}" references unknown ` +
          `source element "${flow.sourceRef}".`,
      )
    }
  }
}
```

The `validate()` call goes **after** `insertJoinGateways` (so auto-inserted elements are visible) but **before** `recomputeIncomingOutgoing`.

- [ ] **Step 4: Run tests**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
```

Expected: all tests pass including all 4 validation tests.

- [ ] **Step 5: Typecheck and lint**

```bash
cd packages/core && pnpm typecheck && pnpm check
```

- [ ] **Step 6: Commit**

```bash
git -c commit.gpgsign=false commit -am "feat(core): add build-time validation and strict mode for explicit gateway topology"
```

---

## Task 4: `.withBoundary()` — ergonomic boundary event API

Currently boundary events require a separate `.boundaryEvent("err", { attachedTo: "task-id", ... })` call that breaks the reading flow and leaves the builder cursor on the boundary event. The new `.withBoundary()` method attaches a boundary event to the previous task, runs a handler for the error path, and **restores the cursor to the original task** so the main flow continues naturally.

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts`
- Test: `packages/core/tests/bpmn-builder.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/tests/bpmn-builder.test.ts`:

```typescript
// -----------------------------------------------------------------------
// Task 4 — withBoundary ergonomics
// -----------------------------------------------------------------------

describe("withBoundary", () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it("attaches error boundary to the preceding task and main flow continues", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .serviceTask("validate", { name: "Validate", taskType: "validate" })
      .withBoundary("on-err", { errorCode: "INVALID", cancelActivity: true }, (p) =>
        p.serviceTask("handle", { name: "Handle", taskType: "handle-err" }).endEvent("err-end"),
      )
      .serviceTask("next", { name: "Next", taskType: "next" })
      .endEvent("end")
      .build()

    const p = defs.processes[0]!
    // boundary event is attached to "validate"
    const boundary = p.flowElements.find((e) => e.id === "on-err")!
    if (boundary.type !== "boundaryEvent") throw new Error("expected boundaryEvent")
    expect(boundary.attachedToRef).toBe("validate")

    // main flow: validate → next (not validate → handle)
    expect(p.sequenceFlows.some((f) => f.sourceRef === "validate" && f.targetRef === "next")).toBe(true)

    // error path: on-err → handle → err-end
    expect(p.sequenceFlows.some((f) => f.sourceRef === "on-err" && f.targetRef === "handle")).toBe(true)
    expect(p.sequenceFlows.some((f) => f.sourceRef === "handle" && f.targetRef === "err-end")).toBe(true)
  })

  it("timer boundary leaves main flow intact", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .serviceTask("slow", { name: "Slow", taskType: "slow" })
      .withBoundary("on-timeout", { timerDuration: "PT30S", cancelActivity: false }, (p) =>
        p.serviceTask("escalate", { name: "Escalate", taskType: "escalate" }).endEvent("timeout-end"),
      )
      .endEvent("end")
      .build()

    const p = defs.processes[0]!
    const timeout = p.flowElements.find((e) => e.id === "on-timeout")!
    if (timeout.type !== "boundaryEvent") throw new Error("expected boundaryEvent")
    expect(timeout.attachedToRef).toBe("slow")
    expect(timeout.cancelActivity).toBe(false)

    // main flow: slow → end
    expect(p.sequenceFlows.some((f) => f.sourceRef === "slow" && f.targetRef === "end")).toBe(true)
  })

  it("throws when withBoundary is called without a preceding element", () => {
    expect(() =>
      Bpmn.createProcess("proc")
        .withBoundary("err", { errorCode: "X" }, (p) => p.endEvent())
        .build(),
    ).toThrow(/withBoundary/)
  })
})
```

- [ ] **Step 2: Run tests — all 3 should fail**

```bash
cd packages/core && pnpm test 2>&1 | grep "withBoundary" -A 12
```

Expected: 3 failures with `p.withBoundary is not a function`.

- [ ] **Step 3: Add `withBoundary()` to `ProcessBuilder`**

Add after the `boundaryEvent()` method in `ProcessBuilder` (currently ~line 1025):

```typescript
/**
 * Attach a boundary event to the preceding task, build an error/timeout handling path
 * via the callback, then **restore the builder cursor to the original task** so the
 * main flow continues from there.
 *
 * @example
 * ```ts
 * .serviceTask("validate", { name: "Validate", taskType: "validate" })
 * .withBoundary("on-err", { errorCode: "INVALID" }, (p) =>
 *   p.serviceTask("handle", { name: "Handle Error", taskType: "handle-err" }).endEvent()
 * )
 * .serviceTask("next", { ... })  // chains from "validate", not from boundary event
 * ```
 */
withBoundary(
  id: string,
  options: Omit<BoundaryEventOptions, "attachedTo">,
  handler: (b: ProcessBuilder) => void,
): this {
  const attachedTo = this.lastNodeId
  if (!attachedTo) {
    throw new Error(
      `withBoundary() must follow a task element. ` +
        `Current builder position has no active element.`,
    )
  }

  const savedLast = this.lastNodeId
  const savedGateway = this.currentGatewayId
  const savedOpenEnds = [...this.openBranchEnds]
  this.openBranchEnds = []

  // boundaryEvent() sets lastNodeId to the boundary event id
  this.boundaryEvent(id, { ...options, attachedTo })

  // Build the error/timeout path chaining from the boundary event
  handler(this)

  // Restore cursor to the original task so the main flow continues
  this.lastNodeId = savedLast
  this.currentGatewayId = savedGateway
  this.openBranchEnds = savedOpenEnds

  return this
}
```

Also export the type from `packages/core/src/index.ts` — no change needed since it's just a method, not a new type.

- [ ] **Step 4: Run tests**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Typecheck and lint**

```bash
cd packages/core && pnpm typecheck && pnpm check
```

- [ ] **Step 6: Commit**

```bash
git -c commit.gpgsign=false commit -am "feat(core): add withBoundary() for ergonomic boundary event handling"
```

---

## Task 5: Task defaults + `disconnectedStartEvent()` alias

Add `.defaults()` to set process-wide service task defaults (e.g., `retries`) that apply to all subsequent `serviceTask()` calls unless overridden. Add `disconnectedStartEvent()` as a more readable alias for `addStartEvent()`.

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts`
- Test: `packages/core/tests/bpmn-builder.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/tests/bpmn-builder.test.ts`:

```typescript
// -----------------------------------------------------------------------
// Task 5 — Task defaults + disconnectedStartEvent alias
// -----------------------------------------------------------------------

describe("task defaults", () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it("applies default retries to all subsequent service tasks", () => {
    const defs = Bpmn.createProcess("proc")
      .defaults({ serviceTask: { retries: "5" } })
      .startEvent("s")
      .serviceTask("t1", { name: "T1", taskType: "worker-a" })
      .serviceTask("t2", { name: "T2", taskType: "worker-b" })
      .endEvent("e")
      .build()

    const p = defs.processes[0]!
    for (const id of ["t1", "t2"]) {
      const task = p.flowElements.find((e) => e.id === id)!
      const taskDef = task.extensionElements.find((x) => x.name === "zeebe:taskDefinition")
      expect(taskDef?.attributes.retries, `${id} retries`).toBe("5")
    }
  })

  it("explicit retries override the default", () => {
    const defs = Bpmn.createProcess("proc")
      .defaults({ serviceTask: { retries: "5" } })
      .startEvent("s")
      .serviceTask("t1", { name: "T1", taskType: "worker-a", retries: "1" })
      .endEvent("e")
      .build()

    const p = defs.processes[0]!
    const task = p.flowElements.find((e) => e.id === "t1")!
    const taskDef = task.extensionElements.find((x) => x.name === "zeebe:taskDefinition")
    expect(taskDef?.attributes.retries).toBe("1")
  })

  it("defaults do not affect service tasks added before .defaults() call", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("s")
      .serviceTask("before", { name: "Before", taskType: "x" })
      .defaults({ serviceTask: { retries: "9" } })
      .serviceTask("after", { name: "After", taskType: "y" })
      .endEvent("e")
      .build()

    const p = defs.processes[0]!
    const before = p.flowElements.find((e) => e.id === "before")!
    const taskDefBefore = before.extensionElements.find((x) => x.name === "zeebe:taskDefinition")
    // "before" had no explicit retries and defaults weren't set yet → no retries attribute (uses "3" internally)
    expect(taskDefBefore?.attributes.retries).toBeUndefined()

    const after = p.flowElements.find((e) => e.id === "after")!
    const taskDefAfter = after.extensionElements.find((x) => x.name === "zeebe:taskDefinition")
    expect(taskDefAfter?.attributes.retries).toBe("9")
  })
})

describe("disconnectedStartEvent alias", () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it("disconnectedStartEvent creates a start event with no auto-connection", () => {
    const defs = Bpmn.createProcess("proc")
      .startEvent("s1")
      .serviceTask("t1", { name: "T1", taskType: "x" })
      .endEvent("e1")
      .disconnectedStartEvent("s2")
      .serviceTask("t2", { name: "T2", taskType: "y" })
      .endEvent("e2")
      .build()

    const p = defs.processes[0]!
    // s2 should have no incoming flows and no flow from e1 to it
    expect(p.sequenceFlows.some((f) => f.targetRef === "s2")).toBe(false)
    // t2 connects from s2
    expect(p.sequenceFlows.some((f) => f.sourceRef === "s2" && f.targetRef === "t2")).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — all 4 should fail**

```bash
cd packages/core && pnpm test 2>&1 | grep "task defaults\|disconnectedStartEvent" -A 10
```

Expected: 4 failures.

- [ ] **Step 3: Add `_serviceTaskDefaults` field and `.defaults()` method**

In `ProcessBuilder` class, add a new private field after `private _autoLayout = false`:

```typescript
private _serviceTaskDefaults: { retries?: string } = {}
```

Add the `.defaults()` method after `.withAutoLayout()`:

```typescript
/** Set process-wide defaults applied to subsequent service task calls. */
defaults(options: { serviceTask?: { retries?: string } }): this {
  if (options.serviceTask) this._serviceTaskDefaults = { ...this._serviceTaskDefaults, ...options.serviceTask }
  return this
}
```

- [ ] **Step 4: Update `serviceTask()` to apply defaults**

Replace `ProcessBuilder.serviceTask()` with:

```typescript
serviceTask(id: string, options: ServiceTaskOptions): this {
  const merged: ServiceTaskOptions = {
    ...options,
    retries: options.retries ?? this._serviceTaskDefaults.retries,
  }
  this.addFlowElement(makeServiceTaskEl(id, merged))
  return this
}
```

Note: `options.retries ?? this._serviceTaskDefaults.retries` — if `options.retries` is explicitly provided (even as `"1"`), it wins. If undefined, the default applies.

- [ ] **Step 5: Add `disconnectedStartEvent()` alias**

Add after `addStartEvent()` in `ProcessBuilder`:

```typescript
/**
 * Add a disconnected start event — readable alias for {@link addStartEvent}.
 * Clears the current builder position so the new start event begins a separate path.
 */
disconnectedStartEvent(id?: string, options?: StartEventOptions): this {
  return this.addStartEvent(id, options)
}
```

Also export it: the method is already on `ProcessBuilder` which is exported. No `index.ts` changes needed.

- [ ] **Step 6: Run tests**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 7: Typecheck and lint**

```bash
cd packages/core && pnpm typecheck && pnpm check
```

- [ ] **Step 8: Commit**

```bash
git -c commit.gpgsign=false commit -am "feat(core): add task defaults, disconnectedStartEvent() alias"
```

---

## Task 6: `DiagramBuilder` — multi-process support and user-controlled definitions ID

`ProcessBuilder.build()` hardcodes `id: "Definitions_1"`. Users building two-process systems (caller + callee) must manually assemble `BpmnDefinitions`. This task adds `Bpmn.createDiagram(id?)` which returns a `DiagramBuilder` supporting multiple processes.

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts`
- Modify: `packages/core/src/bpmn/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/bpmn-builder.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/tests/bpmn-builder.test.ts`:

```typescript
// -----------------------------------------------------------------------
// Task 6 — DiagramBuilder / Bpmn.createDiagram()
// -----------------------------------------------------------------------

describe("DiagramBuilder", () => {
  beforeEach(() => {
    resetIdCounter()
  })

  it("builds a definitions with a user-provided id", () => {
    const defs = Bpmn.createDiagram("OrderSystem")
      .process("order-flow", (p) =>
        p.startEvent("s").serviceTask("t1", { name: "T", taskType: "x" }).endEvent("e"),
      )
      .build()

    expect(defs.id).toBe("OrderSystem")
    expect(defs.processes).toHaveLength(1)
    expect(defs.processes[0]!.id).toBe("order-flow")
  })

  it("builds a definitions with two processes and no id conflict", () => {
    const defs = Bpmn.createDiagram("TwoProcess")
      .process("caller", (p) =>
        p
          .startEvent("s1")
          .callActivity("call-callee", { processId: "callee" })
          .endEvent("e1"),
      )
      .process("callee", (p) =>
        p.startEvent("s2").serviceTask("work", { name: "Work", taskType: "work" }).endEvent("e2"),
      )
      .build()

    expect(defs.processes).toHaveLength(2)
    expect(defs.processes[0]!.id).toBe("caller")
    expect(defs.processes[1]!.id).toBe("callee")
  })

  it("collects root messages across processes", () => {
    const defs = Bpmn.createDiagram("Messaging")
      .process("sender", (p) =>
        p.startEvent("s").intermediateThrowEvent("throw", { messageName: "order-placed" }).endEvent("e"),
      )
      .process("receiver", (p) =>
        p.startEvent("catch", { messageName: "order-placed" }).endEvent("e2"),
      )
      .build()

    // Both processes reference "order-placed" — messages should be collected
    expect(defs.messages.length).toBeGreaterThanOrEqual(1)
  })

  it("defaults definitions id to 'Definitions_1' when not provided", () => {
    const defs = Bpmn.createDiagram()
      .process("p", (p) => p.startEvent("s").endEvent("e"))
      .build()

    expect(defs.id).toBe("Definitions_1")
  })
})
```

- [ ] **Step 2: Run tests — all 4 should fail**

```bash
cd packages/core && pnpm test 2>&1 | grep "DiagramBuilder" -A 15
```

Expected: 4 failures with `Bpmn.createDiagram is not a function`.

- [ ] **Step 3: Add `DiagramBuilder` class to `bpmn-builder.ts`**

Add this class **after** `ProcessBuilder` at the end of `bpmn-builder.ts` (after line 1630):

```typescript
// ---------------------------------------------------------------------------
// Diagram builder — multi-process support
// ---------------------------------------------------------------------------

/**
 * Builder for a complete BPMN definitions document containing one or more processes.
 *
 * Use `Bpmn.createDiagram(id?)` to obtain an instance.
 *
 * @example
 * ```ts
 * const defs = Bpmn.createDiagram("OrderSystem")
 *   .process("order-flow", (p) =>
 *     p.startEvent("s").serviceTask("t", { name: "T", taskType: "x" }).endEvent("e"),
 *   )
 *   .process("payment-flow", (p) =>
 *     p.startEvent("s2").serviceTask("pay", { name: "Pay", taskType: "pay" }).endEvent("e2"),
 *   )
 *   .build()
 * ```
 */
export class DiagramBuilder {
	private readonly _id: string
	private readonly _processes: BpmnProcess[] = []
	private readonly _errors: BpmnError[] = []
	private readonly _messages: BpmnMessage[] = []

	constructor(id: string) {
		this._id = id
	}

	/**
	 * Add a process to the diagram. The callback receives a `ProcessBuilder`
	 * configured for the given process ID.
	 */
	process(id: string, callback: (b: ProcessBuilder) => void): this {
		const builder = new ProcessBuilder(id)
		callback(builder)
		const defs = builder.build()
		this._processes.push(...defs.processes)
		this._errors.push(...defs.errors)
		this._messages.push(...defs.messages)
		return this
	}

	/** Build the complete BPMN definitions model. */
	build(): BpmnDefinitions {
		return {
			id: this._id,
			targetNamespace: "http://bpmn.io/schema/bpmn",
			exporter: "@bpmnkit/core",
			exporterVersion: EXPORTER_VERSION,
			namespaces: {
				bpmn: "http://www.omg.org/spec/BPMN/20100524/MODEL",
				bpmndi: "http://www.omg.org/spec/BPMN/20100524/DI",
				dc: "http://www.omg.org/spec/DD/20100524/DC",
				di: "http://www.omg.org/spec/DD/20100524/DI",
				zeebe: "http://camunda.org/schema/zeebe/1.0",
				modeler: "http://camunda.org/schema/modeler/1.0",
				xsi: "http://www.w3.org/2001/XMLSchema-instance",
			},
			unknownAttributes: {
				"modeler:executionPlatform": "Camunda Cloud",
				"modeler:executionPlatformVersion": "8.6.0",
			},
			errors: this._errors,
			escalations: [],
			messages: this._messages,
			signals: [],
			collaborations: [],
			processes: this._processes,
			diagrams: [],
		}
	}
}
```

Note: `EXPORTER_VERSION` is added in Task 7. For now, put `"0.0.23"` as a literal and it will be replaced in Task 7.

- [ ] **Step 4: Add `Bpmn.createDiagram()` to `packages/core/src/bpmn/index.ts`**

Add import for `DiagramBuilder` at the top of `index.ts`:

```typescript
import { DiagramBuilder, ProcessBuilder } from "./bpmn-builder.js"
```

Add `createDiagram` to the `Bpmn` object (after `createProcess`):

```typescript
/**
 * Create a multi-process BPMN definitions document.
 *
 * @param id - Definitions document ID (defaults to `"Definitions_1"`).
 *
 * @example
 * ```typescript
 * const defs = Bpmn.createDiagram("OrderSystem")
 *   .process("order-flow", (p) => p.startEvent("s").endEvent("e"))
 *   .process("payment-flow", (p) => p.startEvent("s2").endEvent("e2"))
 *   .build()
 * ```
 */
createDiagram(id = "Definitions_1"): DiagramBuilder {
  return new DiagramBuilder(id)
},
```

- [ ] **Step 5: Export `DiagramBuilder` from `packages/core/src/index.ts`**

In `packages/core/src/index.ts`, add `DiagramBuilder` to the existing builder exports near line 43:

```typescript
export type {
  ProcessBuilder,
  BranchBuilder,
  SubProcessContentBuilder,
  DiagramBuilder,           // ← ADD THIS
  ServiceTaskOptions,
  // ... rest unchanged
} from "./bpmn/bpmn-builder.js"
```

Wait — `DiagramBuilder` is a class, not just a type. Change the export to a value export:

```typescript
export { DiagramBuilder } from "./bpmn/bpmn-builder.js"
```

Add this line near the existing `export type { ProcessBuilder, ... }` block.

- [ ] **Step 6: Run tests**

```bash
cd packages/core && pnpm test 2>&1 | tail -5
```

Expected: all tests pass including all 4 `DiagramBuilder` tests.

- [ ] **Step 7: Typecheck and lint**

```bash
cd packages/core && pnpm typecheck && pnpm check
```

- [ ] **Step 8: Commit**

```bash
git -c commit.gpgsign=false commit -am "feat(core): add DiagramBuilder / Bpmn.createDiagram() for multi-process support"
```

---

## Task 7: Fix `exporterVersion` constant

`ProcessBuilder.build()` and `DiagramBuilder.build()` hardcode `exporterVersion: "0.0.1"`. This task extracts it to a named constant so it's visible and easy to update alongside `package.json`.

**Files:**
- Modify: `packages/core/src/bpmn/bpmn-builder.ts`
- Test: `packages/core/tests/bpmn-builder.test.ts`

- [ ] **Step 1: Write the test**

Append to `packages/core/tests/bpmn-builder.test.ts`:

```typescript
// -----------------------------------------------------------------------
// Task 7 — exporterVersion constant
// -----------------------------------------------------------------------

describe("exporterVersion", () => {
  it("ProcessBuilder.build() sets a non-empty exporterVersion", () => {
    const defs = Bpmn.createProcess("proc").build()
    expect(defs.exporterVersion).toBeTruthy()
    expect(typeof defs.exporterVersion).toBe("string")
  })

  it("DiagramBuilder.build() sets the same exporterVersion as ProcessBuilder", () => {
    const single = Bpmn.createProcess("proc").build()
    const multi = Bpmn.createDiagram("D").process("proc", (p) => p.startEvent("s").endEvent("e")).build()
    expect(multi.exporterVersion).toBe(single.exporterVersion)
  })
})
```

- [ ] **Step 2: Run tests — both should pass (baseline, exporterVersion is already a string)**

```bash
cd packages/core && pnpm test 2>&1 | grep "exporterVersion" -A 8
```

Expected: both pass (the constant just needs to be non-empty, which `"0.0.1"` already is).

- [ ] **Step 3: Extract the constant**

Near the top of `bpmn-builder.ts`, after the imports and before the option types (before `// --- Option types ---`), add:

```typescript
// Keep in sync with packages/core/package.json version
const EXPORTER_VERSION = "0.0.23"
```

Then in `ProcessBuilder.build()`, replace:
```typescript
exporterVersion: "0.0.1",
```
with:
```typescript
exporterVersion: EXPORTER_VERSION,
```

And in `DiagramBuilder.build()`, replace the `"0.0.23"` literal (added in Task 6 step 3) with `EXPORTER_VERSION`.

- [ ] **Step 4: Run tests + typecheck + lint**

```bash
cd packages/core && pnpm test && pnpm typecheck && pnpm check
```

Expected: all tests pass, zero errors.

- [ ] **Step 5: Run the full monorepo build to confirm no regressions**

```bash
cd /home/adam/github.com/bpmnkit/monorepo && pnpm turbo build 2>&1 | grep -E "Tasks:|error" | tail -5
```

Expected: all tasks successful, no errors.

- [ ] **Step 6: Update docs**

In `doc/progress.md`, add a new entry dated 2026-06-13 with a summary of all 7 improvements.
In `doc/features.md`, add a section for these builder improvements.

- [ ] **Step 7: Commit**

```bash
git -c commit.gpgsign=false commit -am "feat(core): extract EXPORTER_VERSION constant, update docs"
```

---

## Self-Review

### Spec coverage check

| Identified issue | Task |
|---|---|
| BranchBuilder/SubProcessContentBuilder copy-paste | Task 1 |
| SubProcessContentBuilder has no branching | Task 2 |
| `insertJoinGateways` is magic (warn via strict mode) | Task 3 |
| No build-time validation | Task 3 |
| Boundary event ergonomics backward | Task 4 |
| No task defaults | Task 5 |
| `addStartEvent()` naming is unclear | Task 5 |
| No multi-process builder | Task 6 |
| Hardcoded `"Definitions_1"` and `exporterVersion` | Tasks 6+7 |

Issue **not included:** `.withAutoLayout()` concern separation — removing it would be a breaking change with minimal practical benefit. The existing `Bpmn.autoLayout(xml)` and `applyAutoLayout(defs)` already provide the clean alternative.

### Placeholder scan

No TBD or TODO items. All code blocks are complete.

### Type consistency check

- `makeServiceTaskEl` defined in Task 1, used in Tasks 1, 2, 5.
- `makeUserTaskEl` defined in Task 1, used in Tasks 1, 2. Both call with `(id, options?)`.
- `withBoundary` in Task 4 uses `ProcessBuilder` as handler argument — matches the class definition.
- `DiagramBuilder.process()` in Task 6 calls `new ProcessBuilder(id)` — matches constructor `constructor(processId: string)`.
- `EXPORTER_VERSION` defined in Task 7, referenced in Tasks 6 (DiagramBuilder) and 7 (ProcessBuilder). Task 6 step 3 uses a literal temporarily; Task 7 replaces it with the constant. If Tasks are done in order, no issue.
