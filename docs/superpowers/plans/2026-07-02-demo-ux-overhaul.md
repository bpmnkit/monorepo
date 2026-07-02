# Demo UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface real error messages, keep visible progress under a new default race-bar-chart view, let replay speed change in real time, and switch the demo's theme to a less-blue dark palette.

**Architecture:** `ReplaySource` is rewritten around a self-rescheduling virtual clock so its playback speed can change mid-run; both `ReplaySource` and `LiveSource` gain a periodic `onTick(elapsedMs)` callback. The per-panel subscription moves out of `ComparePanel` into a new `usePanelRun` hook so `App.tsx` can drive two different views (the existing detailed panels, and a new `RaceChart`) off one shared subscription per side — critical because subscribing twice to a `LiveSource` would spawn a second real `claude` subprocess.

**Tech Stack:** Preact, Cascivo (`@cascivo/react`), Vitest, Biome, TypeScript strict.

## Global Constraints

- `PanelSourceHandlers` gains `onTick: (elapsedMs: number) => void`. `PanelSource` gains optional `setSpeed?(multiplier: number): void`.
- `ReplaySource`'s speed defaults to 1 and can change at any time via `setSpeed(multiplier)` — takes effect on the next tick, no rescheduling.
- The x-axis on the race chart starts at a 300,000ms (5 min) max and auto-extends (round up to the next whole minute) if either side's `elapsedMs` exceeds it.
- The speed control (1x/2x/5x/10x) is one shared control driving both panels, visible only while replaying (`selectedRecording !== null`) — never during a live run.
- The chart/detailed view toggle defaults to chart view, is not persisted across runs or reloads, and never interrupts an in-flight subscription (both `usePanelRun` calls run unconditionally regardless of which view is displayed).
- No new automated tests for `App.tsx`, `RaceChart.tsx`, or `use-panel-run.ts` — this codebase has never had automated tests for `App.tsx`/`ComparePanel.tsx` (established precedent: verified via `tsc`/`biome`/manual dev-server checks). `sources.ts` changes DO get full unit test coverage for `ReplaySource` (already has 7 passing tests); `LiveSource` has never had unit tests either (requires a browser `EventSource`, not set up in this test environment) — its `onTick` addition is manually/live verified only, consistent with existing precedent.
- ESM only, `.js` extensions in relative imports. Biome: tabs, double quotes, semicolons `asNeeded`, 100 char width, zero warnings. TypeScript strict, zero errors.
- Don't touch `packages/ui/src/tokens.css` — reuse the existing `"neon"` theme as-is.

---

### Task 1: `ReplaySource` virtual clock + `onTick`/`setSpeed`

**Files:**
- Modify: `apps/demo/src/sources.ts`
- Test: `apps/demo/src/sources.test.ts`

**Interfaces:**
- Produces: `PanelSourceHandlers.onTick(elapsedMs: number): void` (new, required field). `PanelSource.setSpeed?(multiplier: number): void` (new, optional). `ReplaySource.setSpeed(multiplier: number): void`. `LiveSource` implements `onTick` but not `setSpeed`.
- Consumes: nothing from other tasks.

Read the current file first — `apps/demo/src/sources.ts` — to see the exact existing `LiveSource`/`ReplaySource` code before editing.

- [ ] **Step 1: Write the failing tests**

Add these to the existing `describe("ReplaySource", ...)` block in `apps/demo/src/sources.test.ts` (keep all 7 existing tests as-is — they must still pass unmodified):

```typescript
	it("reports elapsed virtual time via onTick as ticks advance", () => {
		const onTick = vi.fn()
		new ReplaySource(panel).subscribe({
			onChunk: vi.fn(),
			onTick,
			onDone: vi.fn(),
			onBpmn: vi.fn(),
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(100)
		expect(onTick).toHaveBeenLastCalledWith(100)
	})

	it("setSpeed changes how fast virtual time advances for subsequent ticks", () => {
		const longPanel: RecordedPanel = {
			systemPrompt: "irrelevant",
			chunks: [],
			durationMs: 10000,
			result: { type: "bpmn", xml: "<xml/>" },
		}
		const onTick = vi.fn()
		const source = new ReplaySource(longPanel)
		source.subscribe({
			onChunk: vi.fn(),
			onTick,
			onDone: vi.fn(),
			onBpmn: vi.fn(),
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(100)
		expect(onTick).toHaveBeenLastCalledWith(100)

		source.setSpeed(5)
		vi.advanceTimersByTime(100)
		expect(onTick).toHaveBeenLastCalledWith(600)
	})

	it("clamps onTick's final value to durationMs, never exceeding it", () => {
		const onTick = vi.fn()
		new ReplaySource(panel).subscribe({
			onChunk: vi.fn(),
			onTick,
			onDone: vi.fn(),
			onBpmn: vi.fn(),
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(1000)
		for (const call of onTick.mock.calls) {
			expect(call[0]).toBeLessThanOrEqual(300)
		}
	})
```

Also add `onTick: vi.fn()` to every existing test's `subscribe({...})` call in this file — the type now requires it. Existing tests to update: "delivers chunks at their recorded relative times, in order", "calls onDone right after the last chunk, before the result", "delivers a bpmn result at durationMs with null usage when the recording has none", "delivers the recorded usage alongside the bpmn result when present", "delivers an error result with null usage when the recorded result is an error", "cancels all pending timers when unsubscribed", "handles zero chunks: onDone fires immediately, result fires at durationMs".

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/demo/`): `npx vitest run src/sources.test.ts`
Expected: FAIL — `onTick` is not part of the `PanelSourceHandlers` type yet (or, once you add the new tests, a mix of type errors and the new assertions failing since `ReplaySource` doesn't call `onTick` or have `setSpeed` yet).

- [ ] **Step 3: Rewrite `sources.ts`**

Replace the full contents of `apps/demo/src/sources.ts` with:

```typescript
import type { RecordedPanel, TokenUsage } from "../shared/recording-types.js"

export interface PanelSourceHandlers {
	onChunk: (text: string) => void
	onTick: (elapsedMs: number) => void
	onDone: () => void
	onBpmn: (xml: string, usage: TokenUsage | null) => void
	onError: (message: string, usage: TokenUsage | null) => void
}

export interface PanelSource {
	subscribe(handlers: PanelSourceHandlers): () => void
	setSpeed?(multiplier: number): void
}

export type PanelRunResult = Omit<RecordedPanel, "systemPrompt">

export class LiveSource implements PanelSource {
	constructor(private readonly url: string) {}

	subscribe(handlers: PanelSourceHandlers): () => void {
		const es = new EventSource(this.url)
		const startedAt = Date.now()
		const tickInterval = setInterval(() => {
			handlers.onTick(Date.now() - startedAt)
		}, 100)

		es.addEventListener("chunk", (e) => {
			const { text } = JSON.parse((e as MessageEvent).data) as { text: string }
			handlers.onChunk(text)
		})

		es.addEventListener("done", () => {
			handlers.onDone()
		})

		es.addEventListener("bpmn", (e) => {
			clearInterval(tickInterval)
			handlers.onTick(Date.now() - startedAt)
			const { xml, usage } = JSON.parse((e as MessageEvent).data) as {
				xml: string
				usage: TokenUsage | null
			}
			handlers.onBpmn(xml, usage)
		})

		es.addEventListener("error", (e) => {
			clearInterval(tickInterval)
			handlers.onTick(Date.now() - startedAt)
			if (e instanceof MessageEvent && e.data) {
				const { message, usage } = JSON.parse(e.data) as {
					message: string
					usage: TokenUsage | null
				}
				handlers.onError(message, usage)
			}
			es.close()
		})

		return () => {
			clearInterval(tickInterval)
			es.close()
		}
	}
}

const TICK_MS = 100

interface ScheduledEvent {
	t: number
	fire: () => void
}

export class ReplaySource implements PanelSource {
	private speed = 1

	constructor(private readonly panel: RecordedPanel) {}

	setSpeed(multiplier: number): void {
		this.speed = multiplier
	}

	subscribe(handlers: PanelSourceHandlers): () => void {
		const events: ScheduledEvent[] = this.panel.chunks.map((c) => ({
			t: c.t,
			fire: () => handlers.onChunk(c.text),
		}))

		const lastChunkT = this.panel.chunks.at(-1)?.t ?? 0
		events.push({ t: lastChunkT, fire: () => handlers.onDone() })

		const totalT = this.panel.durationMs
		events.push({
			t: totalT,
			fire: () => {
				const usage = this.panel.usage ?? null
				if (this.panel.result.type === "bpmn") {
					handlers.onBpmn(this.panel.result.xml, usage)
				} else {
					handlers.onError(this.panel.result.message, usage)
				}
			},
		})

		events.sort((a, b) => a.t - b.t)

		let virtualElapsedMs = 0
		let nextEventIndex = 0
		let lastRealTime: number | null = null
		let timer: ReturnType<typeof setTimeout> | null = null
		let stopped = false

		const fireDueEvents = () => {
			while (nextEventIndex < events.length && events[nextEventIndex].t <= virtualElapsedMs) {
				events[nextEventIndex].fire()
				nextEventIndex++
			}
		}

		const tick = () => {
			if (stopped) return
			const now = Date.now()
			const realDelta = lastRealTime === null ? 0 : now - lastRealTime
			lastRealTime = now
			virtualElapsedMs = Math.min(virtualElapsedMs + realDelta * this.speed, totalT)
			handlers.onTick(virtualElapsedMs)
			fireDueEvents()
			if (nextEventIndex < events.length) {
				timer = setTimeout(tick, TICK_MS)
			} else {
				stopped = true
			}
		}

		timer = setTimeout(tick, 0)

		return () => {
			stopped = true
			if (timer !== null) clearTimeout(timer)
		}
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/sources.test.ts`
Expected: PASS, 10 tests (7 existing + 3 new).

- [ ] **Step 5: Typecheck and lint**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.json`
Run (from repo root): `pnpm biome check apps/demo/src/sources.ts apps/demo/src/sources.test.ts`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/src/sources.ts apps/demo/src/sources.test.ts
git commit --no-gpg-sign -m "feat(demo): rewrite ReplaySource as a virtual clock with adjustable speed"
```

---

### Task 2: `usePanelRun` hook

**Files:**
- Create: `apps/demo/src/use-panel-run.ts`

**Interfaces:**
- Consumes (from Task 1): `PanelSource`, `PanelSourceHandlers`, `PanelRunResult` from `./sources.js`.
- Produces: `PanelRunState { text: string; bpmnXml: string | null; bpmnError: string | null; streaming: boolean; elapsedMs: number; usage: TokenUsage | null }`, `usePanelRun(source: PanelSource | null, onFinish?: (result: PanelRunResult) => void): PanelRunState`.

No automated test for this file (see Global Constraints — matches this codebase's established `App.tsx`/`ComparePanel.tsx` precedent). Verified by Task 6's manual dev-server check once it's wired in.

- [ ] **Step 1: Create the hook**

Create `apps/demo/src/use-panel-run.ts`:

```typescript
import { useEffect, useRef, useState } from "preact/hooks"
import type { TokenUsage } from "../shared/recording-types.js"
import type { PanelRunResult, PanelSource } from "./sources.js"

export interface PanelRunState {
	text: string
	bpmnXml: string | null
	bpmnError: string | null
	streaming: boolean
	elapsedMs: number
	usage: TokenUsage | null
}

const INITIAL_STATE: PanelRunState = {
	text: "",
	bpmnXml: null,
	bpmnError: null,
	streaming: false,
	elapsedMs: 0,
	usage: null,
}

export function usePanelRun(
	source: PanelSource | null,
	onFinish?: (result: PanelRunResult) => void,
): PanelRunState {
	const [state, setState] = useState<PanelRunState>(INITIAL_STATE)
	const chunksRef = useRef<{ t: number; text: string }[]>([])
	const startedAtRef = useRef(0)
	const elapsedMsRef = useRef(0)

	useEffect(() => {
		setState(INITIAL_STATE)
		chunksRef.current = []
		elapsedMsRef.current = 0

		if (!source) return

		startedAtRef.current = Date.now()
		setState((prev) => ({ ...prev, streaming: true }))

		const unsubscribe = source.subscribe({
			onChunk: (chunk) => {
				chunksRef.current.push({ t: Date.now() - startedAtRef.current, text: chunk })
				setState((prev) => ({ ...prev, text: prev.text + chunk }))
			},
			onTick: (elapsedMs) => {
				elapsedMsRef.current = elapsedMs
				setState((prev) => ({ ...prev, elapsedMs }))
			},
			onDone: () => {
				setState((prev) => ({ ...prev, streaming: false }))
			},
			onBpmn: (xml, runUsage) => {
				const durationMs = elapsedMsRef.current
				setState((prev) => ({ ...prev, bpmnXml: xml, usage: runUsage, streaming: false }))
				onFinish?.({
					chunks: chunksRef.current,
					durationMs,
					usage: runUsage,
					result: { type: "bpmn", xml },
				})
			},
			onError: (message, runUsage) => {
				const durationMs = elapsedMsRef.current
				setState((prev) => ({ ...prev, bpmnError: message, usage: runUsage, streaming: false }))
				onFinish?.({
					chunks: chunksRef.current,
					durationMs,
					usage: runUsage,
					result: { type: "error", message },
				})
			},
		})

		return () => {
			unsubscribe()
		}
	}, [source, onFinish])

	return state
}
```

- [ ] **Step 2: Typecheck and lint**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.json`
Run (from repo root): `pnpm biome check apps/demo/src/use-panel-run.ts`
Expected: both clean. (This file isn't consumed anywhere yet — Task 6 wires it in — so there's nothing to run beyond static checks at this point.)

- [ ] **Step 3: Commit**

```bash
git add apps/demo/src/use-panel-run.ts
git commit --no-gpg-sign -m "feat(demo): add usePanelRun hook to centralize per-panel subscription state"
```

---

### Task 3: `ComparePanel` becomes presentational

**Files:**
- Modify: `apps/demo/src/ComparePanel.tsx`

**Interfaces:**
- Consumes (from Task 2's `PanelRunState` shape, though this task doesn't import the hook itself — it just accepts the same fields as props): `text`, `bpmnXml`, `bpmnError`, `streaming`, `elapsedMs`, `usage`.
- Produces: `ComparePanelProps { variant, text, bpmnXml, bpmnError, streaming, elapsedMs, usage, onViewPrompt, promptAvailable }` — no more `source`/`onFinish` props. Task 6 wires the new props in from `usePanelRun`'s return value.

Read the current file first — `apps/demo/src/ComparePanel.tsx` — before editing.

- [ ] **Step 1: Replace the file**

Replace the full contents of `apps/demo/src/ComparePanel.tsx` with:

```tsx
import { Badge, Button } from "@cascivo/react"
import { useEffect, useRef } from "preact/hooks"
import type { TokenUsage } from "../shared/recording-types.js"
import { BpmnViewer } from "./BpmnViewer.js"
import { formatTokenCount } from "./format-tokens.js"

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

export function ComparePanel({
	variant,
	text,
	bpmnXml,
	bpmnError,
	streaming,
	elapsedMs,
	usage,
	onViewPrompt,
	promptAvailable,
}: ComparePanelProps) {
	const codeRef = useRef<HTMLPreElement>(null)

	useEffect(() => {
		if (codeRef.current) {
			codeRef.current.scrollTop = codeRef.current.scrollHeight
		}
	}, [text])

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

Note: the `useEffect(() => { codeRef.current.scrollTop = ... }, [text])` replaces the old imperative scroll-on-chunk call (which lived inside the now-removed subscription callback) — it fires whenever `text` grows, reproducing the same auto-scroll-to-bottom behavior.

- [ ] **Step 2: Typecheck**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.json`
Expected: errors in `App.tsx` (it still passes the old `source`/`onFinish` props — that's expected and gets fixed in Task 6). Confirm the errors are ONLY in `App.tsx`, not in `ComparePanel.tsx` itself.

- [ ] **Step 3: Lint**

Run (from repo root): `pnpm biome check apps/demo/src/ComparePanel.tsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/demo/src/ComparePanel.tsx
git commit --no-gpg-sign -m "refactor(demo): make ComparePanel presentational, driven by props instead of its own subscription"
```

(A pre-existing-tests-still-pass check isn't meaningful here since `ComparePanel.tsx` has no test file and `App.tsx`'s compile errors are expected until Task 6 — this is a known, temporary broken-build state between tasks, resolved by Task 6.)

---

### Task 4: `BpmnViewer` shows the real error message

**Files:**
- Modify: `apps/demo/src/BpmnViewer.tsx`

**Interfaces:**
- Consumes: nothing new — `error: string | null` prop already exists.
- Produces: no interface change.

- [ ] **Step 1: Replace the error-rendering branch**

In `apps/demo/src/BpmnViewer.tsx`, replace:

```tsx
	if (error) {
		return (
			<div
				class="flex h-full w-full items-center justify-center rounded text-sm"
				style="color: var(--bpmnkit-danger, #f87171); background: var(--bpmnkit-surface-2, #1e1e2e);"
			>
				Could not render
			</div>
		)
	}
```

with:

```tsx
	if (error) {
		return (
			<div
				class="h-full w-full rounded overflow-auto p-4"
				style="color: var(--bpmnkit-danger, #f87171); background: var(--bpmnkit-surface-2, #1e1e2e);"
			>
				<pre
					class="text-xs leading-relaxed"
					style="white-space: pre-wrap; word-break: break-word; margin: 0; font-family: var(--bpmnkit-font-mono, monospace);"
				>
					{error}
				</pre>
			</div>
		)
	}
```

- [ ] **Step 2: Typecheck and lint**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.json`
Run (from repo root): `pnpm biome check apps/demo/src/BpmnViewer.tsx`
Expected: no NEW errors introduced by this change (pre-existing `App.tsx` errors from Task 3 are still expected and unrelated).

- [ ] **Step 3: Verify against the real recording that motivated this fix**

Run (from `apps/demo/`):
```bash
node -e '
const rec = JSON.parse(require("fs").readFileSync("recordings/quote-to-cash-2026-07-01.json", "utf8"));
console.log(rec.panels["with-sdk"].result.message);
'
```
Expected: prints the `TypeError: b.defaultFlow(...).subProcess is not a function` stack trace — confirms this is exactly the message the new `<pre>` block will now display in the UI instead of the old generic string, once Task 6 wires this recording's replay through to `BpmnViewer`.

- [ ] **Step 4: Commit**

```bash
git add apps/demo/src/BpmnViewer.tsx
git commit --no-gpg-sign -m "fix(demo): show the real error message in BpmnViewer instead of a generic string"
```

---

### Task 5: `RaceChart` component

**Files:**
- Create: `apps/demo/src/RaceChart.tsx`

**Interfaces:**
- Consumes: `TokenUsage` from `../shared/recording-types.js`; `formatTokenCount` from `./format-tokens.js`.
- Produces: `RaceChartPanelData { elapsedMs: number; streaming: boolean; text: string; usage: TokenUsage | null; finished: boolean }`, `RaceChartProps { withSdk: RaceChartPanelData; withoutSdk: RaceChartPanelData }`, `RaceChart(props: RaceChartProps)`. Task 6 constructs `RaceChartPanelData` from `usePanelRun`'s state (`finished = bpmnXml !== null || bpmnError !== null`) and renders this component.

No automated test for this file (see Global Constraints).

- [ ] **Step 1: Create the component**

Create `apps/demo/src/RaceChart.tsx`:

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

export interface RaceChartProps {
	withSdk: RaceChartPanelData
	withoutSdk: RaceChartPanelData
}

function computeAxisMaxMs(elapsedA: number, elapsedB: number): number {
	const maxElapsed = Math.max(elapsedA, elapsedB)
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

export function RaceChart({ withSdk, withoutSdk }: RaceChartProps) {
	const axisMaxMs = computeAxisMaxMs(withSdk.elapsedMs, withoutSdk.elapsedMs)
	const tickCount = Math.round(axisMaxMs / MINUTE_MS)

	return (
		<div class="flex flex-col gap-6 p-8 h-full justify-center">
			<Bar label="With SDK" colorVar="--bpmnkit-success" data={withSdk} axisMaxMs={axisMaxMs} />
			<Bar
				label="Without SDK"
				colorVar="--bpmnkit-danger"
				data={withoutSdk}
				axisMaxMs={axisMaxMs}
			/>
			<div
				class="flex justify-between text-xs font-mono"
				style="color: var(--bpmnkit-fg-muted, #8888a8);"
			>
				{Array.from({ length: tickCount + 1 }, (_, i) => (
					<span key={i}>{formatDuration(i * MINUTE_MS)}</span>
				))}
			</div>
		</div>
	)
}
```

- [ ] **Step 2: Typecheck and lint**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.json`
Run (from repo root): `pnpm biome check apps/demo/src/RaceChart.tsx`
Expected: both clean. (Pre-existing `App.tsx` errors from Task 3 remain expected until Task 6; this file introduces no new ones since it isn't consumed yet.)

- [ ] **Step 3: Commit**

```bash
git add apps/demo/src/RaceChart.tsx
git commit --no-gpg-sign -m "feat(demo): add RaceChart horizontal bar comparison view"
```

---

### Task 6: Wire everything into `App.tsx`, add view toggle and speed control

**Files:**
- Modify: `apps/demo/src/App.tsx`

**Interfaces:**
- Consumes: `usePanelRun` + `PanelRunState` (Task 2), `ComparePanel`'s new props (Task 3), `RaceChart` + `RaceChartPanelData` (Task 5).
- Produces: no new exports — this is the integration point.

Read the current file first — `apps/demo/src/App.tsx` — before editing. This task replaces most of the file; the sections below show the complete new versions of each changed piece.

- [ ] **Step 1: Update imports**

Replace:

```typescript
import { Button, Select } from "@cascivo/react"
import { useCallback, useEffect, useState } from "preact/hooks"
import type { Recording } from "../shared/recording-types.js"
import { ComparePanel } from "./ComparePanel.js"
import { PromptModal } from "./PromptModal.js"
import { SaveRecordingModal } from "./SaveRecordingModal.js"
import { buildComparisonBanner } from "./comparison-banner.js"
import { recordings } from "./recordings.js"
import { LiveSource, ReplaySource } from "./sources.js"
import type { PanelRunResult, PanelSource } from "./sources.js"
```

with:

```typescript
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
```

- [ ] **Step 2: Add `view` and `replaySpeed` state**

After the existing `const [scenarios, setScenarios] = useState<ScenarioInfo[] | null>(null)` line, add:

```typescript
	const [view, setView] = useState<"chart" | "detailed">("chart")
	const [replaySpeed, setReplaySpeed] = useState(1)
```

- [ ] **Step 3: Subscribe once per variant via the hook**

After the existing `handleFinishWithoutSdk` `useCallback` block, add:

```typescript
	const withSdkRun = usePanelRun(sources["with-sdk"], handleFinishWithSdk)
	const withoutSdkRun = usePanelRun(sources["without-sdk"], handleFinishWithoutSdk)

	useEffect(() => {
		sources["with-sdk"]?.setSpeed?.(replaySpeed)
		sources["without-sdk"]?.setSpeed?.(replaySpeed)
	}, [replaySpeed, sources])
```

- [ ] **Step 4: Add the view toggle and speed control to the header**

Replace:

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
					{recordings.length > 0 && (
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
							onChange={(e) =>
								setReplaySpeed(Number((e.target as HTMLSelectElement).value))
							}
						/>
					)}
					{recordings.length > 0 && (
```

- [ ] **Step 5: Replace the `<main>` block to switch between chart and detailed views**

Replace:

```typescript
			<main class="flex-1 flex flex-col overflow-hidden">
				<div class="flex-1 overflow-hidden">
					<ComparePanel
						variant="with-sdk"
						source={sources["with-sdk"]}
						onFinish={handleFinishWithSdk}
						onViewPrompt={() => setViewingPrompt("with-sdk")}
						promptAvailable={activeSystemPrompt("with-sdk") !== ""}
					/>
				</div>
				<div class="flex-1 overflow-hidden">
					<ComparePanel
						variant="without-sdk"
						source={sources["without-sdk"]}
						onFinish={handleFinishWithoutSdk}
						onViewPrompt={() => setViewingPrompt("without-sdk")}
						promptAvailable={activeSystemPrompt("without-sdk") !== ""}
					/>
				</div>
			</main>
```

with:

```typescript
			<main class="flex-1 flex flex-col overflow-hidden">
				{view === "chart" ? (
					<RaceChart
						withSdk={{
							elapsedMs: withSdkRun.elapsedMs,
							streaming: withSdkRun.streaming,
							text: withSdkRun.text,
							usage: withSdkRun.usage,
							finished: withSdkRun.bpmnXml !== null || withSdkRun.bpmnError !== null,
						}}
						withoutSdk={{
							elapsedMs: withoutSdkRun.elapsedMs,
							streaming: withoutSdkRun.streaming,
							text: withoutSdkRun.text,
							usage: withoutSdkRun.usage,
							finished: withoutSdkRun.bpmnXml !== null || withoutSdkRun.bpmnError !== null,
						}}
					/>
				) : (
					<>
						<div class="flex-1 overflow-hidden">
							<ComparePanel
								variant="with-sdk"
								text={withSdkRun.text}
								bpmnXml={withSdkRun.bpmnXml}
								bpmnError={withSdkRun.bpmnError}
								streaming={withSdkRun.streaming}
								elapsedMs={withSdkRun.elapsedMs}
								usage={withSdkRun.usage}
								onViewPrompt={() => setViewingPrompt("with-sdk")}
								promptAvailable={activeSystemPrompt("with-sdk") !== ""}
							/>
						</div>
						<div class="flex-1 overflow-hidden">
							<ComparePanel
								variant="without-sdk"
								text={withoutSdkRun.text}
								bpmnXml={withoutSdkRun.bpmnXml}
								bpmnError={withoutSdkRun.bpmnError}
								streaming={withoutSdkRun.streaming}
								elapsedMs={withoutSdkRun.elapsedMs}
								usage={withoutSdkRun.usage}
								onViewPrompt={() => setViewingPrompt("without-sdk")}
								promptAvailable={activeSystemPrompt("without-sdk") !== ""}
							/>
						</div>
					</>
				)}
			</main>
```

- [ ] **Step 6: Typecheck**

Run (from `apps/demo/`): `npx tsc --noEmit -p tsconfig.json`
Expected: zero errors — this resolves the `App.tsx` errors that were expected since Task 3.

- [ ] **Step 7: Lint**

Run (from repo root): `pnpm biome check apps/demo/src/App.tsx`
Expected: clean.

- [ ] **Step 8: Run the full test suite**

Run (from `apps/demo/`): `npx vitest run`
Expected: PASS, all files (nothing in this task touches a tested file directly, but confirms nothing else broke).

- [ ] **Step 9: Manual dev-server check**

From `apps/demo/`, run `pnpm dev` in the background, wait ~2s, then:
```bash
curl -s http://localhost:3000/ | grep -o "AI comparison"
```
Expected: `AI comparison` (page still serves without a build error). Stop the dev server afterward (`pkill -f "vite --port 3000"` and `pkill -f "tsx watch server/index.ts"`).

Note: full interactive verification (bars actually animating, speed control changing playback rate live, view toggle switching correctly) requires a browser and is not possible in this environment — flag this as a manual follow-up for the user, consistent with prior rounds.

- [ ] **Step 10: Commit**

```bash
git add apps/demo/src/App.tsx
git commit --no-gpg-sign -m "feat(demo): wire RaceChart default view, view toggle, and replay speed control into App"
```

---

### Task 7: Switch demo theme to `neon`

**Files:**
- Modify: `apps/demo/index.html`

**Interfaces:** none.

- [ ] **Step 1: Change the theme attribute**

In `apps/demo/index.html`, change:

```html
<html lang="en" data-theme="dark">
```

to:

```html
<html lang="en" data-theme="neon">
```

- [ ] **Step 2: Verify the neon theme tokens exist**

Run (from repo root):
```bash
grep -A5 '\[data-theme="neon"\]' packages/ui/src/tokens.css
```
Expected: prints the `neon` theme's token block (background/surface/accent/etc. `oklch(...)` values) — confirms the theme this HTML attribute now selects actually exists and is fully defined.

- [ ] **Step 3: Manual dev-server check**

From `apps/demo/`, run `pnpm dev` in the background, wait ~2s, then:
```bash
curl -s http://localhost:3000/ | grep 'data-theme'
```
Expected: `data-theme="neon"` present in the served HTML. Stop the dev server afterward.

- [ ] **Step 4: Commit**

```bash
git add apps/demo/index.html
git commit --no-gpg-sign -m "style(demo): switch theme to neon for a less blue-tinted dark palette"
```

---

### Task 8: Full verification

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
Expected: all pass with zero errors/warnings. Test count should be 10 more than the pre-plan baseline (Task 1's 3 new `ReplaySource` tests plus the `onTick` additions to existing tests don't add count, only Task 1's genuinely new `it(...)` blocks do — confirm the exact total by comparing against the count from the last `npx vitest run` before this plan started).

- [ ] **Step 2: Replay the quote-to-cash recording and confirm the real error now shows**

This is a build-time check standing in for the browser check that isn't possible here: confirm the built JS bundle contains the `<pre>`-based error rendering (not the old fixed string) by checking the source directly, since the bundle itself isn't practical to grep post-minification:

```bash
grep -n "Could not render" apps/demo/src/BpmnViewer.tsx || echo "confirmed: old generic string removed"
```
Expected: `confirmed: old generic string removed`.

- [ ] **Step 3: Report deferred items to the user**

State explicitly (no commit needed for this step): full interactive browser verification — bar animation smoothness, speed control actually changing perceived playback rate, view toggle round-tripping without losing an in-flight run, and the neon theme's actual visual appearance — was not performed. No browser is available in this environment. The user should exercise all of this once locally before relying on it for a live demo.
