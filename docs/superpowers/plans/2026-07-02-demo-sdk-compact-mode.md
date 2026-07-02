# Demo "With SDK Compact Mode" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third demo run, "With SDK (Compact)", where Claude represents the process in a custom low-punctuation DSL that decodes into the SDK's existing `CompactDiagram` shape — ~47% smaller than the equivalent builder TypeScript, no additional information loss beyond what `compactify()` already accepts.

**Architecture:** A new server-side parser (`compact-dsl.ts`) decodes the DSL into a `CompactDiagram` object, then the SDK's own unchanged `expand()` + `Bpmn.export()` produce BPMN XML — fully in-process, no subprocess/temp files. A new system prompt teaches the DSL grammar with a worked example. The frontend adds a third `Variant`, refactors `RaceChart` from two fixed props to an array of rows, and adds a third stacked row to the detailed view, both ordered with the new variant on top.

**Tech Stack:** Hono (server), Preact + Cascivo (frontend), Vitest, Biome, TypeScript strict, `@bpmnkit/core`'s `expand`/`Bpmn.export`.

## Global Constraints

- The DSL decodes into exactly the `CompactDiagram`/`CompactProcess`/`CompactElement`/`CompactFlow` shapes `@bpmnkit/core` already exports — no new fields, no changes to `compactify()`/`expand()` themselves.
- Flow IDs and the top-level diagram ID are never written in the DSL — the parser synthesizes them (matching how the fluent builder never asks callers to name flows).
- `Recording.panels["with-sdk-compact"]` is optional — existing recordings without it must keep working everywhere it's read.
- The new variant's color is Cascivo `Badge` variant `"warning"` / CSS var `--bpmnkit-warn` (confirmed against `@cascivo/react`'s actual `BadgeProps` type — distinct from `"success"`/`"destructive"` already used).
- Chart bars and detailed-view rows are always ordered `[with-sdk-compact, with-sdk, without-sdk]` — the new one on top.
- `comparison-banner.ts`'s `buildComparisonBanner` is NOT modified — it continues to compare only with-sdk vs. without-sdk.
- ESM only, `.js` extensions in relative imports. Biome: tabs, double quotes, semicolons `asNeeded`, 100 char width, zero warnings. TypeScript strict, zero errors.

---

### Task 1: Compact DSL parser

**Files:**
- Create: `apps/demo/server/compact-dsl.ts`
- Test: `apps/demo/server/compact-dsl.test.ts`

**Interfaces:**
- Produces: `parseCompactDsl(text: string): CompactDiagram` (the `CompactDiagram`/`CompactElement`/`CompactFlow` types come from `@bpmnkit/core`). Throws `Error` with a `"line N: ..."` message on any malformed input.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing tests**

Create `apps/demo/server/compact-dsl.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { parseCompactDsl } from "./compact-dsl.js"

describe("parseCompactDsl", () => {
	it("parses a process header with a quoted name", () => {
		const dsl = `process Proc "My Process"
start s "Start"
`
		const result = parseCompactDsl(dsl)
		expect(result.processes).toHaveLength(1)
		expect(result.processes[0].id).toBe("Proc")
		expect(result.processes[0].name).toBe("My Process")
	})

	it("parses a start event with a quoted name", () => {
		const dsl = `process P
start s "Begin"
`
		const result = parseCompactDsl(dsl)
		expect(result.processes[0].elements).toEqual([{ id: "s", type: "startEvent", name: "Begin" }])
	})

	it("parses a start event with no name", () => {
		const dsl = `process P
start s
`
		const result = parseCompactDsl(dsl)
		expect(result.processes[0].elements).toEqual([{ id: "s", type: "startEvent" }])
	})

	it("parses a service task with job type and task headers", () => {
		const dsl = `process P
service t "Fetch" job=io.camunda:http-json:1 h.resultVariable=res h.resultExpression="=res.body"
`
		const result = parseCompactDsl(dsl)
		expect(result.processes[0].elements[0]).toEqual({
			id: "t",
			type: "serviceTask",
			name: "Fetch",
			jobType: "io.camunda:http-json:1",
			taskHeaders: { resultVariable: "res", resultExpression: "=res.body" },
		})
	})

	it("parses a flow with a quoted name and condition containing an escaped quote", () => {
		const dsl = `process P
a -> b "low-risk" if="=tier = \\"low\\""
`
		const result = parseCompactDsl(dsl)
		expect(result.processes[0].flows[0]).toMatchObject({
			from: "a",
			to: "b",
			name: "low-risk",
			condition: '=tier = "low"',
		})
	})

	it("parses a flow with no name or condition", () => {
		const dsl = `process P
a -> b
`
		const result = parseCompactDsl(dsl)
		expect(result.processes[0].flows[0]).toMatchObject({ from: "a", to: "b" })
		expect(result.processes[0].flows[0].name).toBeUndefined()
		expect(result.processes[0].flows[0].condition).toBeUndefined()
	})

	it("parses a boundary event with at=, event=, and noninterrupt", () => {
		const dsl = `process P
boundary b "Timeout" at=task1 event=timer noninterrupt
`
		const result = parseCompactDsl(dsl)
		expect(result.processes[0].elements[0]).toEqual({
			id: "b",
			type: "boundaryEvent",
			name: "Timeout",
			attachedTo: "task1",
			eventType: "timer",
			interrupting: false,
		})
	})

	it("parses nested elements and flows inside a subProcess, resuming root elements after", () => {
		const dsl = `process P
sub outer "Outer"
  start is "Inner Start"
  end ie "Inner End"
  is -> ie
end e
`
		const result = parseCompactDsl(dsl)
		const outer = result.processes[0].elements.find((el) => el.id === "outer")
		expect(outer?.children?.elements).toHaveLength(2)
		expect(outer?.children?.flows).toHaveLength(1)
		expect(outer?.children?.flows[0]).toMatchObject({ from: "is", to: "ie" })
		expect(result.processes[0].elements.some((el) => el.id === "e")).toBe(true)
		expect(result.processes[0].elements).toHaveLength(2)
	})

	it("assigns each flow a unique id even though the DSL never specifies one", () => {
		const dsl = `process P
a -> b
b -> c
`
		const result = parseCompactDsl(dsl)
		const ids = result.processes[0].flows.map((f) => f.id)
		expect(new Set(ids).size).toBe(2)
	})

	it("throws with a line number on an unknown tag", () => {
		const dsl = `process P
foo x "Bad"
`
		expect(() => parseCompactDsl(dsl)).toThrow(/line 2/)
	})

	it("throws when indentation is not a multiple of 2 spaces", () => {
		const dsl = `process P
 start s
`
		expect(() => parseCompactDsl(dsl)).toThrow(/indentation/)
	})

	it("throws when no process line is present", () => {
		const dsl = `start s "Begin"
`
		expect(() => parseCompactDsl(dsl)).toThrow(/process/)
	})
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/demo/`): `npx vitest run server/compact-dsl.test.ts`
Expected: FAIL — `Failed to resolve import "./compact-dsl.js"` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `apps/demo/server/compact-dsl.ts`:

```typescript
import type { CompactDiagram, CompactElement, CompactFlow } from "@bpmnkit/core"

const TAG_TO_TYPE: Record<string, string> = {
	start: "startEvent",
	end: "endEvent",
	task: "task",
	service: "serviceTask",
	user: "userTask",
	script: "scriptTask",
	rule: "businessRuleTask",
	send: "sendTask",
	receive: "receiveTask",
	call: "callActivity",
	xgw: "exclusiveGateway",
	pgw: "parallelGateway",
	igw: "inclusiveGateway",
	egw: "eventBasedGateway",
	boundary: "boundaryEvent",
	throw: "intermediateThrowEvent",
	catch: "intermediateCatchEvent",
	sub: "subProcess",
	adhoc: "adHocSubProcess",
	eventsub: "eventSubProcess",
}

const CONTAINER_TAGS = new Set(["sub", "adhoc", "eventsub"])

/**
 * Splits a line into whitespace-separated tokens, treating a "..." span
 * (with \"-escaped inner quotes) as one token even if it contains spaces —
 * this is what lets `if="=tier = \"low\""` parse as a single field token.
 */
function tokenizeLine(line: string): string[] {
	const tokens: string[] = []
	let i = 0
	while (i < line.length) {
		while (i < line.length && line[i] === " ") i++
		if (i >= line.length) break
		const start = i
		let inQuotes = false
		while (i < line.length) {
			const ch = line[i]
			if (ch === '"' && line[i - 1] !== "\\") {
				inQuotes = !inQuotes
			}
			if (ch === " " && !inQuotes) break
			i++
		}
		tokens.push(line.slice(start, i))
	}
	return tokens
}

/** Strips surrounding double quotes and un-escapes \" to " — a no-op for an unquoted value. */
function unquote(value: string): string {
	if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
		return value.slice(1, -1).replaceAll('\\"', '"')
	}
	return value
}

/** Number of leading 2-space indent levels; throws if not a multiple of 2. */
function countIndent(rawLine: string, lineNo: number): number {
	const match = rawLine.match(/^( *)/)
	const spaces = match ? match[1].length : 0
	if (spaces % 2 !== 0) {
		throw new Error(`line ${lineNo}: indentation must be a multiple of 2 spaces`)
	}
	return spaces / 2
}

function parseElementLine(tag: string, tokens: string[], lineNo: number): CompactElement {
	const type = TAG_TO_TYPE[tag]
	if (!type) throw new Error(`line ${lineNo}: unknown tag "${tag}"`)

	const id = tokens[1]
	if (!id) throw new Error(`line ${lineNo}: element missing id`)

	let fieldStart = 2
	const nameToken = tokens[2]
	const element: CompactElement = { id, type: type as CompactElement["type"] }
	if (nameToken?.startsWith('"')) {
		element.name = unquote(nameToken)
		fieldStart = 3
	}

	const headers: Record<string, string> = {}
	let hasHeaders = false

	for (let i = fieldStart; i < tokens.length; i++) {
		const token = tokens[i]
		if (token === "noninterrupt") {
			element.interrupting = false
			continue
		}
		const eq = token.indexOf("=")
		if (eq === -1) throw new Error(`line ${lineNo}: unrecognized token "${token}"`)
		const key = token.slice(0, eq)
		const value = unquote(token.slice(eq + 1))

		if (key.startsWith("h.")) {
			headers[key.slice(2)] = value
			hasHeaders = true
		} else if (key === "job") element.jobType = value
		else if (key === "call") element.calledProcess = value
		else if (key === "form") element.formId = value
		else if (key === "decision") element.decisionId = value
		else if (key === "result") element.resultVariable = value
		else if (key === "event") element.eventType = value
		else if (key === "at") element.attachedTo = value
		else throw new Error(`line ${lineNo}: unknown field "${key}"`)
	}

	if (hasHeaders) element.taskHeaders = headers
	return element
}

function parseFlowLine(tokens: string[], lineNo: number, nextFlowId: () => string): CompactFlow {
	const from = tokens[0]
	const to = tokens[2]
	if (!from || !to) throw new Error(`line ${lineNo}: flow missing from/to`)

	const flow: CompactFlow = { id: nextFlowId(), from, to }

	let i = 3
	const nameToken = tokens[3]
	if (nameToken?.startsWith('"')) {
		flow.name = unquote(nameToken)
		i = 4
	}
	for (; i < tokens.length; i++) {
		const token = tokens[i]
		const eq = token.indexOf("=")
		if (eq === -1) throw new Error(`line ${lineNo}: unrecognized token "${token}"`)
		const key = token.slice(0, eq)
		const value = unquote(token.slice(eq + 1))
		if (key === "if") flow.condition = value
		else throw new Error(`line ${lineNo}: unknown flow field "${key}"`)
	}
	return flow
}

interface Frame {
	containerIndent: number
	elements: CompactElement[]
	flows: CompactFlow[]
}

/**
 * Parses the compact notation DSL into the same CompactDiagram shape
 * @bpmnkit/core's own compactify() produces. See the "Compact Notation"
 * section of the with-sdk-compact system prompt for the grammar.
 */
export function parseCompactDsl(text: string): CompactDiagram {
	let flowIdCounter = 0
	const nextFlowId = () => `Flow_compact_${++flowIdCounter}`

	let processId: string | null = null
	let processName: string | undefined

	const rootElements: CompactElement[] = []
	const rootFlows: CompactFlow[] = []
	const stack: Frame[] = [{ containerIndent: -1, elements: rootElements, flows: rootFlows }]

	const lines = text.split("\n")
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i]
		const lineNo = i + 1
		if (raw.trim() === "") continue

		const indent = countIndent(raw, lineNo)
		const tokens = tokenizeLine(raw.trim())
		if (tokens.length === 0) continue

		while (stack.length > 1 && indent <= stack[stack.length - 1].containerIndent) {
			stack.pop()
		}
		const frame = stack[stack.length - 1]

		if (tokens[1] === "->") {
			frame.flows.push(parseFlowLine(tokens, lineNo, nextFlowId))
			continue
		}

		if (tokens[0] === "process") {
			processId = tokens[1]
			processName = tokens[2] ? unquote(tokens[2]) : undefined
			continue
		}

		const element = parseElementLine(tokens[0], tokens, lineNo)
		frame.elements.push(element)

		if (CONTAINER_TAGS.has(tokens[0])) {
			element.children = { elements: [], flows: [] }
			stack.push({
				containerIndent: indent,
				elements: element.children.elements,
				flows: element.children.flows,
			})
		}
	}

	if (processId === null) {
		throw new Error('missing "process" line')
	}

	return {
		id: "Definitions_1",
		processes: [{ id: processId, name: processName, elements: rootElements, flows: rootFlows }],
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/compact-dsl.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Typecheck and lint**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.server.json`
Run (from repo root): `pnpm biome check apps/demo/server/compact-dsl.ts apps/demo/server/compact-dsl.test.ts`
Expected: both clean. If formatting differs, run `pnpm biome check --write` on the same paths and re-check.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/server/compact-dsl.ts apps/demo/server/compact-dsl.test.ts
git commit --no-gpg-sign -m "feat(demo): add compact notation DSL parser"
```

---

### Task 2: Worked-example fixture and executor

**Files:**
- Create: `apps/demo/server/fixtures/loan-approval.dsl`
- Create: `apps/demo/server/compact-executor.ts`
- Test: `apps/demo/server/compact-executor.test.ts`

**Interfaces:**
- Consumes (from Task 1): `parseCompactDsl(text: string): CompactDiagram` from `./compact-dsl.js`.
- Produces: `executeCompactDsl(dslText: string): string` (returns BPMN XML, throws on malformed input). The fixture file, read by Task 4's system prompt builder.

- [ ] **Step 1: Create the fixture file**

Create `apps/demo/server/fixtures/loan-approval.dsl` with exactly this content:

```
process LoanApproval "Loan Approval Process"
start start "Application Received"
service fetchCreditScore "Fetch Credit Score" job=io.camunda:http-json:1 h.resultVariable=creditBureauResponse h.resultExpression="=creditBureauResponse.body"
xgw preScreen "Credit Score >= 580?"
service sendRejectionLetter "Send Rejection Letter" job=email-sender h.template=loan-rejected-credit
end endRejectedAutomatic "Rejected - Credit Score"
rule riskScoring "Calculate Risk Score" decision=loan-risk-scoring result=riskAssessment
xgw riskGateway "Risk Tier?"
script calculateRate "Calculate Interest Rate" result=interestRate
service generateOffer "Generate Loan Offer" job=offer-generator result=loanOfferId
user underwriterReview "Underwriter Review" form=underwriter-review-form
service sendHighRiskRejection "Send Rejection Letter" job=email-sender h.template=loan-rejected-risk
end endRejectedRisk "Rejected - High Risk"
xgw underwriterDecision "Underwriter Approved?"
service sendManualRejection "Send Rejection Letter" job=email-sender h.template=loan-rejected-underwriter
end endRejectedManual "Rejected - Underwriter"
service notifyApplicant "Send Offer to Applicant" job=email-sender h.template=loan-offer
end endApproved "Loan Approved"
start -> fetchCreditScore
fetchCreditScore -> preScreen
preScreen -> sendRejectionLetter "rejected-prescreening" if="=creditBureauResponse.score < 580"
sendRejectionLetter -> endRejectedAutomatic
preScreen -> riskScoring "passed-prescreening" if="=creditBureauResponse.score >= 580"
riskScoring -> riskGateway
riskGateway -> calculateRate "low-risk" if="=riskAssessment.tier = \"low\""
calculateRate -> generateOffer
generateOffer -> notifyApplicant
riskGateway -> underwriterReview "medium-risk" if="=riskAssessment.tier = \"medium\""
underwriterReview -> underwriterDecision
riskGateway -> sendHighRiskRejection "high-risk"
sendHighRiskRejection -> endRejectedRisk
underwriterDecision -> notifyApplicant "uw-approved" if="=underwriterApproved = true"
underwriterDecision -> sendManualRejection "uw-rejected"
sendManualRejection -> endRejectedManual
notifyApplicant -> endApproved
```

- [ ] **Step 2: Write the failing tests**

Create `apps/demo/server/compact-executor.test.ts`:

```typescript
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { executeCompactDsl } from "./compact-executor.js"

describe("executeCompactDsl", () => {
	it("produces valid BPMN XML for a simple process", () => {
		const dsl = `process P "Simple"
start s "Start"
end e "End"
s -> e
`
		const xml = executeCompactDsl(dsl)
		expect(xml).toContain("<?xml")
		expect(xml).toContain('id="P"')
		expect(xml).toContain("bpmn:startEvent")
		expect(xml).toContain("bpmn:endEvent")
	})

	it("throws when the DSL is malformed", () => {
		expect(() => executeCompactDsl("not valid dsl")).toThrow()
	})

	it("produces valid BPMN XML for the loan-approval fixture", () => {
		const dsl = readFileSync(
			fileURLToPath(new URL("./fixtures/loan-approval.dsl", import.meta.url)),
			"utf-8",
		)
		const xml = executeCompactDsl(dsl)
		expect(xml).toContain("bpmn:process")
		expect(xml).toContain('id="LoanApproval"')
	})
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `apps/demo/`): `npx vitest run server/compact-executor.test.ts`
Expected: FAIL — `Failed to resolve import "./compact-executor.js"`.

- [ ] **Step 4: Write the implementation**

Create `apps/demo/server/compact-executor.ts`:

```typescript
import { Bpmn, expand } from "@bpmnkit/core"
import { parseCompactDsl } from "./compact-dsl.js"

/**
 * Decodes compact notation DSL text into valid BPMN 2.0 XML, entirely
 * in-process (no subprocess, no temp files) via the SDK's own expand()
 * and Bpmn.export(). Throws if the DSL is malformed.
 */
export function executeCompactDsl(dslText: string): string {
	const compact = parseCompactDsl(dslText)
	const definitions = expand(compact)
	return Bpmn.export(definitions)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/compact-executor.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Typecheck and lint**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.server.json`
Run (from repo root): `pnpm biome check apps/demo/server/compact-executor.ts apps/demo/server/compact-executor.test.ts`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add apps/demo/server/fixtures/loan-approval.dsl apps/demo/server/compact-executor.ts apps/demo/server/compact-executor.test.ts
git commit --no-gpg-sign -m "feat(demo): add loan-approval DSL fixture and compact executor"
```

---

### Task 3: `extractCompactBlock`

**Files:**
- Modify: `apps/demo/server/extractor.ts`
- Modify: `apps/demo/server/extractor.test.ts`

**Interfaces:**
- Produces: `extractCompactBlock(text: string): string | null`.

Read the current file first — `apps/demo/server/extractor.ts` — before editing.

- [ ] **Step 1: Write the failing tests**

In `apps/demo/server/extractor.test.ts`, update the import line:

```typescript
import { extractCompactBlock, extractTsBlock, extractXmlBlock } from "./extractor.js"
```

Append a new describe block at the end of the file:

```typescript

describe("extractCompactBlock", () => {
	it("returns null when no compact notation present", () => {
		expect(extractCompactBlock("no code here")).toBeNull()
	})

	it("strips compact fences", () => {
		const text = "```compact\nprocess P\nstart s\n```"
		expect(extractCompactBlock(text)).toBe("process P\nstart s")
	})

	it("extracts a mid-text fenced compact block", () => {
		const text = "Here you go:\n```compact\nprocess P\nstart s\n```\nDone."
		expect(extractCompactBlock(text)).toBe("process P\nstart s")
	})

	it("returns text unchanged when already raw compact notation (no fences)", () => {
		const text = "process P\nstart s"
		expect(extractCompactBlock(text)).toBe(text)
	})
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/demo/`): `npx vitest run server/extractor.test.ts`
Expected: FAIL — `extractCompactBlock` is not exported from `./extractor.js` (doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Append to `apps/demo/server/extractor.ts`:

```typescript

/**
 * Extracts compact-notation text from LLM output.
 * Strips markdown fences if present; returns raw text if no fences found.
 * Returns null if no compact notation detected (no fences and no "process" line).
 */
export function extractCompactBlock(text: string): string | null {
	const trimmed = text.trim()
	if (!trimmed) return null

	// Try to find a fenced code block (```compact)
	const fenced = trimmed.match(/^```compact\n([\s\S]*?)\n```$/m)
	if (fenced) return fenced[1].trim()

	// Also check for mid-text fenced block
	const midFenced = trimmed.match(/```compact\n([\s\S]*?)\n```/)
	if (midFenced) return midFenced[1].trim()

	// No fences — check if it looks like compact notation (starts with a process line)
	if (/^process\s+\S/m.test(trimmed)) {
		return trimmed
	}

	// Plain text, not compact notation
	return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/extractor.test.ts`
Expected: PASS, 11 tests (7 existing + 4 new).

- [ ] **Step 5: Typecheck and lint**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.server.json`
Run (from repo root): `pnpm biome check apps/demo/server/extractor.ts apps/demo/server/extractor.test.ts`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/server/extractor.ts apps/demo/server/extractor.test.ts
git commit --no-gpg-sign -m "feat(demo): add extractCompactBlock"
```

---

### Task 4: Compact-mode system prompt

**Files:**
- Modify: `apps/demo/server/system-prompt.ts`
- Modify: `apps/demo/server/system-prompt.test.ts`

**Interfaces:**
- Consumes (from Task 2): reads `apps/demo/server/fixtures/loan-approval.dsl` (path relative to `repoRoot`).
- Produces: `buildCompactSystemPrompt(repoRoot: string): string`.

Read the current file first — `apps/demo/server/system-prompt.ts` — before editing.

- [ ] **Step 1: Write the failing tests**

In `apps/demo/server/system-prompt.test.ts`, update the import line:

```typescript
import { WITHOUT_SDK_SYSTEM_PROMPT, buildCompactSystemPrompt, buildSdkSystemPrompt } from "./system-prompt.js"
```

Append a new describe block at the end of the file:

```typescript

describe("buildCompactSystemPrompt", () => {
	it("returns a non-empty string", () => {
		const prompt = buildCompactSystemPrompt(REPO_ROOT)
		expect(typeof prompt).toBe("string")
		expect(prompt.length).toBeGreaterThan(500)
	})

	it("includes the grammar's tag table", () => {
		const prompt = buildCompactSystemPrompt(REPO_ROOT)
		expect(prompt).toContain("startEvent")
		expect(prompt).toContain("subProcess")
	})

	it("includes the worked example's process id", () => {
		const prompt = buildCompactSystemPrompt(REPO_ROOT)
		expect(prompt).toContain("LoanApproval")
	})

	it("includes the output instruction", () => {
		const prompt = buildCompactSystemPrompt(REPO_ROOT)
		expect(prompt).toContain("```compact")
	})
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/demo/`): `npx vitest run server/system-prompt.test.ts`
Expected: FAIL — `buildCompactSystemPrompt` is not exported from `./system-prompt.js` (doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Append to `apps/demo/server/system-prompt.ts`:

```typescript

export function buildCompactSystemPrompt(repoRoot: string): string {
	const example = readFileSync(join(repoRoot, "apps/demo/server/fixtures/loan-approval.dsl"), "utf-8")

	return `You are an expert at representing Camunda 8 BPMN processes in a compact,
line-based notation that gets decoded into full BPMN by @bpmnkit/core. This
notation carries the exact same process logic as the full TypeScript SDK —
it's a terser representation of the identical process, not a simplified one.

## Compact Notation Grammar

One line per element or flow. Tokens are separated by spaces; wrap any value
containing spaces in double quotes (escape inner quotes as \\").

### Process header (exactly one line, first)
    process <id> ["<name>"]

### Elements
    <tag> <id> ["<name>"] [field=value ...]

Tags:
    start     startEvent
    end       endEvent
    task      task (generic, no Zeebe extension)
    service   serviceTask
    user      userTask
    script    scriptTask
    rule      businessRuleTask
    send      sendTask
    receive   receiveTask
    call      callActivity
    xgw       exclusiveGateway
    pgw       parallelGateway
    igw       inclusiveGateway
    egw       eventBasedGateway
    boundary  boundaryEvent
    throw     intermediateThrowEvent
    catch     intermediateCatchEvent
    sub       subProcess
    adhoc     adHocSubProcess
    eventsub  eventSubProcess

Fields (all optional, any order, only include what applies):
    job=<value>        Zeebe job type (service/send/receive/call/task)
    h.<key>=<value>     one task header entry (repeatable)
    call=<value>       called process id (callActivity)
    form=<value>        Camunda form id (userTask)
    decision=<value>   DMN decision id (businessRuleTask)
    result=<value>     result variable name
    event=<value>       event definition type, e.g. timer/message/error/signal
    at=<value>          boundary event's host activity id
    noninterrupt        bare flag — boundary event does not cancel its host

Do NOT invent fields beyond this list — this notation intentionally cannot
represent everything the full SDK can (e.g. REST connector input mappings,
multi-instance loop configuration, gateway default-flow markers). Represent
what you can with the fields above and omit the rest; do not approximate a
missing field with an unlisted one.

### Flows
    <fromId> -> <toId> ["<name>"] [if="<condition>"]

A line is a flow if its 2nd token is exactly \`->\`; otherwise it is an
element line dispatched by tag.

### Nesting
Indent child elements/flows by exactly 2 spaces per level under a
sub/adhoc/eventsub line. A line back at the parent's indent (or less) ends
the nested block.

Flow and diagram IDs are never written — the decoder generates them.

## Worked Example — Loan Approval
Study this example carefully. It represents the exact same process as the
full-SDK builder example, just in this notation.

\`\`\`compact
${example}
\`\`\`

## Output Instructions
- Output ONLY the compact notation — no explanation, no markdown prose outside the code block.
- Wrap your output in a single \`\`\`compact code block.
- Use the exact same scenario logic you would use for the full SDK.`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/demo/`): `npx vitest run server/system-prompt.test.ts`
Expected: PASS, 9 tests (5 existing + 4 new).

- [ ] **Step 5: Typecheck and lint**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.server.json`
Run (from repo root): `pnpm biome check apps/demo/server/system-prompt.ts apps/demo/server/system-prompt.test.ts`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/server/system-prompt.ts apps/demo/server/system-prompt.test.ts
git commit --no-gpg-sign -m "feat(demo): add buildCompactSystemPrompt teaching the compact DSL"
```

---

### Task 5: Wire the new route into `index.ts`

**Files:**
- Modify: `apps/demo/server/index.ts`

**Interfaces:**
- Consumes: `executeCompactDsl` (Task 2), `extractCompactBlock` (Task 3), `buildCompactSystemPrompt` (Task 4).
- Produces: `GET /stream/with-sdk-compact` route; `GET /prompts` gains a `withSdkCompact` key.

There is no automated test for `index.ts` (pre-existing, out of scope — it starts a real server as an import-time side effect). Verify this task live.

Read the current file first — `apps/demo/server/index.ts` — before editing.

- [ ] **Step 1: Update imports**

Replace:

```typescript
import { extractTsBlock, extractXmlBlock } from "./extractor.js"
import { saveRecording } from "./recordings-store.js"
import { DEFAULT_SCENARIO_ID, SCENARIOS, getScenario } from "./scenarios.js"
import { executeSdkCode } from "./sdk-executor.js"
import { extractDeltaText, extractResultUsage } from "./stream-parsers.js"
import { WITHOUT_SDK_SYSTEM_PROMPT, buildSdkSystemPrompt } from "./system-prompt.js"
```

with:

```typescript
import { executeCompactDsl } from "./compact-executor.js"
import { extractCompactBlock, extractTsBlock, extractXmlBlock } from "./extractor.js"
import { saveRecording } from "./recordings-store.js"
import { DEFAULT_SCENARIO_ID, SCENARIOS, getScenario } from "./scenarios.js"
import { executeSdkCode } from "./sdk-executor.js"
import { extractDeltaText, extractResultUsage } from "./stream-parsers.js"
import {
	WITHOUT_SDK_SYSTEM_PROMPT,
	buildCompactSystemPrompt,
	buildSdkSystemPrompt,
} from "./system-prompt.js"
```

- [ ] **Step 2: Build the compact system prompt once at module load**

Replace:

```typescript
const SDK_SYSTEM_PROMPT = buildSdkSystemPrompt(REPO_ROOT)
```

with:

```typescript
const SDK_SYSTEM_PROMPT = buildSdkSystemPrompt(REPO_ROOT)
const COMPACT_SYSTEM_PROMPT = buildCompactSystemPrompt(REPO_ROOT)
```

- [ ] **Step 3: Add the third key to `GET /prompts`**

Replace:

```typescript
app.get("/prompts", (c) =>
	c.json({
		withSdk: SDK_SYSTEM_PROMPT,
		withoutSdk: WITHOUT_SDK_SYSTEM_PROMPT,
	}),
)
```

with:

```typescript
app.get("/prompts", (c) =>
	c.json({
		withSdk: SDK_SYSTEM_PROMPT,
		withSdkCompact: COMPACT_SYSTEM_PROMPT,
		withoutSdk: WITHOUT_SDK_SYSTEM_PROMPT,
	}),
)
```

- [ ] **Step 4: Add the new route**

Add this new route directly after the closing `})` of `/stream/with-sdk` (before `/stream/without-sdk`):

```typescript
app.get("/stream/with-sdk-compact", (c) => {
	const scenarioId = c.req.query("scenario") ?? DEFAULT_SCENARIO_ID
	const scenario = getScenario(scenarioId)
	if (!scenario) {
		return c.json({ error: `Unknown scenario "${scenarioId}"` }, 400)
	}
	return streamSSE(c, async (stream) => {
		let usage: TokenUsage | null = null
		try {
			const result = await streamLlm(scenario.prompt, COMPACT_SYSTEM_PROMPT, async (text) => {
				await stream.writeSSE({ event: "chunk", data: JSON.stringify({ text }) })
			})
			usage = result.usage
			await stream.writeSSE({ event: "done", data: "{}" })

			const dslText = extractCompactBlock(result.text)
			if (!dslText) {
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({
						message: "No compact notation block found in LLM output",
						usage,
					}),
				})
				return
			}

			const xml = executeCompactDsl(dslText)
			await stream.writeSSE({ event: "bpmn", data: JSON.stringify({ xml, usage }) })
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			await stream.writeSSE({ event: "error", data: JSON.stringify({ message, usage }) })
		}
	})
})
```

- [ ] **Step 5: Typecheck**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.server.json`
Expected: no errors.

- [ ] **Step 6: Manual verification against the real server**

Start the server in the background: `npx tsx server/index.ts &` (from `apps/demo/`, use an alternate `PORT` if 3001 is unavailable in your environment — see prior rounds' notes on this), wait ~2s, then:

```bash
curl -s http://localhost:3001/prompts | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);console.log(Object.keys(j))})'
```
Expected: `[ 'withSdk', 'withSdkCompact', 'withoutSdk' ]`

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/stream/with-sdk-compact?scenario=not-a-real-scenario"
```
Expected: `400`

Stop the server: `pkill -f "tsx server/index.ts"`.

- [ ] **Step 7: Lint**

Run (from repo root): `pnpm biome check apps/demo/server/index.ts`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add apps/demo/server/index.ts
git commit --no-gpg-sign -m "feat(demo): wire GET /stream/with-sdk-compact and expose it via /prompts"
```

---

### Task 6: `Recording` type gains the third panel

**Files:**
- Modify: `apps/demo/shared/recording-types.ts`

**Interfaces:**
- Produces: `Recording.panels["with-sdk-compact"]?: RecordedPanel` (optional).

- [ ] **Step 1: Add the optional key**

Replace:

```typescript
export interface Recording {
	name: string
	recordedAt: string
	scenarioId?: string
	scenarioPrompt: string
	panels: {
		"with-sdk": RecordedPanel
		"without-sdk": RecordedPanel
	}
}
```

with:

```typescript
export interface Recording {
	name: string
	recordedAt: string
	scenarioId?: string
	scenarioPrompt: string
	panels: {
		"with-sdk": RecordedPanel
		"with-sdk-compact"?: RecordedPanel
		"without-sdk": RecordedPanel
	}
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.json` and `npx tsc --noEmit -p tsconfig.server.json`
Expected: no errors from this change alone (later tasks will reference the new key; if run in isolation before Task 9, App.tsx may show unrelated errors — that's fine, this task only needs to confirm the type itself is valid).

- [ ] **Step 3: Lint**

Run (from repo root): `pnpm biome check apps/demo/shared/recording-types.ts`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/demo/shared/recording-types.ts
git commit --no-gpg-sign -m "feat(demo): add optional with-sdk-compact panel to Recording"
```

---

### Task 7: `RaceChart` refactor to an array of rows

**Files:**
- Modify: `apps/demo/src/RaceChart.tsx`

**Interfaces:**
- Produces: `RaceChartRow { id: string; label: string; colorVar: string; data: RaceChartPanelData }`, `RaceChartProps { rows: RaceChartRow[] }`, `RaceChart(props: RaceChartProps)`. `RaceChartPanelData` is unchanged. Task 9 constructs the `rows` array and renders this component.

No automated test for this file (established precedent for `App.tsx`/`RaceChart.tsx`-adjacent UI).

- [ ] **Step 1: Replace the file**

Replace the full contents of `apps/demo/src/RaceChart.tsx` with:

```tsx
import type { TokenUsage } from "../shared/recording-types.js"
import { formatTokenCount } from "./format-tokens.js"

const MIN_AXIS_MAX_MS = 5 * 60 * 1000
const MINUTE_MS = 60 * 1000

export interface RaceChartPanelData {
	elapsedMs: number
	streaming: boolean
	text: string
	usage: TokenUsage | null
	finished: boolean
}

export interface RaceChartRow {
	id: string
	label: string
	colorVar: string
	data: RaceChartPanelData
}

export interface RaceChartProps {
	rows: RaceChartRow[]
}

function computeAxisMaxMs(elapsedTimes: number[]): number {
	const maxElapsed = Math.max(...elapsedTimes)
	if (maxElapsed <= MIN_AXIS_MAX_MS) return MIN_AXIS_MAX_MS
	return Math.ceil(maxElapsed / MINUTE_MS) * MINUTE_MS
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

interface BarProps {
	label: string
	colorVar: string
	data: RaceChartPanelData
	axisMaxMs: number
}

function Bar({ label, colorVar, data, axisMaxMs }: BarProps) {
	const widthPct = Math.min((data.elapsedMs / axisMaxMs) * 100, 100)
	const tickerText = data.streaming ? data.text.slice(-70) : null

	return (
		<div class="flex flex-col gap-1">
			<div class="flex items-center justify-between text-xs">
				<span style={`color: var(${colorVar});`} class="font-bold uppercase">
					{label}
				</span>
				<span style="color: var(--bpmnkit-fg-muted, #8888a8);" class="font-mono">
					{formatDuration(data.elapsedMs)}
					{data.finished &&
						data.usage &&
						` · ${formatTokenCount(data.usage.inputTokens)} in / ${formatTokenCount(data.usage.outputTokens)} out`}
				</span>
			</div>
			<div class="h-8 rounded overflow-hidden" style="background: var(--bpmnkit-surface-2, #1e1e2e);">
				<div
					class="h-full rounded transition-[width]"
					style={`width: ${widthPct}%; background: var(${colorVar});`}
				/>
			</div>
			{tickerText && (
				<div class="text-xs truncate font-mono" style="color: var(--bpmnkit-fg-muted, #8888a8);">
					…{tickerText}
				</div>
			)}
		</div>
	)
}

export function RaceChart({ rows }: RaceChartProps) {
	const axisMaxMs = computeAxisMaxMs(rows.map((row) => row.data.elapsedMs))
	const tickCount = Math.round(axisMaxMs / MINUTE_MS)

	return (
		<div class="flex flex-col gap-6 p-8 h-full justify-center">
			{rows.map((row) => (
				<Bar
					key={row.id}
					label={row.label}
					colorVar={row.colorVar}
					data={row.data}
					axisMaxMs={axisMaxMs}
				/>
			))}
			<div
				class="flex justify-between text-xs font-mono"
				style="color: var(--bpmnkit-fg-muted, #8888a8);"
			>
				{Array.from({ length: tickCount + 1 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: axis is static, no reordering
					<span key={i}>{formatDuration(i * MINUTE_MS)}</span>
				))}
			</div>
		</div>
	)
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.json`
Expected: errors in `App.tsx` only (it still calls `<RaceChart withSdk={...} withoutSdk={...} />`, which no longer matches `RaceChartProps` — Task 9 fixes this). Confirm no errors are in `RaceChart.tsx` itself.

- [ ] **Step 3: Lint**

Run (from repo root): `pnpm biome check apps/demo/src/RaceChart.tsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/demo/src/RaceChart.tsx
git commit --no-gpg-sign -m "refactor(demo): RaceChart takes an array of rows instead of two fixed props"
```

---

### Task 8: `ComparePanel` gains the third variant

**Files:**
- Modify: `apps/demo/src/ComparePanel.tsx`

**Interfaces:**
- Produces: `ComparePanelProps["variant"]` widened to `"with-sdk" | "with-sdk-compact" | "without-sdk"`.

- [ ] **Step 1: Widen the variant type and label/badge maps**

Replace:

```tsx
interface ComparePanelProps {
	variant: "with-sdk" | "without-sdk"
	text: string
	bpmnXml: string | null
	bpmnError: string | null
	streaming: boolean
	elapsedMs: number
	usage: TokenUsage | null
	onViewPrompt: () => void
	promptAvailable: boolean
}

const LABELS = {
	"with-sdk": "WITH SDK",
	"without-sdk": "WITHOUT SDK",
} satisfies Record<ComparePanelProps["variant"], string>

const BADGE_VARIANTS = {
	"with-sdk": "success",
	"without-sdk": "destructive",
} satisfies Record<ComparePanelProps["variant"], "success" | "destructive">
```

with:

```tsx
interface ComparePanelProps {
	variant: "with-sdk" | "with-sdk-compact" | "without-sdk"
	text: string
	bpmnXml: string | null
	bpmnError: string | null
	streaming: boolean
	elapsedMs: number
	usage: TokenUsage | null
	onViewPrompt: () => void
	promptAvailable: boolean
}

const LABELS = {
	"with-sdk": "WITH SDK",
	"with-sdk-compact": "WITH SDK (COMPACT)",
	"without-sdk": "WITHOUT SDK",
} satisfies Record<ComparePanelProps["variant"], string>

const BADGE_VARIANTS = {
	"with-sdk": "success",
	"with-sdk-compact": "warning",
	"without-sdk": "destructive",
} satisfies Record<ComparePanelProps["variant"], "success" | "warning" | "destructive">
```

- [ ] **Step 2: Typecheck**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.json`
Expected: pre-existing `App.tsx` errors from Task 7 remain (unrelated); no new errors in `ComparePanel.tsx`.

- [ ] **Step 3: Lint**

Run (from repo root): `pnpm biome check apps/demo/src/ComparePanel.tsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/demo/src/ComparePanel.tsx
git commit --no-gpg-sign -m "feat(demo): add with-sdk-compact label and warning badge to ComparePanel"
```

---

### Task 9: Wire everything into `App.tsx`

**Files:**
- Modify: `apps/demo/src/App.tsx`

**Interfaces:**
- Consumes: `RaceChartRow`/`RaceChartProps` (Task 7), `ComparePanelProps["variant"]` (Task 8), `Recording.panels["with-sdk-compact"]?` (Task 6), `GET /stream/with-sdk-compact` and `/prompts`'s `withSdkCompact` key (Task 5).
- Produces: no new exports — this is the integration point.

Read the current file first — `apps/demo/src/App.tsx` — before editing. This task replaces the full file; the version below is the complete new content.

- [ ] **Step 1: Replace the full file**

Replace the full contents of `apps/demo/src/App.tsx` with:

```tsx
import { Button, Select } from "@cascivo/react"
import { useCallback, useEffect, useState } from "preact/hooks"
import type { Recording } from "../shared/recording-types.js"
import { ComparePanel } from "./ComparePanel.js"
import { PromptModal } from "./PromptModal.js"
import { RaceChart } from "./RaceChart.js"
import { SaveRecordingModal } from "./SaveRecordingModal.js"
import { buildComparisonBanner } from "./comparison-banner.js"
import { recordings } from "./recordings.js"
import { LiveSource, ReplaySource } from "./sources.js"
import type { PanelRunResult, PanelSource } from "./sources.js"
import { usePanelRun } from "./use-panel-run.js"
import type { PanelRunState } from "./use-panel-run.js"

type Variant = "with-sdk" | "with-sdk-compact" | "without-sdk"
type Mode = "checking" | "live" | "replay-only"

interface Prompts {
	withSdk: string
	withSdkCompact: string
	withoutSdk: string
}

interface ScenarioInfo {
	id: string
	label: string
	prompt: string
}

// Keep ids and labels in sync with apps/demo/server/scenarios.ts.
// Duplicated (rather than fetched) so the header title and the live-mode
// picker both work without depending on network state.
const SCENARIO_OPTIONS: { id: string; label: string }[] = [
	{ id: "loan-approval", label: "Loan Approval" },
	{ id: "quote-to-cash", label: "Quote-to-Cash" },
	{ id: "kyc", label: "KYC" },
]

const DEFAULT_SCENARIO_ID = "loan-approval"

function scenarioLabel(id: string): string {
	return SCENARIO_OPTIONS.find((s) => s.id === id)?.label ?? SCENARIO_OPTIONS[0].label
}

const VARIANT_LABELS: Record<Variant, string> = {
	"with-sdk-compact": "With SDK (Compact)",
	"with-sdk": "With SDK",
	"without-sdk": "Without SDK",
}

const VARIANT_COLORS: Record<Variant, string> = {
	"with-sdk-compact": "--bpmnkit-warn",
	"with-sdk": "--bpmnkit-success",
	"without-sdk": "--bpmnkit-danger",
}

// Chart bars and detailed-view rows always render in this order, top to bottom.
const VARIANT_ORDER: Variant[] = ["with-sdk-compact", "with-sdk", "without-sdk"]

export function App() {
	const [mode, setMode] = useState<Mode>("checking")
	const [prompts, setPrompts] = useState<Prompts | null>(null)
	const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
	const [sources, setSources] = useState<Record<Variant, PanelSource | null>>({
		"with-sdk": null,
		"with-sdk-compact": null,
		"without-sdk": null,
	})
	const [runResults, setRunResults] = useState<Record<Variant, PanelRunResult | null>>({
		"with-sdk": null,
		"with-sdk-compact": null,
		"without-sdk": null,
	})
	const [viewingPrompt, setViewingPrompt] = useState<Variant | null>(null)
	const [savingRecording, setSavingRecording] = useState(false)
	const [selectedScenarioId, setSelectedScenarioId] = useState(DEFAULT_SCENARIO_ID)
	const [scenarios, setScenarios] = useState<ScenarioInfo[] | null>(null)
	const [view, setView] = useState<"chart" | "detailed">("chart")
	const [replaySpeed, setReplaySpeed] = useState(1)

	useEffect(() => {
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), 1500)

		fetch("/health", { signal: controller.signal })
			.then((res) => {
				if (!res.ok) throw new Error("unhealthy")
				return Promise.all([
					fetch("/prompts").then((r) => r.json()),
					fetch("/scenarios").then((r) => r.json()),
				])
			})
			.then(([promptsData, scenariosData]: [Prompts, ScenarioInfo[]]) => {
				setPrompts(promptsData)
				setScenarios(scenariosData)
				setMode("live")
			})
			.catch(() => {
				setMode("replay-only")
			})
			.finally(() => clearTimeout(timeout))

		return () => {
			clearTimeout(timeout)
			controller.abort()
		}
	}, [])

	// Published (replay-only) builds have no picker interaction by default —
	// auto-play the most recently recorded run so a cold visitor sees the demo
	// without hunting for the dropdown first. Runs once, when mode settles.
	useEffect(() => {
		if (mode !== "replay-only" || recordings.length === 0) return
		const mostRecent = recordings.reduce((latest, r) =>
			r.recordedAt > latest.recordedAt ? r : latest,
		)
		replay(mostRecent)
	}, [mode])

	function activeScenarioId(): string {
		if (selectedRecording) return selectedRecording.scenarioId ?? DEFAULT_SCENARIO_ID
		return selectedScenarioId
	}

	function activeScenarioPrompt(): string {
		if (selectedRecording) return selectedRecording.scenarioPrompt
		return scenarios?.find((s) => s.id === selectedScenarioId)?.prompt ?? ""
	}

	function activeSystemPrompt(variant: Variant): string {
		if (selectedRecording) return selectedRecording.panels[variant]?.systemPrompt ?? ""
		if (!prompts) return ""
		if (variant === "with-sdk") return prompts.withSdk
		if (variant === "with-sdk-compact") return prompts.withSdkCompact
		return prompts.withoutSdk
	}

	function runLive() {
		setSelectedRecording(null)
		setRunResults({ "with-sdk": null, "with-sdk-compact": null, "without-sdk": null })
		setSources({
			"with-sdk": new LiveSource(`/stream/with-sdk?scenario=${selectedScenarioId}`),
			"with-sdk-compact": new LiveSource(`/stream/with-sdk-compact?scenario=${selectedScenarioId}`),
			"without-sdk": new LiveSource(`/stream/without-sdk?scenario=${selectedScenarioId}`),
		})
	}

	function replay(recording: Recording) {
		setSelectedRecording(recording)
		setRunResults({ "with-sdk": null, "with-sdk-compact": null, "without-sdk": null })
		const compactPanel = recording.panels["with-sdk-compact"]
		setSources({
			"with-sdk": new ReplaySource(recording.panels["with-sdk"]),
			"with-sdk-compact": compactPanel ? new ReplaySource(compactPanel) : null,
			"without-sdk": new ReplaySource(recording.panels["without-sdk"]),
		})
	}

	const handleFinishWithSdk = useCallback((result: PanelRunResult) => {
		setRunResults((prev) => ({ ...prev, "with-sdk": result }))
	}, [])

	const handleFinishWithSdkCompact = useCallback((result: PanelRunResult) => {
		setRunResults((prev) => ({ ...prev, "with-sdk-compact": result }))
	}, [])

	const handleFinishWithoutSdk = useCallback((result: PanelRunResult) => {
		setRunResults((prev) => ({ ...prev, "without-sdk": result }))
	}, [])

	const withSdkRun = usePanelRun(sources["with-sdk"], handleFinishWithSdk)
	const withSdkCompactRun = usePanelRun(sources["with-sdk-compact"], handleFinishWithSdkCompact)
	const withoutSdkRun = usePanelRun(sources["without-sdk"], handleFinishWithoutSdk)

	useEffect(() => {
		sources["with-sdk"]?.setSpeed?.(replaySpeed)
		sources["with-sdk-compact"]?.setSpeed?.(replaySpeed)
		sources["without-sdk"]?.setSpeed?.(replaySpeed)
	}, [replaySpeed, sources])

	const withSdkResult = runResults["with-sdk"]
	const withSdkCompactResult = runResults["with-sdk-compact"]
	const withoutSdkResult = runResults["without-sdk"]

	const comparisonBanner =
		withSdkResult && withoutSdkResult
			? buildComparisonBanner(withSdkResult, withoutSdkResult)
			: null

	const recordingData: Omit<Recording, "name" | "recordedAt"> | null =
		withSdkResult && withSdkCompactResult && withoutSdkResult
			? {
					scenarioId: activeScenarioId(),
					scenarioPrompt: activeScenarioPrompt(),
					panels: {
						"with-sdk": { systemPrompt: activeSystemPrompt("with-sdk"), ...withSdkResult },
						"with-sdk-compact": {
							systemPrompt: activeSystemPrompt("with-sdk-compact"),
							...withSdkCompactResult,
						},
						"without-sdk": {
							systemPrompt: activeSystemPrompt("without-sdk"),
							...withoutSdkResult,
						},
					},
				}
			: null

	const runByVariant: Record<Variant, PanelRunState> = {
		"with-sdk": withSdkRun,
		"with-sdk-compact": withSdkCompactRun,
		"without-sdk": withoutSdkRun,
	}

	return (
		<div class="flex flex-col h-full">
			<header
				class="flex items-center justify-between px-6 py-3 shrink-0"
				style="border-bottom: 1px solid var(--bpmnkit-border, #2a2a42); background: var(--bpmnkit-surface, #161626);"
			>
				<div class="flex items-center gap-3">
					<span class="font-bold text-lg" style="color: var(--bpmnkit-fg, #cdd6f4);">
						bpmnkit
					</span>
					<span class="text-sm" style="color: var(--bpmnkit-fg-muted, #8888a8);">
						/ AI comparison — {scenarioLabel(activeScenarioId())} Process
					</span>
				</div>
				<div class="flex items-center gap-2">
					{mode === "live" && (
						<Select
							options={SCENARIO_OPTIONS.map((s) => ({ value: s.id, label: s.label }))}
							value={selectedScenarioId}
							onChange={(e) => setSelectedScenarioId((e.target as HTMLSelectElement).value)}
						/>
					)}
					{mode === "live" && (
						<Button variant="primary" onClick={runLive}>
							{sources["with-sdk"] ? "Run Again" : "Run Demo"}
						</Button>
					)}
					<Button variant="ghost" onClick={() => setView(view === "chart" ? "detailed" : "chart")}>
						{view === "chart" ? "Detailed View" : "Chart View"}
					</Button>
					{selectedRecording && (
						<Select
							options={[
								{ value: "1", label: "1x" },
								{ value: "2", label: "2x" },
								{ value: "5", label: "5x" },
								{ value: "10", label: "10x" },
							]}
							value={String(replaySpeed)}
							onChange={(e) => setReplaySpeed(Number((e.target as HTMLSelectElement).value))}
						/>
					)}
					{recordings.length > 0 && (
						<Select
							placeholder="Load a recording…"
							options={recordings.map((r) => ({ value: r.name, label: r.name }))}
							value={selectedRecording?.name ?? ""}
							onChange={(e) => {
								const target = e.target as HTMLSelectElement
								const rec = recordings.find((r) => r.name === target.value)
								if (rec) replay(rec)
							}}
						/>
					)}
					{mode === "live" && recordingData && (
						<Button variant="secondary" onClick={() => setSavingRecording(true)}>
							Save Recording
						</Button>
					)}
				</div>
			</header>

			{comparisonBanner && (
				<div
					class="px-6 py-2 text-sm text-center"
					style="background: var(--bpmnkit-surface-2, #1e1e2e); color: var(--bpmnkit-fg, #cdd6f4);"
				>
					{comparisonBanner}
				</div>
			)}

			<main class="flex-1 flex flex-col overflow-hidden">
				{view === "chart" ? (
					<RaceChart
						rows={VARIANT_ORDER.map((variant) => ({
							id: variant,
							label: VARIANT_LABELS[variant],
							colorVar: VARIANT_COLORS[variant],
							data: {
								elapsedMs: runByVariant[variant].elapsedMs,
								streaming: runByVariant[variant].streaming,
								text: runByVariant[variant].text,
								usage: runByVariant[variant].usage,
								finished:
									runByVariant[variant].bpmnXml !== null ||
									runByVariant[variant].bpmnError !== null,
							},
						}))}
					/>
				) : (
					<>
						{VARIANT_ORDER.map((variant) => (
							<div key={variant} class="flex-1 overflow-hidden">
								<ComparePanel
									variant={variant}
									text={runByVariant[variant].text}
									bpmnXml={runByVariant[variant].bpmnXml}
									bpmnError={runByVariant[variant].bpmnError}
									streaming={runByVariant[variant].streaming}
									elapsedMs={runByVariant[variant].elapsedMs}
									usage={runByVariant[variant].usage}
									onViewPrompt={() => setViewingPrompt(variant)}
									promptAvailable={activeSystemPrompt(variant) !== ""}
								/>
							</div>
						))}
					</>
				)}
			</main>

			{viewingPrompt && (
				<PromptModal
					open
					onClose={() => setViewingPrompt(null)}
					title={`${VARIANT_LABELS[viewingPrompt]} — Prompt`}
					scenarioPrompt={activeScenarioPrompt()}
					systemPrompt={activeSystemPrompt(viewingPrompt)}
				/>
			)}

			{savingRecording && recordingData && (
				<SaveRecordingModal
					open
					onClose={() => setSavingRecording(false)}
					defaultName={`${activeScenarioId()}-${new Date().toISOString().slice(0, 10)}`}
					recordingData={recordingData}
				/>
			)}
		</div>
	)
}
```

- [ ] **Step 2: Typecheck**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.json`
Expected: zero errors — this resolves the `App.tsx` errors that were expected/known since Task 7.

- [ ] **Step 3: Lint**

Run (from repo root): `pnpm biome check apps/demo/src/App.tsx`
Expected: clean.

- [ ] **Step 4: Run the full test suite**

Run (from `apps/demo/`): `npx vitest run`
Expected: PASS, all files.

- [ ] **Step 5: Manual dev-server check**

From `apps/demo/`, run `pnpm dev` in the background, wait ~2s, then:
```bash
curl -s http://localhost:3000/ | grep -o "AI comparison"
```
Expected: page still serves without a build error. Stop the dev server afterward (`pkill -f "vite --port 3000"` and `pkill -f "tsx watch server/index.ts"`).

Note: full interactive verification (the compact bar rendering above "With SDK", the third detailed-view row, replaying an old 2-panel recording without a crash) requires a browser and is not possible in this environment — flag this as a manual follow-up.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/src/App.tsx
git commit --no-gpg-sign -m "feat(demo): wire the with-sdk-compact variant into App"
```

---

### Task 10: Full verification and live smoke test

**Files:** none created or modified — this task only runs checks.

**Interfaces:** none.

- [ ] **Step 1: Full suite, typecheck, biome**

From `apps/demo/`:
```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.server.json
```
From the repo root:
```bash
pnpm biome check apps/demo
```
Expected: all pass with zero errors/warnings.

- [ ] **Step 2: Live smoke test — with-sdk-compact end-to-end against the real `claude` CLI**

Start the server: `npx tsx server/index.ts &` (from `apps/demo/`; use an alternate port if 3001 is occupied in your environment, temporarily editing `PORT` in `server/index.ts` and reverting after — this environment has had a persistent unowned listener on 3001 in prior sessions), wait ~2s.

```bash
curl -sN --max-time 120 "http://localhost:3001/stream/with-sdk-compact?scenario=loan-approval" | grep -A2 '^event: \(bpmn\|error\)'
```
Expected: a `bpmn` event with non-empty `xml` and a populated `usage` object. If instead an `error` event appears, capture the exact message — this is informative (Claude may occasionally violate the DSL grammar) but should be reported, not silently treated as a bug in this task's own code.

Stop the server: `pkill -f "tsx server/index.ts"`.

- [ ] **Step 3: Update the SDD progress ledger**

Append a note to `.superpowers/sdd/progress.md` recording: this plan's completion, the size-reduction numbers from the design spec (47% vs. the builder TS, measured on the loan-approval example), and the exact outcome of Step 2's live smoke test (success or the captured error message).

- [ ] **Step 4: Report deferred items to the user**

State explicitly (no commit needed for this step): full interactive browser verification of the new bar/row placement and the replay-compatibility of pre-existing (2-panel) recordings was not performed — no browser available in this environment. The user should exercise this once locally, and run a handful of live "With SDK (Compact)" generations across all three scenarios to gauge how reliably Claude follows the DSL grammar before relying on it for a live demo.
