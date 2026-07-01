# Demo Scenario Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new scenario prompts (Quote-to-Cash, KYC) alongside the existing Loan Approval one, and let the user pick which scenario a live "Run Demo" targets.

**Architecture:** A new `server/scenarios.ts` registry holds the 3 scenario prompts (id/label/prompt). The server exposes them via `GET /scenarios` and reads a `?scenario=<id>` query param on both `/stream/*` routes to pick which prompt to send as the `-p` argument to the `claude` CLI. The frontend adds a scenario picker (live-mode only) that drives the query param, and threads a `scenarioId` through recordings so replayed runs can still show the right scenario label.

**Tech Stack:** Hono (server), Preact + Cascivo (frontend), Vitest (tests), Biome (lint/format), TypeScript strict.

## Global Constraints

- Only the scenario prompt text varies per scenario. `WITHOUT_SDK_SYSTEM_PROMPT` and `buildSdkSystemPrompt` (including its single worked example) stay fixed and scenario-independent — do not add per-scenario SDK examples.
- Scenario ids: `loan-approval` (default), `quote-to-cash`, `kyc`. Labels: "Loan Approval", "Quote-to-Cash", "KYC".
- The scenario picker is live-mode only. The existing "Load a recording…" dropdown is NOT filtered by scenario — it keeps listing all recordings by name, unfiltered.
- An unknown/invalid `?scenario=` value is a 400, not a silent fallback. A *missing* `?scenario=` defaults to `loan-approval`.
- A recording with no `scenarioId` (the 3 existing recording files) is treated as `loan-approval` everywhere it's read.
- ESM only, `.js` extensions in relative imports (existing codebase convention — see any existing import in `apps/demo/server/*.ts`).
- Biome: tabs, double quotes, semicolons `asNeeded`, 100 char line width. Zero warnings/errors.
- TypeScript strict mode, zero errors, both `apps/demo/tsconfig.json` and `apps/demo/tsconfig.server.json`.

---

### Task 1: Scenario registry (`server/scenarios.ts`)

**Files:**
- Create: `apps/demo/server/scenarios.ts`
- Create: `apps/demo/server/scenarios.test.ts`
- Modify: `apps/demo/server/system-prompt.ts` (remove `SCENARIO_PROMPT`, lines 4-11 of the current file)
- Modify: `apps/demo/server/system-prompt.test.ts` (remove the `SCENARIO_PROMPT` import and describe block, lines 4-8 and 41-45 of the current file)

**Interfaces:**
- Produces: `Scenario { id: string; label: string; prompt: string }`, `DEFAULT_SCENARIO_ID: string` (value `"loan-approval"`), `SCENARIOS: Scenario[]` (exactly 3 entries, in order: `loan-approval`, `quote-to-cash`, `kyc`), `getScenario(id: string): Scenario | undefined`.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing test**

Create `apps/demo/server/scenarios.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { DEFAULT_SCENARIO_ID, SCENARIOS, getScenario } from "./scenarios.js"

describe("SCENARIOS", () => {
	it("has exactly loan-approval, quote-to-cash, and kyc in that order", () => {
		expect(SCENARIOS.map((s) => s.id)).toEqual(["loan-approval", "quote-to-cash", "kyc"])
	})

	it("each scenario prompt mentions its own domain", () => {
		const loanApproval = SCENARIOS.find((s) => s.id === "loan-approval")
		const quoteToCash = SCENARIOS.find((s) => s.id === "quote-to-cash")
		const kyc = SCENARIOS.find((s) => s.id === "kyc")
		expect(loanApproval?.prompt.toLowerCase()).toContain("loan")
		expect(quoteToCash?.prompt.toLowerCase()).toContain("quote")
		expect(kyc?.prompt.toLowerCase()).toContain("kyc")
	})

	it("each scenario has the output-only footer instruction", () => {
		for (const s of SCENARIOS) {
			expect(s.prompt).toContain("Output code only")
		}
	})
})

describe("DEFAULT_SCENARIO_ID", () => {
	it("is loan-approval", () => {
		expect(DEFAULT_SCENARIO_ID).toBe("loan-approval")
	})
})

describe("getScenario", () => {
	it("returns the matching scenario by id", () => {
		expect(getScenario("kyc")?.label).toBe("KYC")
	})

	it("returns undefined for an unknown id", () => {
		expect(getScenario("not-a-real-scenario")).toBeUndefined()
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/demo/`): `npx vitest run server/scenarios.test.ts`
Expected: FAIL — `Failed to resolve import "./scenarios.js"` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `apps/demo/server/scenarios.ts`:

```typescript
export interface Scenario {
	id: string
	label: string
	prompt: string
}

export const DEFAULT_SCENARIO_ID = "loan-approval"

const LOAN_APPROVAL_PROMPT = `Generate a Loan Approval BPMN process for Camunda 8. It should include:
- Credit score check via REST connector
- Exclusive gateway for pre-screening (reject below 580)
- DMN business rule task for risk scoring
- User task for manual underwriter review
- Separate end events for approved and rejected outcomes

Output code only. No explanation. No markdown prose outside the code block.`

const QUOTE_TO_CASH_PROMPT = `Generate a Quote-to-Cash BPMN process for Camunda 8. It should include:
- Quote/offer generation from a product catalog with tiered pricing
- Exclusive gateway for discount approval: manager approval above one threshold,
  escalating to VP approval above a higher threshold
- Contract generation and e-signature via a REST connector to an external
  e-signature service
- Exclusive gateway routing standard orders directly to provisioning, or complex
  bundled orders through a dedicated multi-line provisioning subprocess
- Multi-instance subprocess provisioning each ordered line item in parallel
- Invoice generation triggered once provisioning completes
- Payment processing via a REST connector to a payment gateway
- Event-based gateway for payment outcome: paid immediately, or move to a
  dunning subprocess
- Dunning/cash-collection subprocess with escalating reminder cycles (timer
  boundary events on each reminder) before escalating to a collections agency
- Separate end events for: contract rejected, payment received, and written
  off after collections failure

Output code only. No explanation. No markdown prose outside the code block.`

const KYC_PROMPT = `Generate a KYC (Know Your Customer) onboarding BPMN process for Camunda 8. It
should include:
- Identity document upload and verification via a REST connector to an OCR
  service
- Exclusive gateway on document quality: reject and loop back to re-upload
  (up to 2 retries) if verification fails
- Sanctions and PEP (politically exposed person) screening via a REST
  connector
- Risk-based gateway routing to standard due diligence or enhanced due
  diligence based on the screening result
- User task for enhanced due diligence manual review by a compliance officer
- DMN business rule task for final risk classification
- Separate end events for approved, rejected, and escalated-to-compliance
  outcomes

Output code only. No explanation. No markdown prose outside the code block.`

export const SCENARIOS: Scenario[] = [
	{ id: "loan-approval", label: "Loan Approval", prompt: LOAN_APPROVAL_PROMPT },
	{ id: "quote-to-cash", label: "Quote-to-Cash", prompt: QUOTE_TO_CASH_PROMPT },
	{ id: "kyc", label: "KYC", prompt: KYC_PROMPT },
]

export function getScenario(id: string): Scenario | undefined {
	return SCENARIOS.find((s) => s.id === id)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/scenarios.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Remove `SCENARIO_PROMPT` from `system-prompt.ts` and its test**

Replace the full contents of `apps/demo/server/system-prompt.ts` with:

```typescript
import { readFileSync } from "node:fs"
import { join } from "node:path"

export const WITHOUT_SDK_SYSTEM_PROMPT = `You are a BPMN expert. Output only valid BPMN 2.0 XML for Camunda 8.
No explanation, no markdown, no code fences. Raw XML only, starting with <?xml.`

export function buildSdkSystemPrompt(repoRoot: string): string {
	const readme = readFileSync(join(repoRoot, "packages/core/README.md"), "utf-8")
	const example = readFileSync(join(repoRoot, "apps/examples/src/03-loan-approval.ts"), "utf-8")

	// Grab the top-level index exports as a type reference
	const indexTs = readFileSync(join(repoRoot, "packages/core/src/index.ts"), "utf-8")

	return `You are an expert at using the @bpmnkit/core TypeScript SDK to generate Camunda 8 BPMN processes.

## SDK Overview
${readme}

## Exported API (from packages/core/src/index.ts)
\`\`\`typescript
${indexTs}
\`\`\`

## Real-World Example — Loan Approval
Study this example carefully. Use the same fluent builder pattern.
\`\`\`typescript
${example}
\`\`\`

## Output Instructions
- Generate TypeScript using @bpmnkit/core.
- At the end of your code, use: process.stdout.write(Bpmn.export(definitions))
- Do NOT use writeFileSync.
- Output code only — no explanation, no markdown prose outside the code block.
- Wrap your code in a single \`\`\`typescript code block.`
}
```

Replace the full contents of `apps/demo/server/system-prompt.test.ts` with:

```typescript
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { WITHOUT_SDK_SYSTEM_PROMPT, buildSdkSystemPrompt } from "./system-prompt.js"

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../../../")

describe("buildSdkSystemPrompt", () => {
	it("returns a non-empty string", () => {
		const prompt = buildSdkSystemPrompt(REPO_ROOT)
		expect(typeof prompt).toBe("string")
		expect(prompt.length).toBeGreaterThan(500)
	})

	it("includes the SDK package name", () => {
		const prompt = buildSdkSystemPrompt(REPO_ROOT)
		expect(prompt).toContain("@bpmnkit/core")
	})

	it("includes the example loan approval code", () => {
		const prompt = buildSdkSystemPrompt(REPO_ROOT)
		expect(prompt).toContain("LoanApproval")
	})

	it("includes the output instruction", () => {
		const prompt = buildSdkSystemPrompt(REPO_ROOT)
		expect(prompt).toContain("process.stdout.write")
	})
})

describe("WITHOUT_SDK_SYSTEM_PROMPT", () => {
	it("instructs raw XML output", () => {
		expect(WITHOUT_SDK_SYSTEM_PROMPT).toContain("XML")
	})
})
```

- [ ] **Step 6: Run the full server test suite to verify nothing broke**

Run (from `apps/demo/`): `npx vitest run server/`
Expected: PASS, all files including `scenarios.test.ts` and `system-prompt.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add apps/demo/server/scenarios.ts apps/demo/server/scenarios.test.ts apps/demo/server/system-prompt.ts apps/demo/server/system-prompt.test.ts
git commit -m "feat(demo): add scenario registry with loan-approval, quote-to-cash, kyc"
```

---

### Task 2: Wire scenario selection into the server routes

**Files:**
- Modify: `apps/demo/server/index.ts`

**Interfaces:**
- Consumes (from Task 1): `SCENARIOS: Scenario[]`, `DEFAULT_SCENARIO_ID: string`, `getScenario(id: string): Scenario | undefined` from `./scenarios.js`.
- Produces: `streamLlm(scenarioPrompt: string, systemPrompt: string, onChunk: (text: string) => Promise<void>): Promise<{ text: string; usage: TokenUsage | null }>` (signature change — `scenarioPrompt` is now a parameter instead of the module-level `SCENARIO_PROMPT` constant). `GET /scenarios` route. `GET /prompts` now returns `{ withSdk, withoutSdk }` (no `scenario` field).

There is no automated test harness for `index.ts` (it starts a real server via `serve(...)` as an import-time side effect — this is pre-existing and out of scope to fix here). Verify this task by running the server and curling it directly.

- [ ] **Step 1: Update imports**

In `apps/demo/server/index.ts`, replace:

```typescript
import { extractDeltaText, extractResultUsage } from "./stream-parsers.js"
import {
	SCENARIO_PROMPT,
	WITHOUT_SDK_SYSTEM_PROMPT,
	buildSdkSystemPrompt,
} from "./system-prompt.js"
```

with:

```typescript
import { DEFAULT_SCENARIO_ID, SCENARIOS, getScenario } from "./scenarios.js"
import { extractDeltaText, extractResultUsage } from "./stream-parsers.js"
import { WITHOUT_SDK_SYSTEM_PROMPT, buildSdkSystemPrompt } from "./system-prompt.js"
```

- [ ] **Step 2: Add the `GET /scenarios` route and update `GET /prompts`**

Replace:

```typescript
app.get("/prompts", (c) =>
	c.json({
		scenario: SCENARIO_PROMPT,
		withSdk: SDK_SYSTEM_PROMPT,
		withoutSdk: WITHOUT_SDK_SYSTEM_PROMPT,
	}),
)
```

with:

```typescript
app.get("/scenarios", (c) => c.json(SCENARIOS))

app.get("/prompts", (c) =>
	c.json({
		withSdk: SDK_SYSTEM_PROMPT,
		withoutSdk: WITHOUT_SDK_SYSTEM_PROMPT,
	}),
)
```

- [ ] **Step 3: Give `streamLlm` a `scenarioPrompt` parameter**

Replace the `streamLlm` function signature and its `spawn` call:

```typescript
async function streamLlm(
	systemPrompt: string,
	onChunk: (text: string) => Promise<void>,
): Promise<{ text: string; usage: TokenUsage | null }> {
	const child = spawn(
		"claude",
		[
			"-p",
			SCENARIO_PROMPT,
```

with:

```typescript
async function streamLlm(
	scenarioPrompt: string,
	systemPrompt: string,
	onChunk: (text: string) => Promise<void>,
): Promise<{ text: string; usage: TokenUsage | null }> {
	const child = spawn(
		"claude",
		[
			"-p",
			scenarioPrompt,
```

(the rest of the function body is unchanged).

- [ ] **Step 4: Read and validate `?scenario=` in both stream routes**

Replace the `/stream/with-sdk` route:

```typescript
app.get("/stream/with-sdk", (c) =>
	streamSSE(c, async (stream) => {
		let usage: TokenUsage | null = null
		try {
			const result = await streamLlm(SDK_SYSTEM_PROMPT, async (text) => {
				await stream.writeSSE({ event: "chunk", data: JSON.stringify({ text }) })
			})
```

with:

```typescript
app.get("/stream/with-sdk", (c) => {
	const scenarioId = c.req.query("scenario") ?? DEFAULT_SCENARIO_ID
	const scenario = getScenario(scenarioId)
	if (!scenario) {
		return c.json({ error: `Unknown scenario "${scenarioId}"` }, 400)
	}
	return streamSSE(c, async (stream) => {
		let usage: TokenUsage | null = null
		try {
			const result = await streamLlm(scenario.prompt, SDK_SYSTEM_PROMPT, async (text) => {
				await stream.writeSSE({ event: "chunk", data: JSON.stringify({ text }) })
			})
```

...and close the outer function with an extra `}` — the full route becomes:

```typescript
app.get("/stream/with-sdk", (c) => {
	const scenarioId = c.req.query("scenario") ?? DEFAULT_SCENARIO_ID
	const scenario = getScenario(scenarioId)
	if (!scenario) {
		return c.json({ error: `Unknown scenario "${scenarioId}"` }, 400)
	}
	return streamSSE(c, async (stream) => {
		let usage: TokenUsage | null = null
		try {
			const result = await streamLlm(scenario.prompt, SDK_SYSTEM_PROMPT, async (text) => {
				await stream.writeSSE({ event: "chunk", data: JSON.stringify({ text }) })
			})
			usage = result.usage
			await stream.writeSSE({ event: "done", data: "{}" })

			const tsCode = extractTsBlock(result.text)
			if (!tsCode) {
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({
						message: "No TypeScript code block found in LLM output",
						usage,
					}),
				})
				return
			}

			const xml = await executeSdkCode(tsCode, REPO_ROOT)
			await stream.writeSSE({ event: "bpmn", data: JSON.stringify({ xml, usage }) })
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			await stream.writeSSE({ event: "error", data: JSON.stringify({ message, usage }) })
		}
	})
})
```

Apply the same shape to `/stream/without-sdk` — full replacement:

```typescript
app.get("/stream/without-sdk", (c) => {
	const scenarioId = c.req.query("scenario") ?? DEFAULT_SCENARIO_ID
	const scenario = getScenario(scenarioId)
	if (!scenario) {
		return c.json({ error: `Unknown scenario "${scenarioId}"` }, 400)
	}
	return streamSSE(c, async (stream) => {
		let usage: TokenUsage | null = null
		try {
			const result = await streamLlm(scenario.prompt, WITHOUT_SDK_SYSTEM_PROMPT, async (text) => {
				await stream.writeSSE({ event: "chunk", data: JSON.stringify({ text }) })
			})
			usage = result.usage
			await stream.writeSSE({ event: "done", data: "{}" })

			const xml = extractXmlBlock(result.text)
			if (!xml) {
				await stream.writeSSE({
					event: "error",
					data: JSON.stringify({ message: "No BPMN XML found in LLM output", usage }),
				})
				return
			}
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

Start the server in the background: `npx tsx server/index.ts &` (from `apps/demo/`), wait ~2s, then:

```bash
curl -s http://localhost:3001/scenarios
```
Expected: a JSON array of 3 objects with `id` values `loan-approval`, `quote-to-cash`, `kyc`.

```bash
curl -s http://localhost:3001/prompts
```
Expected: `{"withSdk": "...", "withoutSdk": "..."}` — no `scenario` key.

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/stream/with-sdk?scenario=not-a-real-scenario"
```
Expected: `400`

Stop the server: `pkill -f "tsx server/index.ts"`, then confirm with `curl -s -m 2 http://localhost:3001/health` (expect connection refused).

- [ ] **Step 7: Biome check**

Run (from repo root): `pnpm biome check apps/demo/server/index.ts`
Expected: no errors. If formatting differs, run `pnpm biome check --write apps/demo/server/index.ts` and re-check.

- [ ] **Step 8: Commit**

```bash
git add apps/demo/server/index.ts
git commit -m "feat(demo): read ?scenario= query param on stream routes, add GET /scenarios"
```

---

### Task 3: Frontend scenario picker

**Files:**
- Modify: `apps/demo/shared/recording-types.ts`
- Modify: `apps/demo/src/App.tsx`

**Interfaces:**
- Consumes: `GET /scenarios` (Task 2) returning `{ id: string; label: string; prompt: string }[]`; `GET /prompts` (Task 2) now returning `{ withSdk: string; withoutSdk: string }`.
- Produces: `Recording.scenarioId?: string` (optional field, consumed nowhere outside this task and Task 4's manual verification).

There is no existing automated test file for `App.tsx` (it's UI wiring, verified today via manual/browser checks per the project's established pattern for this file). Verify this task with `tsc`, `biome`, and a manual dev-server curl check of the new picker's effect on the request URL.

- [ ] **Step 1: Add `scenarioId` to the `Recording` type**

In `apps/demo/shared/recording-types.ts`, change:

```typescript
export interface Recording {
	name: string
	recordedAt: string
	scenarioPrompt: string
	panels: {
		"with-sdk": RecordedPanel
		"without-sdk": RecordedPanel
	}
}
```

to:

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

- [ ] **Step 2: Update `App.tsx`**

In `apps/demo/src/App.tsx`, make the following changes in order.

Replace the top-of-file type declarations:

```typescript
interface Prompts {
	scenario: string
	withSdk: string
	withoutSdk: string
}
```

with:

```typescript
interface Prompts {
	withSdk: string
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
```

Add state (after the existing `const [savingRecording, setSavingRecording] = useState(false)` line):

```typescript
	const [selectedScenarioId, setSelectedScenarioId] = useState(DEFAULT_SCENARIO_ID)
	const [scenarios, setScenarios] = useState<ScenarioInfo[] | null>(null)
```

Replace the health/prompts fetch effect:

```typescript
	useEffect(() => {
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), 1500)

		fetch("/health", { signal: controller.signal })
			.then((res) => {
				if (!res.ok) throw new Error("unhealthy")
				return fetch("/prompts").then((r) => r.json())
			})
			.then((data: Prompts) => {
				setPrompts(data)
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
```

with:

```typescript
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
```

Replace `activeScenarioPrompt` and add `activeScenarioId` right above it:

```typescript
	function activeScenarioPrompt(): string {
		if (selectedRecording) return selectedRecording.scenarioPrompt
		return prompts?.scenario ?? ""
	}
```

with:

```typescript
	function activeScenarioId(): string {
		if (selectedRecording) return selectedRecording.scenarioId ?? DEFAULT_SCENARIO_ID
		return selectedScenarioId
	}

	function activeScenarioPrompt(): string {
		if (selectedRecording) return selectedRecording.scenarioPrompt
		return scenarios?.find((s) => s.id === selectedScenarioId)?.prompt ?? ""
	}
```

Replace `runLive`:

```typescript
	function runLive() {
		setSelectedRecording(null)
		setRunResults({ "with-sdk": null, "without-sdk": null })
		setSources({
			"with-sdk": new LiveSource("/stream/with-sdk"),
			"without-sdk": new LiveSource("/stream/without-sdk"),
		})
	}
```

with:

```typescript
	function runLive() {
		setSelectedRecording(null)
		setRunResults({ "with-sdk": null, "without-sdk": null })
		setSources({
			"with-sdk": new LiveSource(`/stream/with-sdk?scenario=${selectedScenarioId}`),
			"without-sdk": new LiveSource(`/stream/without-sdk?scenario=${selectedScenarioId}`),
		})
	}
```

Replace the `recordingData` construction:

```typescript
	const recordingData: Omit<Recording, "name" | "recordedAt"> | null =
		withSdkResult && withoutSdkResult
			? {
					scenarioPrompt: activeScenarioPrompt(),
					panels: {
						"with-sdk": { systemPrompt: activeSystemPrompt("with-sdk"), ...withSdkResult },
						"without-sdk": {
							systemPrompt: activeSystemPrompt("without-sdk"),
							...withoutSdkResult,
						},
					},
				}
			: null
```

with:

```typescript
	const recordingData: Omit<Recording, "name" | "recordedAt"> | null =
		withSdkResult && withoutSdkResult
			? {
					scenarioId: activeScenarioId(),
					scenarioPrompt: activeScenarioPrompt(),
					panels: {
						"with-sdk": { systemPrompt: activeSystemPrompt("with-sdk"), ...withSdkResult },
						"without-sdk": {
							systemPrompt: activeSystemPrompt("without-sdk"),
							...withoutSdkResult,
						},
					},
				}
			: null
```

Replace the header title span:

```typescript
					<span class="text-sm" style="color: var(--bpmnkit-fg-muted, #8888a8);">
						/ AI comparison — Loan Approval Process
					</span>
```

with:

```typescript
					<span class="text-sm" style="color: var(--bpmnkit-fg-muted, #8888a8);">
						/ AI comparison — {scenarioLabel(activeScenarioId())} Process
					</span>
```

Add the scenario picker right before the "Run Demo" button — replace:

```typescript
				<div class="flex items-center gap-2">
					{mode === "live" && (
						<Button variant="primary" onClick={runLive}>
							{sources["with-sdk"] ? "Run Again" : "Run Demo"}
						</Button>
					)}
```

with:

```typescript
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
```

Replace the `SaveRecordingModal`'s `defaultName`:

```typescript
					defaultName={`loan-approval-${new Date().toISOString().slice(0, 10)}`}
```

with:

```typescript
					defaultName={`${activeScenarioId()}-${new Date().toISOString().slice(0, 10)}`}
```

- [ ] **Step 3: Typecheck**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Biome check**

Run (from repo root): `pnpm biome check apps/demo/src/App.tsx apps/demo/shared/recording-types.ts`
Expected: no errors. If formatting differs, run `pnpm biome check --write` on the same paths and re-check.

- [ ] **Step 5: Run the full test suite**

Run (from `apps/demo/`): `npx vitest run`
Expected: PASS, all existing tests (nothing in this task should break `sources.test.ts`, `comparison-banner.test.ts`, etc. — none of them import `App.tsx`).

- [ ] **Step 6: Manual dev-server verification**

From `apps/demo/`, run `pnpm dev` in the background, wait ~2s, then confirm the built page loads and the new picker is present in the served HTML/JS:

```bash
curl -s http://localhost:3000/ | grep -o "AI comparison" 
```
Expected: `AI comparison` (page served).

Stop the dev server: find and kill the `concurrently`/`vite`/`tsx watch` processes started for this check (e.g. `pkill -f "vite --port 3000"` and `pkill -f "tsx watch server/index.ts"`).

Note: a full interactive check (clicking the picker, confirming the request URL changes, confirming the header title updates) requires a browser and is not possible in this environment — flag this to the user as a manual follow-up, consistent with prior rounds in this project.

- [ ] **Step 7: Commit**

```bash
git add apps/demo/shared/recording-types.ts apps/demo/src/App.tsx
git commit -m "feat(demo): add live-mode scenario picker, thread scenarioId through recordings"
```

---

### Task 4: End-to-end verification and cleanup

**Files:** none created or modified — this task only runs checks.

**Interfaces:** none.

- [ ] **Step 1: Full suite, typecheck, biome across the demo app**

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

- [ ] **Step 2: Live smoke test — quote-to-cash end-to-end**

Start the server: `npx tsx server/index.ts &` (from `apps/demo/`), wait ~2s.

```bash
curl -sN --max-time 120 "http://localhost:3001/stream/with-sdk?scenario=quote-to-cash" | grep -A2 '^event: \(bpmn\|error\)'
```
Expected: a `bpmn` event (not `error`) with a non-empty `xml` field and a `usage` object with `inputTokens`/`outputTokens` both > 0.

```bash
curl -sN --max-time 120 "http://localhost:3001/stream/without-sdk?scenario=quote-to-cash" | grep -A2 '^event: \(bpmn\|error\)'
```
Expected: same shape (`bpmn` or `error` — an `error` here is acceptable and informative, since without-sdk generating this much XML from memory is exactly the stress case the scenario is designed to probe; do not treat an `error` result as a bug in this task).

- [ ] **Step 3: Live smoke test — kyc end-to-end**

```bash
curl -sN --max-time 120 "http://localhost:3001/stream/with-sdk?scenario=kyc" | grep -A2 '^event: \(bpmn\|error\)'
```
Expected: a `bpmn` event with non-empty `xml` and a populated `usage`.

Stop the server: `pkill -f "tsx server/index.ts"`.

- [ ] **Step 4: Update the SDD progress ledger**

Append a note to `.superpowers/sdd/progress.md` (create the file with a short header if the previous ledger was for a different plan) recording that this plan is complete, the scenario ids added, and the outcome of the quote-to-cash / kyc smoke tests from Steps 2-3 (including whether without-sdk produced valid output or an error for quote-to-cash — this is expected data, not a defect, but should be recorded for the user).

- [ ] **Step 5: Report deferred items to the user**

State explicitly (no commit needed for this step): full interactive browser verification of the scenario picker was not performed (no browser available in this environment) — the user should click through it once locally before relying on it for a live demo.
