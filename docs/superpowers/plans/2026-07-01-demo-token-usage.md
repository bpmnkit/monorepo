# Demo Token Usage Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `apps/demo`'s existing timer/duration-banner feature to also show input/output token usage per run, so the "with SDK" vs "without SDK" comparison covers cost/efficiency, not just speed.

**Architecture:** The `claude` CLI's final NDJSON `result` line carries `usage.input_tokens`/`usage.output_tokens` for the whole exchange. The server captures it and includes it in the terminal `bpmn`/`error` SSE event payload. The frontend's `PanelSource` abstraction, `ComparePanel`, and the comparison banner all thread this value through the same way they already thread `durationMs`.

**Tech Stack:** Same as the existing demo — Hono server, Preact frontend, Vitest.

## Global Constraints

- TypeScript strict mode — zero type errors.
- Biome — zero warnings, zero errors, tabs not spaces.
- Only `input_tokens`/`output_tokens` are surfaced — no cache-related fields, no cost/dollar estimation.
- `usage` on `RecordedPanel` is **optional** (`usage?: TokenUsage | null`) — the existing `apps/demo/recordings/loan-approval-2026-07-01.json` predates this feature and must keep working with no token data (treated identically to `usage: null`).
- The comparison banner's token clause only appears when **both** sides have usage data — if either is missing, the banner falls back to exactly the pre-existing duration-only line (no partial/broken-looking output).
- No dedicated unit test for `extractResultUsage` in isolation — mirrors the existing precedent for `extractDeltaText`, both exercised end-to-end by the live smoke test in the final task.

---

## File Map

**Created:**
- `apps/demo/src/format-tokens.ts`
- `apps/demo/src/format-tokens.test.ts`
- `apps/demo/src/comparison-banner.ts`
- `apps/demo/src/comparison-banner.test.ts`

**Modified:**
- `apps/demo/shared/recording-types.ts`
- `apps/demo/server/index.ts`
- `apps/demo/src/sources.ts`
- `apps/demo/src/sources.test.ts`
- `apps/demo/src/ComparePanel.tsx`
- `apps/demo/src/App.tsx`

**Deleted:**
- `apps/demo/src/duration-banner.ts` (replaced by `comparison-banner.ts`)
- `apps/demo/src/duration-banner.test.ts` (replaced by `comparison-banner.test.ts`)

---

### Task 1: Shared Type Extension + Token Formatting Helper

**Files:**
- Modify: `apps/demo/shared/recording-types.ts`
- Create: `apps/demo/src/format-tokens.ts`
- Test: `apps/demo/src/format-tokens.test.ts`

**Interfaces:**
- Produces:
  - `interface TokenUsage { inputTokens: number; outputTokens: number }` (exported from `shared/recording-types.ts`)
  - `RecordedPanel` gains `usage?: TokenUsage | null`
  - `formatTokenCount(n: number): string`

- [ ] **Step 1: Extend `apps/demo/shared/recording-types.ts`**

Replace the full file contents with:
```ts
export interface Recording {
	name: string
	recordedAt: string
	scenarioPrompt: string
	panels: {
		"with-sdk": RecordedPanel
		"without-sdk": RecordedPanel
	}
}

export interface TokenUsage {
	inputTokens: number
	outputTokens: number
}

export interface RecordedPanel {
	systemPrompt: string
	chunks: { t: number; text: string }[]
	durationMs: number
	usage?: TokenUsage | null
	result: { type: "bpmn"; xml: string } | { type: "error"; message: string }
}
```

- [ ] **Step 2: Write the failing test for `formatTokenCount`**

Create `apps/demo/src/format-tokens.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { formatTokenCount } from "./format-tokens.js"

describe("formatTokenCount", () => {
	it("renders numbers under 1000 as-is", () => {
		expect(formatTokenCount(0)).toBe("0")
		expect(formatTokenCount(340)).toBe("340")
		expect(formatTokenCount(999)).toBe("999")
	})

	it("renders numbers at or above 1000 as one-decimal thousands", () => {
		expect(formatTokenCount(1000)).toBe("1.0k")
		expect(formatTokenCount(8140)).toBe("8.1k")
		expect(formatTokenCount(15999)).toBe("16.0k")
	})
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm test -- src/format-tokens.test.ts
```
Expected: FAIL — `Cannot find module './format-tokens.js'`

- [ ] **Step 4: Implement `apps/demo/src/format-tokens.ts`**

```ts
export function formatTokenCount(n: number): string {
	if (n < 1000) return String(n)
	return `${(n / 1000).toFixed(1)}k`
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm test -- src/format-tokens.test.ts
```
Expected: all 2 tests pass.

- [ ] **Step 6: Verify typecheck (existing files consuming `RecordedPanel`/`Recording` must still compile)**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec tsc --noEmit
pnpm exec tsc -p tsconfig.server.json --noEmit
```
Expected: both exit 0 — adding an optional field never breaks existing consumers.

- [ ] **Step 7: Commit**

```bash
git add apps/demo/shared/recording-types.ts apps/demo/src/format-tokens.ts apps/demo/src/format-tokens.test.ts
git commit --no-gpg-sign -m "feat(demo): add TokenUsage type and token formatting helper"
```

---

### Task 2: Server — Capture and Emit Token Usage

**Files:**
- Modify: `apps/demo/server/index.ts`

**Interfaces:**
- Consumes: `TokenUsage` from `../shared/recording-types.js` (Task 1)
- Produces:
  - `streamLlm(systemPrompt, onChunk): Promise<{ text: string; usage: TokenUsage | null }>` — return type changes from `Promise<string>`
  - `bpmn` SSE event payload gains `usage: TokenUsage | null`
  - `error` SSE event payload gains `usage: TokenUsage | null`

- [ ] **Step 1: Update the import at the top of `apps/demo/server/index.ts`**

Change:
```ts
import type { Recording } from "../shared/recording-types.js"
```
to:
```ts
import type { Recording, TokenUsage } from "../shared/recording-types.js"
```

- [ ] **Step 2: Add `extractResultUsage` next to the existing `extractDeltaText`**

Add this function immediately after `extractDeltaText`'s closing brace:
```ts
function extractResultUsage(event: unknown): TokenUsage | null {
	if (typeof event !== "object" || event === null) return null
	if (!("type" in event) || event.type !== "result") return null
	if (!("usage" in event) || typeof event.usage !== "object" || event.usage === null) return null
	const usage = event.usage as Record<string, unknown>
	if (typeof usage.input_tokens !== "number" || typeof usage.output_tokens !== "number") return null
	return { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
}
```

- [ ] **Step 3: Change `streamLlm`'s return type and capture usage while reading lines**

Replace the full `streamLlm` function with:
```ts
async function streamLlm(
	systemPrompt: string,
	onChunk: (text: string) => Promise<void>,
): Promise<{ text: string; usage: TokenUsage | null }> {
	const child = spawn(
		"claude",
		[
			"-p",
			SCENARIO_PROMPT,
			"--model",
			"claude-opus-4-8",
			"--system-prompt",
			systemPrompt,
			"--safe-mode",
			"--output-format",
			"stream-json",
			"--include-partial-messages",
			"--verbose",
			"--disallowedTools",
			DISALLOWED_TOOLS,
		],
		{ cwd: REPO_ROOT },
	)

	let stderr = ""
	child.stderr.on("data", (data: Buffer) => {
		stderr += data.toString()
	})

	const spawnError = new Promise<never>((_, reject) => {
		child.on("error", (err) => {
			reject(new Error(`claude CLI not found or failed to start: ${err.message}`))
		})
	})

	let accumulated = ""
	let usage: TokenUsage | null = null
	const readLines = async () => {
		const rl = createInterface({ input: child.stdout })
		for await (const line of rl) {
			if (!line.trim()) continue
			let parsed: unknown
			try {
				parsed = JSON.parse(line)
			} catch {
				continue
			}
			const text = extractDeltaText(parsed)
			if (text !== null) {
				accumulated += text
				await onChunk(text)
			}
			const resultUsage = extractResultUsage(parsed)
			if (resultUsage !== null) {
				usage = resultUsage
			}
		}
	}

	await Promise.race([spawnError, readLines()])

	const exitCode = await new Promise<number | null>((resolve) => {
		child.on("close", (code) => resolve(code))
	})

	if (exitCode !== 0) {
		throw new Error(`claude CLI exited with code ${exitCode}${stderr ? `: ${stderr}` : ""}`)
	}

	return { text: accumulated, usage }
}
```

- [ ] **Step 4: Update `/stream/with-sdk` to thread usage through, including on the catch path**

Replace the full route with:
```ts
app.get("/stream/with-sdk", (c) =>
	streamSSE(c, async (stream) => {
		let usage: TokenUsage | null = null
		try {
			const result = await streamLlm(SDK_SYSTEM_PROMPT, async (text) => {
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
	}),
)
```

Note: `usage` is declared *outside* the `try` block, defaulting to `null`. If `streamLlm` itself throws (spawn failure, non-zero exit), the destructuring assignment `usage = result.usage` never runs, so the catch block correctly sends `usage: null`. If the failure happens *after* `streamLlm` resolves (extraction or `tsx` execution failure), `usage` already holds the real value by the time the catch or the inner `error` branch sends it.

- [ ] **Step 5: Update `/stream/without-sdk` the same way**

Replace the full route with:
```ts
app.get("/stream/without-sdk", (c) =>
	streamSSE(c, async (stream) => {
		let usage: TokenUsage | null = null
		try {
			const result = await streamLlm(WITHOUT_SDK_SYSTEM_PROMPT, async (text) => {
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
	}),
)
```

- [ ] **Step 6: Verify**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec tsc -p tsconfig.server.json --noEmit
pnpm exec biome check server/index.ts
```
Expected: both clean. (Frontend `tsc --noEmit` will show new errors in `sources.ts`/`ComparePanel.tsx` — those are Task 3/4's job; not a regression in this file.)

- [ ] **Step 7: Commit**

```bash
git add apps/demo/server/index.ts
git commit --no-gpg-sign -m "feat(demo): capture and emit token usage from claude CLI result line"
```

---

### Task 3: Frontend Source Abstraction — Usage Passthrough

**Files:**
- Modify: `apps/demo/src/sources.ts`
- Modify: `apps/demo/src/sources.test.ts`

**Interfaces:**
- Consumes: `TokenUsage` from `../shared/recording-types.js` (Task 1)
- Produces:
  - `PanelSourceHandlers.onBpmn: (xml: string, usage: TokenUsage | null) => void` (signature change)
  - `PanelSourceHandlers.onError: (message: string, usage: TokenUsage | null) => void` (signature change)

- [ ] **Step 1: Update the failing assertions in `apps/demo/src/sources.test.ts` first (TDD — these will fail against the current two-arg-less implementation)**

Replace the full file with:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { RecordedPanel } from "../shared/recording-types.js"
import { ReplaySource } from "./sources.js"

describe("ReplaySource", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	const panel: RecordedPanel = {
		systemPrompt: "irrelevant",
		chunks: [
			{ t: 0, text: "Hello" },
			{ t: 100, text: " world" },
		],
		durationMs: 300,
		result: { type: "bpmn", xml: "<xml/>" },
	}

	it("delivers chunks at their recorded relative times, in order", () => {
		const onChunk = vi.fn()
		new ReplaySource(panel).subscribe({
			onChunk,
			onDone: vi.fn(),
			onBpmn: vi.fn(),
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(0)
		expect(onChunk).toHaveBeenNthCalledWith(1, "Hello")

		vi.advanceTimersByTime(100)
		expect(onChunk).toHaveBeenNthCalledWith(2, " world")
		expect(onChunk).toHaveBeenCalledTimes(2)
	})

	it("calls onDone right after the last chunk, before the result", () => {
		const onDone = vi.fn()
		const onBpmn = vi.fn()
		new ReplaySource(panel).subscribe({ onChunk: vi.fn(), onDone, onBpmn, onError: vi.fn() })

		vi.advanceTimersByTime(100)
		expect(onDone).toHaveBeenCalledTimes(1)
		expect(onBpmn).not.toHaveBeenCalled()
	})

	it("delivers a bpmn result at durationMs with null usage when the recording has none", () => {
		const onBpmn = vi.fn()
		new ReplaySource(panel).subscribe({
			onChunk: vi.fn(),
			onDone: vi.fn(),
			onBpmn,
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(300)
		expect(onBpmn).toHaveBeenCalledWith("<xml/>", null)
	})

	it("delivers the recorded usage alongside the bpmn result when present", () => {
		const panelWithUsage: RecordedPanel = {
			...panel,
			usage: { inputTokens: 8100, outputTokens: 340 },
		}
		const onBpmn = vi.fn()
		new ReplaySource(panelWithUsage).subscribe({
			onChunk: vi.fn(),
			onDone: vi.fn(),
			onBpmn,
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(300)
		expect(onBpmn).toHaveBeenCalledWith("<xml/>", { inputTokens: 8100, outputTokens: 340 })
	})

	it("delivers an error result with null usage when the recorded result is an error", () => {
		const errorPanel: RecordedPanel = {
			...panel,
			result: { type: "error", message: "boom" },
		}
		const onError = vi.fn()
		new ReplaySource(errorPanel).subscribe({
			onChunk: vi.fn(),
			onDone: vi.fn(),
			onBpmn: vi.fn(),
			onError,
		})

		vi.advanceTimersByTime(300)
		expect(onError).toHaveBeenCalledWith("boom", null)
	})

	it("cancels all pending timers when unsubscribed", () => {
		const onChunk = vi.fn()
		const unsubscribe = new ReplaySource(panel).subscribe({
			onChunk,
			onDone: vi.fn(),
			onBpmn: vi.fn(),
			onError: vi.fn(),
		})

		unsubscribe()
		vi.advanceTimersByTime(300)
		expect(onChunk).not.toHaveBeenCalled()
	})

	it("handles zero chunks: onDone fires immediately, result fires at durationMs", () => {
		const emptyPanel: RecordedPanel = { ...panel, chunks: [] }
		const onDone = vi.fn()
		const onBpmn = vi.fn()
		new ReplaySource(emptyPanel).subscribe({
			onChunk: vi.fn(),
			onDone,
			onBpmn,
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(0)
		expect(onDone).toHaveBeenCalledTimes(1)
		vi.advanceTimersByTime(300)
		expect(onBpmn).toHaveBeenCalledWith("<xml/>", null)
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm test -- src/sources.test.ts
```
Expected: FAIL — the existing `ReplaySource` calls `handlers.onBpmn(this.panel.result.xml)` with only one argument, so `toHaveBeenCalledWith("<xml/>", null)` and the new usage-present test both fail on argument count/value.

- [ ] **Step 3: Update `apps/demo/src/sources.ts`**

Replace the full file with:
```ts
import type { RecordedPanel, TokenUsage } from "../shared/recording-types.js"

export interface PanelSourceHandlers {
	onChunk: (text: string) => void
	onDone: () => void
	onBpmn: (xml: string, usage: TokenUsage | null) => void
	onError: (message: string, usage: TokenUsage | null) => void
}

export interface PanelSource {
	subscribe(handlers: PanelSourceHandlers): () => void
}

export type PanelRunResult = Omit<RecordedPanel, "systemPrompt">

export class LiveSource implements PanelSource {
	constructor(private readonly url: string) {}

	subscribe(handlers: PanelSourceHandlers): () => void {
		const es = new EventSource(this.url)

		es.addEventListener("chunk", (e) => {
			const { text } = JSON.parse((e as MessageEvent).data) as { text: string }
			handlers.onChunk(text)
		})

		es.addEventListener("done", () => {
			handlers.onDone()
		})

		es.addEventListener("bpmn", (e) => {
			const { xml, usage } = JSON.parse((e as MessageEvent).data) as {
				xml: string
				usage: TokenUsage | null
			}
			handlers.onBpmn(xml, usage)
		})

		es.addEventListener("error", (e) => {
			if (e instanceof MessageEvent && e.data) {
				const { message, usage } = JSON.parse(e.data) as {
					message: string
					usage: TokenUsage | null
				}
				handlers.onError(message, usage)
			}
			es.close()
		})

		return () => es.close()
	}
}

export class ReplaySource implements PanelSource {
	constructor(private readonly panel: RecordedPanel) {}

	subscribe(handlers: PanelSourceHandlers): () => void {
		const timers: ReturnType<typeof setTimeout>[] = []

		for (const chunk of this.panel.chunks) {
			timers.push(setTimeout(() => handlers.onChunk(chunk.text), chunk.t))
		}

		const lastChunkT = this.panel.chunks.at(-1)?.t ?? 0
		timers.push(setTimeout(() => handlers.onDone(), lastChunkT))

		timers.push(
			setTimeout(() => {
				const usage = this.panel.usage ?? null
				if (this.panel.result.type === "bpmn") {
					handlers.onBpmn(this.panel.result.xml, usage)
				} else {
					handlers.onError(this.panel.result.message, usage)
				}
			}, this.panel.durationMs),
		)

		return () => {
			for (const t of timers) clearTimeout(t)
		}
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm test -- src/sources.test.ts
```
Expected: all 7 tests pass.

- [ ] **Step 5: Verify and commit**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec biome check src/sources.ts src/sources.test.ts
git add apps/demo/src/sources.ts apps/demo/src/sources.test.ts
git commit --no-gpg-sign -m "feat(demo): thread token usage through PanelSource abstraction"
```

---

### Task 4: ComparePanel — Display Token Usage

**Files:**
- Modify: `apps/demo/src/ComparePanel.tsx`

**Interfaces:**
- Consumes:
  - `formatTokenCount(n: number): string` from `./format-tokens.js` (Task 1)
  - `PanelSourceHandlers.onBpmn`/`onError`'s new `usage` parameter from `./sources.js` (Task 3)
  - `TokenUsage` from `../shared/recording-types.js` (Task 1)
- Produces: `ComparePanel`'s `onFinish` callback now receives a `PanelRunResult` whose `usage` field is populated (was always `undefined` before this task)

- [ ] **Step 1: Replace the full contents of `apps/demo/src/ComparePanel.tsx`**

```tsx
import { Badge, Button } from "@cascivo/react"
import { useEffect, useRef, useState } from "preact/hooks"
import type { TokenUsage } from "../shared/recording-types.js"
import { BpmnViewer } from "./BpmnViewer.js"
import { formatTokenCount } from "./format-tokens.js"
import type { PanelRunResult, PanelSource } from "./sources.js"

interface ComparePanelProps {
	variant: "with-sdk" | "without-sdk"
	source: PanelSource | null
	onFinish?: (result: PanelRunResult) => void
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

export function ComparePanel({
	variant,
	source,
	onFinish,
	onViewPrompt,
	promptAvailable,
}: ComparePanelProps) {
	const [text, setText] = useState("")
	const [bpmnXml, setBpmnXml] = useState<string | null>(null)
	const [bpmnError, setBpmnError] = useState<string | null>(null)
	const [streaming, setStreaming] = useState(false)
	const [elapsedMs, setElapsedMs] = useState(0)
	const [usage, setUsage] = useState<TokenUsage | null>(null)
	const codeRef = useRef<HTMLPreElement>(null)
	const chunksRef = useRef<{ t: number; text: string }[]>([])
	const startedAtRef = useRef(0)

	useEffect(() => {
		setText("")
		setBpmnXml(null)
		setBpmnError(null)
		setElapsedMs(0)
		setUsage(null)
		chunksRef.current = []

		if (!source) {
			setStreaming(false)
			return
		}

		startedAtRef.current = Date.now()
		setStreaming(true)

		const tick = setInterval(() => {
			setElapsedMs(Date.now() - startedAtRef.current)
		}, 100)

		const unsubscribe = source.subscribe({
			onChunk: (chunk) => {
				chunksRef.current.push({ t: Date.now() - startedAtRef.current, text: chunk })
				setText((prev) => prev + chunk)
				if (codeRef.current) {
					codeRef.current.scrollTop = codeRef.current.scrollHeight
				}
			},
			onDone: () => {
				setStreaming(false)
			},
			onBpmn: (xml, runUsage) => {
				const durationMs = Date.now() - startedAtRef.current
				setBpmnXml(xml)
				setUsage(runUsage)
				clearInterval(tick)
				setElapsedMs(durationMs)
				onFinish?.({
					chunks: chunksRef.current,
					durationMs,
					usage: runUsage,
					result: { type: "bpmn", xml },
				})
			},
			onError: (message, runUsage) => {
				const durationMs = Date.now() - startedAtRef.current
				setBpmnError(message)
				setUsage(runUsage)
				setStreaming(false)
				clearInterval(tick)
				setElapsedMs(durationMs)
				onFinish?.({
					chunks: chunksRef.current,
					durationMs,
					usage: runUsage,
					result: { type: "error", message },
				})
			},
		})

		return () => {
			clearInterval(tick)
			unsubscribe()
		}
	}, [source, onFinish])

	return (
		<div class="flex h-full" style="border-top: 1px solid var(--bpmnkit-border, #2a2a42);">
			<div
				class="flex flex-col w-1/2"
				style="border-right: 1px solid var(--bpmnkit-border, #2a2a42);"
			>
				<div
					class="flex items-center justify-between gap-2 px-4 py-2 text-xs"
					style="border-bottom: 1px solid var(--bpmnkit-border, #2a2a42);"
				>
					<span class="flex items-center gap-2">
						<Badge variant={BADGE_VARIANTS[variant]} size="sm">
							{LABELS[variant]}
						</Badge>
						{streaming && (
							<span
								class="inline-block w-2 h-4"
								style="background: currentColor; animation: blink 1s step-end infinite;"
							/>
						)}
					</span>
					<span class="flex items-center gap-3">
						<span style="color: var(--bpmnkit-fg-muted, #8888a8);" class="font-mono">
							{(elapsedMs / 1000).toFixed(1)}s
							{usage &&
								` · ${formatTokenCount(usage.inputTokens)} in / ${formatTokenCount(usage.outputTokens)} out`}
						</span>
						<Button size="sm" variant="ghost" disabled={!promptAvailable} onClick={onViewPrompt}>
							View Prompt
						</Button>
					</span>
				</div>
				<pre
					ref={codeRef}
					class="flex-1 overflow-auto p-4 text-xs leading-relaxed"
					style={`
            font-family: var(--bpmnkit-font-mono, monospace);
            color: var(--bpmnkit-fg, #cdd6f4);
            background: var(--bpmnkit-surface, #161626);
            margin: 0;
            white-space: pre-wrap;
            word-break: break-all;
          `}
				>
					{text}
					{streaming && (
						<span style="display:inline-block;width:8px;height:1em;background:var(--bpmnkit-accent-bright,#89b4fa);vertical-align:text-bottom;animation:blink 1s step-end infinite;" />
					)}
				</pre>
			</div>

			<div class="flex-1 p-4" style="background: var(--bpmnkit-bg, #0d0d16);">
				<BpmnViewer xml={bpmnXml} error={bpmnError} />
			</div>
		</div>
	)
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec tsc --noEmit
pnpm exec biome check src/ComparePanel.tsx
```
Expected: `biome check` clean on this file. `tsc --noEmit` will still show errors in `App.tsx` (its `onFinish` callbacks and `buildDurationBanner` import haven't been updated yet — that's Tasks 5/6) and possibly `duration-banner.ts`/`.test.ts` (about to be deleted in Task 5) — confirm no errors reference `ComparePanel.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add apps/demo/src/ComparePanel.tsx
git commit --no-gpg-sign -m "feat(demo): display token usage in ComparePanel"
```

---

### Task 5: Comparison Banner — Rename and Extend

**Files:**
- Create: `apps/demo/src/comparison-banner.ts`
- Test: `apps/demo/src/comparison-banner.test.ts`
- Delete: `apps/demo/src/duration-banner.ts`
- Delete: `apps/demo/src/duration-banner.test.ts`

**Interfaces:**
- Consumes: `formatTokenCount` from `./format-tokens.js` (Task 1), `PanelRunResult` from `./sources.js` (Task 3, now includes `usage`)
- Produces: `buildComparisonBanner(withSdk: PanelRunResult, withoutSdk: PanelRunResult): string`

- [ ] **Step 1: Write the failing test — create `apps/demo/src/comparison-banner.test.ts`**

```ts
import { describe, expect, it } from "vitest"
import { buildComparisonBanner } from "./comparison-banner.js"
import type { PanelRunResult } from "./sources.js"

function result(
	durationMs: number,
	usage?: { inputTokens: number; outputTokens: number },
): PanelRunResult {
	return { chunks: [], durationMs, usage: usage ?? null, result: { type: "bpmn", xml: "<xml/>" } }
}

describe("buildComparisonBanner", () => {
	it("reports With SDK as faster when it finished first (no usage data)", () => {
		const banner = buildComparisonBanner(result(12300), result(45100))
		expect(banner).toBe(
			"With SDK: 12.3s · Without SDK: 45.1s · With SDK was 3.7× faster than Without SDK",
		)
	})

	it("reports Without SDK as faster when it finished first (no usage data)", () => {
		const banner = buildComparisonBanner(result(9000), result(3000))
		expect(banner).toBe(
			"With SDK: 9.0s · Without SDK: 3.0s · Without SDK was 3.0× faster than With SDK",
		)
	})

	it("handles equal durations without dividing by a larger-than-actual number", () => {
		const banner = buildComparisonBanner(result(5000), result(5000))
		expect(banner).toBe(
			"With SDK: 5.0s · Without SDK: 5.0s · With SDK was 1.0× faster than Without SDK",
		)
	})

	it("includes token usage when both sides have it, naming With SDK as using more input tokens", () => {
		const banner = buildComparisonBanner(
			result(12300, { inputTokens: 8100, outputTokens: 340 }),
			result(45100, { inputTokens: 450, outputTokens: 890 }),
		)
		expect(banner).toBe(
			"With SDK: 12.3s, 8.1k in / 340 out · " +
				"Without SDK: 45.1s, 450 in / 890 out · " +
				"With SDK was 3.7× faster than Without SDK, " +
				"With SDK used 18.0× more input tokens than Without SDK",
		)
	})

	it("names Without SDK as using more input tokens when it actually does", () => {
		const banner = buildComparisonBanner(
			result(12300, { inputTokens: 100, outputTokens: 50 }),
			result(45100, { inputTokens: 900, outputTokens: 890 }),
		)
		expect(banner).toBe(
			"With SDK: 12.3s, 100 in / 50 out · " +
				"Without SDK: 45.1s, 900 in / 890 out · " +
				"With SDK was 3.7× faster than Without SDK, " +
				"Without SDK used 9.0× more input tokens than With SDK",
		)
	})

	it("falls back to the duration-only line when only one side has usage data", () => {
		const banner = buildComparisonBanner(
			result(12300, { inputTokens: 8100, outputTokens: 340 }),
			result(45100),
		)
		expect(banner).toBe(
			"With SDK: 12.3s · Without SDK: 45.1s · With SDK was 3.7× faster than Without SDK",
		)
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm test -- src/comparison-banner.test.ts
```
Expected: FAIL — `Cannot find module './comparison-banner.js'`

- [ ] **Step 3: Create `apps/demo/src/comparison-banner.ts`**

```ts
import { formatTokenCount } from "./format-tokens.js"
import type { PanelRunResult } from "./sources.js"

export function buildComparisonBanner(withSdk: PanelRunResult, withoutSdk: PanelRunResult): string {
	const withSdkMs = withSdk.durationMs
	const withoutSdkMs = withoutSdk.durationMs

	const [fasterLabel, fasterMs, slowerLabel, slowerMs] =
		withSdkMs <= withoutSdkMs
			? (["With SDK", withSdkMs, "Without SDK", withoutSdkMs] as const)
			: (["Without SDK", withoutSdkMs, "With SDK", withSdkMs] as const)

	const durationRatio = fasterMs > 0 ? (slowerMs / fasterMs).toFixed(1) : "—"

	if (!withSdk.usage || !withoutSdk.usage) {
		return (
			`With SDK: ${(withSdkMs / 1000).toFixed(1)}s · ` +
			`Without SDK: ${(withoutSdkMs / 1000).toFixed(1)}s · ` +
			`${fasterLabel} was ${durationRatio}× faster than ${slowerLabel}`
		)
	}

	const withSdkTokens = withSdk.usage.inputTokens
	const withoutSdkTokens = withoutSdk.usage.inputTokens

	const [moreLabel, moreTokens, fewerLabel, fewerTokens] =
		withSdkTokens >= withoutSdkTokens
			? (["With SDK", withSdkTokens, "Without SDK", withoutSdkTokens] as const)
			: (["Without SDK", withoutSdkTokens, "With SDK", withSdkTokens] as const)

	const tokenRatio = fewerTokens > 0 ? (moreTokens / fewerTokens).toFixed(1) : "—"

	return (
		`With SDK: ${(withSdkMs / 1000).toFixed(1)}s, ` +
		`${formatTokenCount(withSdk.usage.inputTokens)} in / ${formatTokenCount(withSdk.usage.outputTokens)} out · ` +
		`Without SDK: ${(withoutSdkMs / 1000).toFixed(1)}s, ` +
		`${formatTokenCount(withoutSdk.usage.inputTokens)} in / ${formatTokenCount(withoutSdk.usage.outputTokens)} out · ` +
		`${fasterLabel} was ${durationRatio}× faster than ${slowerLabel}, ` +
		`${moreLabel} used ${tokenRatio}× more input tokens than ${fewerLabel}`
	)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm test -- src/comparison-banner.test.ts
```
Expected: all 6 tests pass.

- [ ] **Step 5: Delete the old banner files**

```bash
rm apps/demo/src/duration-banner.ts apps/demo/src/duration-banner.test.ts
```

- [ ] **Step 6: Verify and commit**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec biome check src/comparison-banner.ts src/comparison-banner.test.ts
git add apps/demo/src/comparison-banner.ts apps/demo/src/comparison-banner.test.ts
git add apps/demo/src/duration-banner.ts apps/demo/src/duration-banner.test.ts
git commit --no-gpg-sign -m "feat(demo): extend comparison banner with token usage, rename from duration-banner"
```
(The second `git add` stages the deletions — `git add` on a removed path stages the removal.)

---

### Task 6: App.tsx Wiring

**Files:**
- Modify: `apps/demo/src/App.tsx`

**Interfaces:**
- Consumes: `buildComparisonBanner` from `./comparison-banner.js` (Task 5)
- Produces: no new exports — this is the final integration point

- [ ] **Step 1: Update the import in `apps/demo/src/App.tsx`**

Change:
```ts
import { buildDurationBanner } from "./duration-banner.js"
```
to:
```ts
import { buildComparisonBanner } from "./comparison-banner.js"
```

- [ ] **Step 2: Update the banner-building call site**

Change:
```ts
	const durationBanner =
		withSdkResult && withoutSdkResult ? buildDurationBanner(withSdkResult, withoutSdkResult) : null
```
to:
```ts
	const comparisonBanner =
		withSdkResult && withoutSdkResult ? buildComparisonBanner(withSdkResult, withoutSdkResult) : null
```

- [ ] **Step 3: Update the two remaining references to the old variable name**

The JSX currently has:
```tsx
			{durationBanner && (
				<div
					class="px-6 py-2 text-sm text-center"
					style="background: var(--bpmnkit-surface-2, #1e1e2e); color: var(--bpmnkit-fg, #cdd6f4);"
				>
					{durationBanner}
				</div>
			)}
```
Change both occurrences of `durationBanner` to `comparisonBanner`:
```tsx
			{comparisonBanner && (
				<div
					class="px-6 py-2 text-sm text-center"
					style="background: var(--bpmnkit-surface-2, #1e1e2e); color: var(--bpmnkit-fg, #cdd6f4);"
				>
					{comparisonBanner}
				</div>
			)}
```

- [ ] **Step 4: Verify everything is now fully clean**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec tsc --noEmit
pnpm exec tsc -p tsconfig.server.json --noEmit
pnpm test
pnpm exec biome check .
```
Expected: `tsc --noEmit` (both configs) exit 0 — no more references to `duration-banner.js` or the old `durationBanner` variable anywhere. `pnpm test` shows all test files passing (format-tokens: 2, comparison-banner: 6, sources: 7, plus the unchanged extractor: 8, system-prompt: 6, sdk-executor: 3, recordings-store: 9 — 41 total). `biome check .` clean.

- [ ] **Step 5: Commit**

```bash
git add apps/demo/src/App.tsx
git commit --no-gpg-sign -m "feat(demo): wire up renamed comparison banner in App"
```

---

### Task 7: End-to-End Verification

**Files:**
- No new files — verification only.

- [ ] **Step 1: Full verification suite**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec tsc --noEmit
pnpm exec tsc -p tsconfig.server.json --noEmit
pnpm test
pnpm exec biome check .
pnpm exec vite build
```
Expected: everything clean, build succeeds.

- [ ] **Step 2: Live smoke test — confirm real token usage flows all the way through**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
tsx server/index.ts &
sleep 1.5
curl -N --max-time 60 http://localhost:3001/stream/without-sdk | grep -A1 "^event: bpmn"
kill %1
```
Expected: the `data:` line following `event: bpmn` contains a real `"usage":{"inputTokens":<number>,"outputTokens":<number>}` field with non-zero, plausible values (e.g. `inputTokens` in the low thousands for the without-sdk system prompt, `outputTokens` in the hundreds to low thousands depending on the generated XML's length).

- [ ] **Step 3: Hand off browser verification**

The following requires a browser and cannot be verified by an agent in this environment — run manually:

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm dev
```
Open `http://localhost:3000` and confirm:
1. Clicking "Run Demo" — once each panel finishes, its header shows the token counts next to the elapsed timer (e.g. `12.3s · 8.1k in / 340 out`)
2. Once both panels finish, the banner below the header shows the full combined line including the token comparison clause
3. Selecting the existing `loan-approval-2026-07-01` recording from the picker — since it predates this feature, its panels show **no** token counts (just the timer) and the banner falls back to the duration-only line, with no crash or "undefined" text anywhere
4. Save a **new** recording after a live run, then reload and replay it — this time the token counts and full comparison-banner line *do* appear, since the new recording captured `usage`

Report back what you observe — if anything above doesn't match, we'll fix it as a follow-up task.
