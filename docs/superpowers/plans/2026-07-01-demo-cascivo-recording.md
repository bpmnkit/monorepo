# Demo Cascivo UI, Timers, Recording & Replay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `apps/demo`'s frontend with Cascivo components (dark theme), add per-panel timers and a duration/speed-comparison banner, a prompt viewer, and a recording/replay system that lets the demo be published as a static site and viewed with no live `claude` process.

**Architecture:** A `PanelSource` abstraction (`LiveSource` wrapping `EventSource`, `ReplaySource` scheduling recorded chunks via `setTimeout`) lets `ComparePanel` stay identical regardless of whether data is live or replayed. The Hono server gains `GET /health`, `GET /prompts`, and `POST /recordings`. Recordings are plain JSON files in `apps/demo/recordings/`, bundled into the frontend at build time via `import.meta.glob`, so a static `vite build` output needs no backend to replay them.

**Tech Stack:** Preact, Cascivo (`@cascivo/react`/`themes`/`tokens`), Hono, Vitest (fake timers for replay scheduling), existing `@bpmnkit/canvas`/`@bpmnkit/ui`.

## Global Constraints

- Preact only — no React. Hooks from `"preact/hooks"`. Cascivo's React components render fine because `@preact/preset-vite` (already configured) aliases `react`/`react-dom` → `preact/compat` automatically — no extra Vite config needed.
- TypeScript strict mode — zero type errors.
- Biome — zero warnings, zero errors. Repo uses **tabs**, not spaces.
- All bpmnkit design tokens via `var(--bpmnkit-*, <hex fallback>)`.
- Dark theme only — `index.html` already sets `data-theme="dark"` unconditionally; no theme switcher.
- `@cascivo/react`, `@cascivo/themes`, `@cascivo/tokens` go in `apps/demo/package.json` **dependencies** (not devDependencies) — matches `apps/studio`'s placement.
- All server files use ESM (`"type": "module"`, `.js` import extensions).
- `POST /recordings` must slugify the client-supplied name and never use raw user input as a filesystem path segment (path-traversal prevention) — reject if the sanitized slug is empty; reject (don't overwrite) if a file with that slug already exists.
- `recordings/*.json` is bundled into the frontend build via `import.meta.glob` so the static published site needs no backend to replay a saved run.
- No dedicated unit test is required for purely presentational components with no branching logic (`PromptModal`, `SaveRecordingModal`, `LiveSource`) — this mirrors the precedent already set by `BpmnViewer.tsx` in this same app, which also ships untested beyond typecheck/lint. Pure logic (`slugify`, `saveRecording`, `ReplaySource`, `buildDurationBanner`) gets TDD.

---

## File Map

**Created:**
- `apps/demo/shared/recording-types.ts` — `Recording`, `RecordedPanel` types (shared by server and frontend)
- `apps/demo/server/recordings-store.ts` — slug sanitization + safe file write
- `apps/demo/server/recordings-store.test.ts`
- `apps/demo/src/sources.ts` — `PanelSource`, `LiveSource`, `ReplaySource`, `PanelRunResult`
- `apps/demo/src/sources.test.ts`
- `apps/demo/src/recordings.ts` — build-time bundling of `apps/demo/recordings/*.json`
- `apps/demo/src/duration-banner.ts` — pure formatting function for the speed-comparison banner
- `apps/demo/src/duration-banner.test.ts`
- `apps/demo/src/PromptModal.tsx`
- `apps/demo/src/SaveRecordingModal.tsx`
- `apps/demo/recordings/.gitkeep` — keeps the (initially empty) recordings directory in git

**Modified:**
- `apps/demo/package.json` — add 3 Cascivo dependencies
- `apps/demo/tsconfig.json` — add `"shared"` to `include`
- `apps/demo/tsconfig.server.json` — add `"shared"` to `include`
- `apps/demo/vite.config.ts` — proxy `/health`, `/prompts`, `/recordings` to port 3001 (alongside the existing `/stream` proxy)
- `apps/demo/src/styles.css` — add Cascivo imports + `--cascivo-color-*` → `--bpmnkit-*` token bridge
- `apps/demo/server/index.ts` — add `GET /health`, `GET /prompts`, `POST /recordings`
- `apps/demo/src/ComparePanel.tsx` — accept `PanelSource` instead of building its own `EventSource`; live timer; chunk buffering; `onFinish` callback; Cascivo `Badge`/`Button`
- `apps/demo/src/App.tsx` — health-check mode detection, prompt fetching, source construction, duration state/banner, recording picker, Save Recording wiring, Cascivo `Button`/`Select`

---

### Task 1: Cascivo Dependencies & Theme Bridge

**Files:**
- Modify: `apps/demo/package.json`
- Modify: `apps/demo/src/styles.css`
- Modify: `apps/demo/tsconfig.json`

**Interfaces:**
- Produces: `@cascivo/react`, `@cascivo/themes`, `@cascivo/tokens` resolvable from `apps/demo`; `--cascivo-color-*` custom properties resolve to `--bpmnkit-*` values at `:root`; `tsc` resolves Cascivo's `react`-typed props via `preact/compat`.

**Critical gap this step closes:** `@cascivo/react`'s type declarations import from the `"react"` package (e.g. `ButtonHTMLAttributes`, `SelectHTMLAttributes`). `apps/demo` has no `react` package installed — only `preact`. `@preact/preset-vite` aliases `react` → `preact/compat` at the **bundler** level, but that does nothing for `tsc`, which resolves types independently of Vite. `apps/studio/tsconfig.json:9-13` adds an explicit `paths` mapping for exactly this reason — without it, `tsc --noEmit` will fail with "Cannot find module 'react'" the moment any Cascivo-typed component is imported (Task 5 onward). Add the same mapping here now, before any task imports a Cascivo component.

- [ ] **Step 1: Add Cascivo dependencies**

In `apps/demo/package.json`, add to `"dependencies"` (alongside the existing entries, keep alphabetical order):
```json
"@cascivo/react": "^0.3.1",
"@cascivo/themes": "^0.2.4",
"@cascivo/tokens": "^0.3.1",
```

- [ ] **Step 2: Add the Cascivo → bpmnkit token bridge to `apps/demo/src/styles.css`**

Add at the very top of the file, before the existing `@keyframes blink` block:
```css
@import "@cascivo/tokens";
@import "@cascivo/themes/base.css";
@import "@cascivo/react/styles.css";

/* Brand bridge: cascivo semantic color tokens → @bpmnkit/ui brand tokens.
 * Mirrors apps/studio/src/styles/cascivo.css so Cascivo components pick up
 * this app's dark theme for free. */
:root {
	--cascivo-color-bg: var(--bpmnkit-bg);
	--cascivo-color-background: var(--bpmnkit-bg);
	--cascivo-color-bg-subtle: var(--bpmnkit-surface-2);
	--cascivo-color-bg-muted: var(--bpmnkit-surface-2);
	--cascivo-color-surface: var(--bpmnkit-surface);
	--cascivo-color-surface-2: var(--bpmnkit-surface-2);
	--cascivo-color-surface-raised: var(--bpmnkit-surface);
	--cascivo-color-surface-overlay: var(--bpmnkit-panel-bg);

	--cascivo-color-foreground: var(--bpmnkit-fg);
	--cascivo-color-foreground-muted: var(--bpmnkit-fg-muted);
	--cascivo-color-text: var(--bpmnkit-fg);
	--cascivo-color-text-muted: var(--bpmnkit-fg-muted);
	--cascivo-color-text-subtle: var(--bpmnkit-fg-muted);
	--cascivo-color-text-on-accent: var(--bpmnkit-accent-fg);
	--cascivo-color-on-accent: var(--bpmnkit-accent-fg);

	--cascivo-color-border: var(--bpmnkit-border);
	--cascivo-color-border-strong: var(--bpmnkit-border);
	--cascivo-border-default: var(--bpmnkit-border);
	--cascivo-border-subtle: var(--bpmnkit-border);

	--cascivo-color-active-bg: var(--bpmnkit-accent-subtle);
	--cascivo-color-accent: var(--bpmnkit-accent);
	--cascivo-color-accent-hover: var(--bpmnkit-accent-bright);
	--cascivo-color-accent-active: var(--bpmnkit-accent);
	--cascivo-color-accent-foreground: var(--bpmnkit-accent-fg);
	--cascivo-color-accent-content: var(--bpmnkit-accent-fg);
	--cascivo-color-accent-muted: var(--bpmnkit-accent-subtle);
	--cascivo-color-accent-subtle: var(--bpmnkit-accent-subtle);
	--cascivo-color-primary: var(--bpmnkit-accent);
	--cascivo-color-primary-hover: var(--bpmnkit-accent-bright);
	--cascivo-color-primary-active: var(--bpmnkit-accent);
	--cascivo-color-primary-fg: var(--bpmnkit-accent-fg);
	--cascivo-color-primary-content: var(--bpmnkit-accent-fg);
	--cascivo-color-secondary: var(--bpmnkit-surface-2);
	--cascivo-color-secondary-hover: var(--bpmnkit-surface-2);
	--cascivo-color-secondary-content: var(--bpmnkit-fg);

	--cascivo-color-focus-ring: var(--bpmnkit-accent);
	--cascivo-focus-ring: var(--bpmnkit-accent);
	--cascivo-ring-color: var(--bpmnkit-accent);
	--cascivo-link-color: var(--bpmnkit-accent-bright);

	--cascivo-color-success: var(--bpmnkit-success);
	--cascivo-color-success-foreground: #fff;
	--cascivo-color-success-content: var(--bpmnkit-success);
	--cascivo-color-success-subtle: color-mix(in oklab, var(--bpmnkit-success) 15%, transparent);

	--cascivo-color-warning: var(--bpmnkit-warn);
	--cascivo-color-warning-foreground: #fff;
	--cascivo-color-warning-content: var(--bpmnkit-warn);
	--cascivo-color-warning-subtle: color-mix(in oklab, var(--bpmnkit-warn) 15%, transparent);

	--cascivo-color-danger: var(--bpmnkit-danger);
	--cascivo-color-danger-subtle: color-mix(in oklab, var(--bpmnkit-danger) 15%, transparent);
	--cascivo-color-error: var(--bpmnkit-danger);
	--cascivo-color-error-content: var(--bpmnkit-danger);
	--cascivo-color-destructive: var(--bpmnkit-danger);
	--cascivo-color-destructive-hover: var(--bpmnkit-danger);
	--cascivo-color-destructive-foreground: #fff;
	--cascivo-color-destructive-content: #fff;
	--cascivo-color-on-destructive: #fff;
	--cascivo-color-text-on-destructive: #fff;
	--cascivo-color-destructive-subtle: color-mix(in oklab, var(--bpmnkit-danger) 15%, transparent);

	--cascivo-color-info: var(--bpmnkit-accent-bright);
	--cascivo-color-info-content: var(--bpmnkit-accent-bright);
	--cascivo-color-info-subtle: var(--bpmnkit-accent-subtle);

	--cascivo-font-sans: var(--bpmnkit-font);
	--cascivo-font-display: var(--bpmnkit-font);
	--cascivo-font-mono: var(--bpmnkit-font-mono);
}
```

- [ ] **Step 3: Add the `react` → `preact/compat` type-resolution mapping**

In `apps/demo/tsconfig.json`, add `baseUrl` and `paths` to `compilerOptions` (the file currently has `target`/`module`/`moduleResolution`/`jsx`/`jsxImportSource`/`strict`/`skipLibCheck`/`noEmit` — add these two new keys alongside them, don't remove anything):
```json
"baseUrl": ".",
"paths": {
	"react": ["./node_modules/preact/compat"],
	"react-dom": ["./node_modules/preact/compat"],
	"react/jsx-runtime": ["./node_modules/preact/jsx-runtime"]
},
```

- [ ] **Step 5: Install and verify**

```bash
cd /home/adam/github.com/bpmnkit/monorepo
pnpm install
cd apps/demo
pnpm exec tsc --noEmit
pnpm exec vite build 2>&1 | tail -30
```
Expected: `pnpm install` succeeds (Cascivo packages appear in `apps/demo/node_modules`); `tsc --noEmit` exits 0 (confirms the `react` → `preact/compat` path mapping resolves — no component uses Cascivo yet, but the mapping itself must not break existing type-checking); `vite build` completes without a CSS resolution error (confirms the three `@import` statements resolve correctly).

- [ ] **Step 6: Commit**

```bash
git add apps/demo/package.json apps/demo/src/styles.css apps/demo/tsconfig.json pnpm-lock.yaml
git commit --no-gpg-sign -m "feat(demo): add Cascivo dependencies, token bridge, and react type mapping"
```

---

### Task 2: Server Health & Prompts Endpoints

**Files:**
- Modify: `apps/demo/server/index.ts`
- Modify: `apps/demo/vite.config.ts`

**Interfaces:**
- Produces:
  - `GET /health` → `200 { "status": "ok" }`
  - `GET /prompts` → `200 { "scenario": string, "withSdk": string, "withoutSdk": string }`

- [ ] **Step 1: Add the two routes to `apps/demo/server/index.ts`**

Add immediately after the line `app.use("*", cors())` and before the `/stream/with-sdk` route:
```ts
app.get("/health", (c) => c.json({ status: "ok" }))

app.get("/prompts", (c) =>
	c.json({
		scenario: SCENARIO_PROMPT,
		withSdk: SDK_SYSTEM_PROMPT,
		withoutSdk: WITHOUT_SDK_SYSTEM_PROMPT,
	}),
)
```
`SCENARIO_PROMPT`, `SDK_SYSTEM_PROMPT`, `WITHOUT_SDK_SYSTEM_PROMPT` are already imported/defined earlier in this file — no new imports needed for this step.

- [ ] **Step 2: Add proxy entries to `apps/demo/vite.config.ts`**

Find the existing `proxy` block:
```ts
proxy: {
	"/stream": "http://localhost:3001",
},
```
Replace with:
```ts
proxy: {
	"/stream": "http://localhost:3001",
	"/health": "http://localhost:3001",
	"/prompts": "http://localhost:3001",
},
```

- [ ] **Step 3: Verify by running the server directly**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec tsc -p tsconfig.server.json --noEmit
tsx server/index.ts &
sleep 1
curl -s http://localhost:3001/health
echo
curl -s http://localhost:3001/prompts | head -c 200
echo
kill %1
```
Expected: `tsc` exits 0; `/health` returns `{"status":"ok"}`; `/prompts` returns a JSON object starting with `{"scenario":"Generate a Loan Approval...`.

- [ ] **Step 4: Commit**

```bash
git add apps/demo/server/index.ts apps/demo/vite.config.ts
git commit --no-gpg-sign -m "feat(demo): add /health and /prompts endpoints"
```

---

### Task 3: Server Recordings Store & POST Endpoint

**Files:**
- Create: `apps/demo/shared/recording-types.ts`
- Create: `apps/demo/server/recordings-store.ts`
- Test: `apps/demo/server/recordings-store.test.ts`
- Modify: `apps/demo/server/index.ts`
- Modify: `apps/demo/tsconfig.json`
- Modify: `apps/demo/tsconfig.server.json`
- Modify: `apps/demo/vite.config.ts`
- Create: `apps/demo/recordings/.gitkeep`

**Interfaces:**
- Produces:
  - `Recording`, `RecordedPanel` types (importable from `../shared/recording-types.js` relative to both `server/` and `src/`)
  - `slugify(name: string): string`
  - `saveRecording(dir: string, recording: Recording): SaveResult` where `SaveResult = { status: "ok"; slug: string } | { status: "conflict"; slug: string } | { status: "invalid" }`
  - `POST /recordings` → `200 { slug }` | `400 { error }` | `409 { error }`

- [ ] **Step 1: Create the shared types**

Create `apps/demo/shared/recording-types.ts`:
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

export interface RecordedPanel {
	systemPrompt: string
	chunks: { t: number; text: string }[]
	durationMs: number
	result: { type: "bpmn"; xml: string } | { type: "error"; message: string }
}
```

- [ ] **Step 2: Add `"shared"` to both tsconfig `include` arrays**

In `apps/demo/tsconfig.json`, change:
```json
"include": ["src"]
```
to:
```json
"include": ["src", "shared"]
```

In `apps/demo/tsconfig.server.json`, change:
```json
"include": ["server"]
```
to:
```json
"include": ["server", "shared"]
```

- [ ] **Step 3: Write the failing test for `recordings-store.ts`**

Create `apps/demo/server/recordings-store.test.ts`:
```ts
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Recording } from "../shared/recording-types.js"
import { saveRecording, slugify } from "./recordings-store.js"

describe("slugify", () => {
	it("lowercases and hyphenates spaces", () => {
		expect(slugify("Loan Approval Demo")).toBe("loan-approval-demo")
	})

	it("strips special characters", () => {
		expect(slugify("Test! Run #2")).toBe("test-run-2")
	})

	it("collapses repeated hyphens", () => {
		expect(slugify("a---b")).toBe("a-b")
	})

	it("trims leading and trailing hyphens", () => {
		expect(slugify("-hello-")).toBe("hello")
	})

	it("returns an empty string when nothing sanitizable remains", () => {
		expect(slugify("!!!")).toBe("")
	})
})

describe("saveRecording", () => {
	let dir: string

	const sampleRecording: Recording = {
		name: "Test Recording",
		recordedAt: "2026-07-01T00:00:00.000Z",
		scenarioPrompt: "scenario",
		panels: {
			"with-sdk": {
				systemPrompt: "sdk prompt",
				chunks: [{ t: 0, text: "hello" }],
				durationMs: 100,
				result: { type: "bpmn", xml: "<xml/>" },
			},
			"without-sdk": {
				systemPrompt: "raw prompt",
				chunks: [{ t: 0, text: "world" }],
				durationMs: 200,
				result: { type: "error", message: "oops" },
			},
		},
	}

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "recordings-store-test-"))
	})

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true })
	})

	it("writes a JSON file readable back with the same content", () => {
		const result = saveRecording(dir, sampleRecording)
		expect(result).toEqual({ status: "ok", slug: "test-recording" })
		const written = JSON.parse(readFileSync(join(dir, "test-recording.json"), "utf-8"))
		expect(written).toEqual(sampleRecording)
	})

	it("returns conflict without overwriting an existing file", () => {
		saveRecording(dir, sampleRecording)
		const before = readFileSync(join(dir, "test-recording.json"), "utf-8")

		const second = saveRecording(dir, { ...sampleRecording, scenarioPrompt: "changed" })

		expect(second).toEqual({ status: "conflict", slug: "test-recording" })
		const after = readFileSync(join(dir, "test-recording.json"), "utf-8")
		expect(after).toBe(before)
	})

	it("returns invalid when the name sanitizes to an empty slug", () => {
		const result = saveRecording(dir, { ...sampleRecording, name: "!!!" })
		expect(result).toEqual({ status: "invalid" })
	})

	it("creates the target directory if it does not exist", () => {
		const nested = join(dir, "nested", "recordings")
		const result = saveRecording(nested, sampleRecording)
		expect(result).toEqual({ status: "ok", slug: "test-recording" })
	})
})
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm test -- server/recordings-store.test.ts
```
Expected: FAIL — `Cannot find module './recordings-store.js'`

- [ ] **Step 5: Implement `apps/demo/server/recordings-store.ts`**

```ts
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { Recording } from "../shared/recording-types.js"

export type SaveResult =
	| { status: "ok"; slug: string }
	| { status: "conflict"; slug: string }
	| { status: "invalid" }

export function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
}

export function saveRecording(dir: string, recording: Recording): SaveResult {
	const slug = slugify(recording.name)
	if (!slug) return { status: "invalid" }

	mkdirSync(dir, { recursive: true })
	const filePath = join(dir, `${slug}.json`)
	if (existsSync(filePath)) return { status: "conflict", slug }

	writeFileSync(filePath, JSON.stringify(recording, null, 2), "utf-8")
	return { status: "ok", slug }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm test -- server/recordings-store.test.ts
```
Expected: all 9 tests pass.

- [ ] **Step 7: Wire the `POST /recordings` route into `apps/demo/server/index.ts`**

Add these imports near the top, alongside the existing ones:
```ts
import { saveRecording } from "./recordings-store.js"
import type { Recording } from "../shared/recording-types.js"
```
Add near `REPO_ROOT`'s definition:
```ts
const RECORDINGS_DIR = join(REPO_ROOT, "apps/demo/recordings")
```
Add the route (place it after the `/prompts` route from Task 2):
```ts
app.post("/recordings", async (c) => {
	const body = (await c.req.json()) as Recording
	const result = saveRecording(RECORDINGS_DIR, body)
	if (result.status === "invalid") {
		return c.json(
			{ error: "Recording name must contain at least one alphanumeric character" },
			400,
		)
	}
	if (result.status === "conflict") {
		return c.json({ error: `A recording named "${result.slug}" already exists` }, 409)
	}
	return c.json({ slug: result.slug })
})
```

- [ ] **Step 8: Add the `/recordings` proxy entry to `apps/demo/vite.config.ts`**

```ts
proxy: {
	"/stream": "http://localhost:3001",
	"/health": "http://localhost:3001",
	"/prompts": "http://localhost:3001",
	"/recordings": "http://localhost:3001",
},
```

- [ ] **Step 9: Create the recordings directory placeholder**

```bash
mkdir -p /home/adam/github.com/bpmnkit/monorepo/apps/demo/recordings
touch /home/adam/github.com/bpmnkit/monorepo/apps/demo/recordings/.gitkeep
```

- [ ] **Step 10: Verify end to end**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec tsc -p tsconfig.server.json --noEmit
tsx server/index.ts &
sleep 1
curl -s -X POST http://localhost:3001/recordings \
	-H "Content-Type: application/json" \
	-d '{"name":"Smoke Test","recordedAt":"2026-07-01T00:00:00.000Z","scenarioPrompt":"x","panels":{"with-sdk":{"systemPrompt":"a","chunks":[],"durationMs":1,"result":{"type":"bpmn","xml":"<xml/>"}},"without-sdk":{"systemPrompt":"b","chunks":[],"durationMs":1,"result":{"type":"bpmn","xml":"<xml/>"}}}}'
echo
cat /home/adam/github.com/bpmnkit/monorepo/apps/demo/recordings/smoke-test.json
kill %1
rm /home/adam/github.com/bpmnkit/monorepo/apps/demo/recordings/smoke-test.json
```
Expected: curl returns `{"slug":"smoke-test"}`; the file exists with the posted content; cleaned up afterward so it doesn't get committed.

- [ ] **Step 11: Run the full test suite and commit**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm test
pnpm exec biome check .
```
Expected: all tests pass (17 existing + 9 new = 26); biome clean.

```bash
git add apps/demo/shared/ apps/demo/server/recordings-store.ts apps/demo/server/recordings-store.test.ts apps/demo/server/index.ts apps/demo/tsconfig.json apps/demo/tsconfig.server.json apps/demo/vite.config.ts apps/demo/recordings/.gitkeep
git commit --no-gpg-sign -m "feat(demo): add recordings store and POST /recordings endpoint"
```

---

### Task 4: Frontend Data-Source Abstraction

**Files:**
- Create: `apps/demo/src/sources.ts`
- Test: `apps/demo/src/sources.test.ts`
- Create: `apps/demo/src/recordings.ts`

**Interfaces:**
- Consumes: `Recording`, `RecordedPanel` from `../shared/recording-types.js` (Task 3)
- Produces:
  - `interface PanelSourceHandlers { onChunk: (text: string) => void; onDone: () => void; onBpmn: (xml: string) => void; onError: (message: string) => void }`
  - `interface PanelSource { subscribe(handlers: PanelSourceHandlers): () => void }`
  - `class LiveSource implements PanelSource` — constructor `(url: string)`
  - `class ReplaySource implements PanelSource` — constructor `(panel: RecordedPanel)`
  - `type PanelRunResult = Omit<RecordedPanel, "systemPrompt">` (i.e. `{ chunks, durationMs, result }`)
  - `recordings: Recording[]` (exported from `recordings.ts`)

- [ ] **Step 1: Write the failing tests for `ReplaySource`**

Create `apps/demo/src/sources.test.ts`:
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

	it("delivers a bpmn result at durationMs", () => {
		const onBpmn = vi.fn()
		new ReplaySource(panel).subscribe({
			onChunk: vi.fn(),
			onDone: vi.fn(),
			onBpmn,
			onError: vi.fn(),
		})

		vi.advanceTimersByTime(300)
		expect(onBpmn).toHaveBeenCalledWith("<xml/>")
	})

	it("delivers an error result when the recorded result is an error", () => {
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
		expect(onError).toHaveBeenCalledWith("boom")
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
		expect(onBpmn).toHaveBeenCalledWith("<xml/>")
	})
})
```

Note: `LiveSource` has no dedicated test — it's a thin `EventSource` wrapper with no branching logic beyond what the original `ComparePanel` already did inline; it's exercised by the live end-to-end verification in Task 9.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm test -- src/sources.test.ts
```
Expected: FAIL — `Cannot find module './sources.js'`

- [ ] **Step 3: Implement `apps/demo/src/sources.ts`**

```ts
import type { RecordedPanel } from "../shared/recording-types.js"

export interface PanelSourceHandlers {
	onChunk: (text: string) => void
	onDone: () => void
	onBpmn: (xml: string) => void
	onError: (message: string) => void
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
			const { xml } = JSON.parse((e as MessageEvent).data) as { xml: string }
			handlers.onBpmn(xml)
		})

		es.addEventListener("error", (e) => {
			if (e instanceof MessageEvent && e.data) {
				const { message } = JSON.parse(e.data) as { message: string }
				handlers.onError(message)
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
				if (this.panel.result.type === "bpmn") {
					handlers.onBpmn(this.panel.result.xml)
				} else {
					handlers.onError(this.panel.result.message)
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
Expected: all 6 tests pass.

- [ ] **Step 5: Implement `apps/demo/src/recordings.ts`**

```ts
import type { Recording } from "../shared/recording-types.js"

const modules = import.meta.glob<Recording>("../recordings/*.json", {
	eager: true,
	import: "default",
})

export const recordings: Recording[] = Object.values(modules)
```

- [ ] **Step 6: Verify typecheck and the whole suite**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec tsc --noEmit
pnpm test
pnpm exec biome check .
```
Expected: typecheck exits 0; all tests pass (26 existing + 6 new = 32); biome clean.

- [ ] **Step 7: Commit**

```bash
git add apps/demo/src/sources.ts apps/demo/src/sources.test.ts apps/demo/src/recordings.ts
git commit --no-gpg-sign -m "feat(demo): add PanelSource abstraction and build-time recording bundling"
```

---

### Task 5: ComparePanel Refactor

**Files:**
- Modify: `apps/demo/src/ComparePanel.tsx`

**Interfaces:**
- Consumes: `PanelSource`, `PanelRunResult` from `./sources.js` (Task 4)
- Produces:
  ```ts
  interface ComparePanelProps {
    variant: "with-sdk" | "without-sdk"
    source: PanelSource | null
    onFinish?: (result: PanelRunResult) => void
    onViewPrompt: () => void
    promptAvailable: boolean
  }
  ```
  `ComparePanel` no longer takes a `runKey` prop — the `source` prop's object identity is what triggers a (re)subscription; passing `null` means idle.

- [ ] **Step 1: Replace the full contents of `apps/demo/src/ComparePanel.tsx`**

```tsx
import { Badge, Button } from "@cascivo/react"
import { useEffect, useRef, useState } from "preact/hooks"
import { BpmnViewer } from "./BpmnViewer.js"
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
	const codeRef = useRef<HTMLPreElement>(null)
	const chunksRef = useRef<{ t: number; text: string }[]>([])
	const startedAtRef = useRef(0)

	useEffect(() => {
		setText("")
		setBpmnXml(null)
		setBpmnError(null)
		setElapsedMs(0)
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
			onBpmn: (xml) => {
				const durationMs = Date.now() - startedAtRef.current
				setBpmnXml(xml)
				clearInterval(tick)
				setElapsedMs(durationMs)
				onFinish?.({ chunks: chunksRef.current, durationMs, result: { type: "bpmn", xml } })
			},
			onError: (message) => {
				const durationMs = Date.now() - startedAtRef.current
				setBpmnError(message)
				setStreaming(false)
				clearInterval(tick)
				setElapsedMs(durationMs)
				onFinish?.({
					chunks: chunksRef.current,
					durationMs,
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
						</span>
						<Button
							size="sm"
							variant="ghost"
							disabled={!promptAvailable}
							onClick={onViewPrompt}
						>
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

**Note on this task's deviation from the design spec:** the design doc (§2/§4) describes an `onDone: (durationMs: number) => void` prop. This plan renames it to `onFinish: (result: PanelRunResult) => void` for two reasons: (1) `onDone` would collide in meaning with `PanelSourceHandlers.onDone` (a different event — text-stream-finished, not terminal-result), and (2) `App.tsx` needs the buffered `chunks` too (to assemble a `Recording`), not just the duration — `PanelRunResult` is a strict superset of what `onDone` would have carried. This is a naming/shape refinement, not a behavior change from what was approved.

- [ ] **Step 2: Verify**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec tsc --noEmit
pnpm exec biome check src/ComparePanel.tsx
```
Expected: biome clean on this file. `tsc --noEmit` will report errors in `App.tsx` (still passing the old `runKey` prop, missing the new required props) — that's expected until Task 8 rewrites `App.tsx`; confirm the errors are confined to `App.tsx` and `ComparePanel.tsx` itself has none, then proceed.

- [ ] **Step 3: Commit**

```bash
git add apps/demo/src/ComparePanel.tsx
git commit --no-gpg-sign -m "feat(demo): refactor ComparePanel onto PanelSource abstraction with timer"
```

---

### Task 6: PromptModal Component

**Files:**
- Create: `apps/demo/src/PromptModal.tsx`

**Interfaces:**
- Produces: `<PromptModal open onClose title scenarioPrompt systemPrompt />`

- [ ] **Step 1: Implement `apps/demo/src/PromptModal.tsx`**

```tsx
import { Modal } from "@cascivo/react"

interface PromptModalProps {
	open: boolean
	onClose: () => void
	title: string
	scenarioPrompt: string
	systemPrompt: string
}

export function PromptModal({
	open,
	onClose,
	title,
	scenarioPrompt,
	systemPrompt,
}: PromptModalProps) {
	return (
		<Modal open={open} onClose={onClose} title={title} size="lg">
			<div class="flex flex-col gap-4 mt-4">
				<div>
					<h3
						class="text-xs font-bold uppercase tracking-wide mb-1"
						style="color: var(--bpmnkit-fg-muted, #8888a8);"
					>
						Scenario Prompt
					</h3>
					<pre
						class="text-xs p-3 rounded overflow-auto max-h-40"
						style="font-family: var(--bpmnkit-font-mono, monospace); background: var(--bpmnkit-surface-2, #1e1e2e); color: var(--bpmnkit-fg, #cdd6f4); white-space: pre-wrap;"
					>
						{scenarioPrompt}
					</pre>
				</div>
				<div>
					<h3
						class="text-xs font-bold uppercase tracking-wide mb-1"
						style="color: var(--bpmnkit-fg-muted, #8888a8);"
					>
						System Prompt
					</h3>
					<pre
						class="text-xs p-3 rounded overflow-auto max-h-80"
						style="font-family: var(--bpmnkit-font-mono, monospace); background: var(--bpmnkit-surface-2, #1e1e2e); color: var(--bpmnkit-fg, #cdd6f4); white-space: pre-wrap;"
					>
						{systemPrompt}
					</pre>
				</div>
			</div>
		</Modal>
	)
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec tsc --noEmit
pnpm exec biome check src/PromptModal.tsx
```
Expected: biome clean on this file (pre-existing `App.tsx` type errors from Task 5's prop change are expected until Task 8).

- [ ] **Step 3: Commit**

```bash
git add apps/demo/src/PromptModal.tsx
git commit --no-gpg-sign -m "feat(demo): add PromptModal component"
```

---

### Task 7: SaveRecordingModal Component

**Files:**
- Create: `apps/demo/src/SaveRecordingModal.tsx`

**Interfaces:**
- Consumes: `Recording` from `../shared/recording-types.js` (Task 3)
- Produces: `<SaveRecordingModal open onClose defaultName recordingData />` where `recordingData: Omit<Recording, "name" | "recordedAt">`

- [ ] **Step 1: Implement `apps/demo/src/SaveRecordingModal.tsx`**

```tsx
import { Button, Input, Modal } from "@cascivo/react"
import { useState } from "preact/hooks"
import type { Recording } from "../shared/recording-types.js"

interface SaveRecordingModalProps {
	open: boolean
	onClose: () => void
	defaultName: string
	recordingData: Omit<Recording, "name" | "recordedAt">
}

type SaveStatus =
	| { kind: "idle" }
	| { kind: "saving" }
	| { kind: "success"; slug: string }
	| { kind: "error"; message: string }

export function SaveRecordingModal({
	open,
	onClose,
	defaultName,
	recordingData,
}: SaveRecordingModalProps) {
	const [name, setName] = useState(defaultName)
	const [status, setStatus] = useState<SaveStatus>({ kind: "idle" })

	async function handleSave() {
		setStatus({ kind: "saving" })
		const recording: Recording = { ...recordingData, name, recordedAt: new Date().toISOString() }
		try {
			const res = await fetch("/recordings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(recording),
			})
			const body = (await res.json()) as { slug?: string; error?: string }
			if (res.ok && body.slug) {
				setStatus({ kind: "success", slug: body.slug })
			} else {
				setStatus({ kind: "error", message: body.error ?? `Request failed with ${res.status}` })
			}
		} catch (err) {
			setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) })
		}
	}

	return (
		<Modal open={open} onClose={onClose} title="Save Recording">
			<div class="flex flex-col gap-4 mt-4">
				<Input
					label="Recording name"
					value={name}
					onInput={(e) => setName((e.target as HTMLInputElement).value)}
					disabled={status.kind === "saving" || status.kind === "success"}
				/>
				{status.kind === "success" && (
					<p style="color: var(--bpmnkit-success, #22c55e);" class="text-sm">
						Saved as apps/demo/recordings/{status.slug}.json
					</p>
				)}
				{status.kind === "error" && (
					<p style="color: var(--bpmnkit-danger, #f87171);" class="text-sm">
						{status.message}
					</p>
				)}
				<div class="flex justify-end gap-2">
					<Button variant="secondary" onClick={onClose}>
						Close
					</Button>
					<Button
						variant="primary"
						loading={status.kind === "saving"}
						disabled={status.kind === "success" || name.trim() === ""}
						onClick={handleSave}
					>
						Save
					</Button>
				</div>
			</div>
		</Modal>
	)
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec tsc --noEmit
pnpm exec biome check src/SaveRecordingModal.tsx
```
Expected: biome clean on this file (pre-existing `App.tsx` type errors from Task 5's prop change are expected until Task 8).

- [ ] **Step 3: Commit**

```bash
git add apps/demo/src/SaveRecordingModal.tsx
git commit --no-gpg-sign -m "feat(demo): add SaveRecordingModal component"
```

---

### Task 8: App.tsx Integration

**Files:**
- Create: `apps/demo/src/duration-banner.ts`
- Test: `apps/demo/src/duration-banner.test.ts`
- Modify: `apps/demo/src/App.tsx`

**Interfaces:**
- Consumes:
  - `ComparePanel` with the Task 5 prop shape
  - `PromptModal` (Task 6), `SaveRecordingModal` (Task 7)
  - `LiveSource`, `ReplaySource`, `PanelRunResult`, `PanelSource` from `./sources.js` (Task 4)
  - `recordings` from `./recordings.js` (Task 4)
  - `Recording` from `../shared/recording-types.js` (Task 3)
- Produces: the assembled `App` component (no new exports consumed elsewhere)

- [ ] **Step 1: Write the failing test for `buildDurationBanner`**

Create `apps/demo/src/duration-banner.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { buildDurationBanner } from "./duration-banner.js"
import type { PanelRunResult } from "./sources.js"

function result(durationMs: number): PanelRunResult {
	return { chunks: [], durationMs, result: { type: "bpmn", xml: "<xml/>" } }
}

describe("buildDurationBanner", () => {
	it("reports With SDK as faster when it finished first", () => {
		const banner = buildDurationBanner(result(12300), result(45100))
		expect(banner).toBe(
			"With SDK: 12.3s · Without SDK: 45.1s · With SDK was 3.7× faster than Without SDK",
		)
	})

	it("reports Without SDK as faster when it finished first", () => {
		const banner = buildDurationBanner(result(9000), result(3000))
		expect(banner).toBe(
			"With SDK: 9.0s · Without SDK: 3.0s · Without SDK was 3.0× faster than With SDK",
		)
	})

	it("handles equal durations without dividing by a larger-than-actual number", () => {
		const banner = buildDurationBanner(result(5000), result(5000))
		expect(banner).toBe("With SDK: 5.0s · Without SDK: 5.0s · With SDK was 1.0× faster than Without SDK")
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm test -- src/duration-banner.test.ts
```
Expected: FAIL — `Cannot find module './duration-banner.js'`

- [ ] **Step 3: Implement `apps/demo/src/duration-banner.ts`**

```ts
import type { PanelRunResult } from "./sources.js"

export function buildDurationBanner(withSdk: PanelRunResult, withoutSdk: PanelRunResult): string {
	const withSdkMs = withSdk.durationMs
	const withoutSdkMs = withoutSdk.durationMs

	const [fasterLabel, fasterMs, slowerLabel, slowerMs] =
		withSdkMs <= withoutSdkMs
			? (["With SDK", withSdkMs, "Without SDK", withoutSdkMs] as const)
			: (["Without SDK", withoutSdkMs, "With SDK", withSdkMs] as const)

	const ratio = fasterMs > 0 ? (slowerMs / fasterMs).toFixed(1) : "—"

	return (
		`With SDK: ${(withSdkMs / 1000).toFixed(1)}s · ` +
		`Without SDK: ${(withoutSdkMs / 1000).toFixed(1)}s · ` +
		`${fasterLabel} was ${ratio}× faster than ${slowerLabel}`
	)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm test -- src/duration-banner.test.ts
```
Expected: all 3 tests pass.

- [ ] **Step 5: Replace the full contents of `apps/demo/src/App.tsx`**

```tsx
import { Button, Select } from "@cascivo/react"
import { useCallback, useEffect, useState } from "preact/hooks"
import { ComparePanel } from "./ComparePanel.js"
import { buildDurationBanner } from "./duration-banner.js"
import { PromptModal } from "./PromptModal.js"
import { recordings } from "./recordings.js"
import { SaveRecordingModal } from "./SaveRecordingModal.js"
import { LiveSource, ReplaySource } from "./sources.js"
import type { PanelRunResult, PanelSource } from "./sources.js"
import type { Recording } from "../shared/recording-types.js"

type Variant = "with-sdk" | "without-sdk"
type Mode = "checking" | "live" | "replay-only"

interface Prompts {
	scenario: string
	withSdk: string
	withoutSdk: string
}

export function App() {
	const [mode, setMode] = useState<Mode>("checking")
	const [prompts, setPrompts] = useState<Prompts | null>(null)
	const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
	const [sources, setSources] = useState<Record<Variant, PanelSource | null>>({
		"with-sdk": null,
		"without-sdk": null,
	})
	const [runResults, setRunResults] = useState<Record<Variant, PanelRunResult | null>>({
		"with-sdk": null,
		"without-sdk": null,
	})
	const [viewingPrompt, setViewingPrompt] = useState<Variant | null>(null)
	const [savingRecording, setSavingRecording] = useState(false)

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

	function activeScenarioPrompt(): string {
		if (selectedRecording) return selectedRecording.scenarioPrompt
		return prompts?.scenario ?? ""
	}

	function activeSystemPrompt(variant: Variant): string {
		if (selectedRecording) return selectedRecording.panels[variant].systemPrompt
		if (!prompts) return ""
		return variant === "with-sdk" ? prompts.withSdk : prompts.withoutSdk
	}

	function runLive() {
		setSelectedRecording(null)
		setRunResults({ "with-sdk": null, "without-sdk": null })
		setSources({
			"with-sdk": new LiveSource("/stream/with-sdk"),
			"without-sdk": new LiveSource("/stream/without-sdk"),
		})
	}

	function replay(recording: Recording) {
		setSelectedRecording(recording)
		setRunResults({ "with-sdk": null, "without-sdk": null })
		setSources({
			"with-sdk": new ReplaySource(recording.panels["with-sdk"]),
			"without-sdk": new ReplaySource(recording.panels["without-sdk"]),
		})
	}

	const handleFinishWithSdk = useCallback((result: PanelRunResult) => {
		setRunResults((prev) => ({ ...prev, "with-sdk": result }))
	}, [])

	const handleFinishWithoutSdk = useCallback((result: PanelRunResult) => {
		setRunResults((prev) => ({ ...prev, "without-sdk": result }))
	}, [])

	const withSdkResult = runResults["with-sdk"]
	const withoutSdkResult = runResults["without-sdk"]

	const durationBanner =
		withSdkResult && withoutSdkResult
			? buildDurationBanner(withSdkResult, withoutSdkResult)
			: null

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
						/ AI comparison — Loan Approval Process
					</span>
				</div>
				<div class="flex items-center gap-2">
					{mode === "live" && (
						<Button variant="primary" onClick={runLive}>
							{sources["with-sdk"] ? "Run Again" : "Run Demo"}
						</Button>
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

			{durationBanner && (
				<div
					class="px-6 py-2 text-sm text-center"
					style="background: var(--bpmnkit-surface-2, #1e1e2e); color: var(--bpmnkit-fg, #cdd6f4);"
				>
					{durationBanner}
				</div>
			)}

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

			{viewingPrompt && (
				<PromptModal
					open
					onClose={() => setViewingPrompt(null)}
					title={viewingPrompt === "with-sdk" ? "With SDK — Prompt" : "Without SDK — Prompt"}
					scenarioPrompt={activeScenarioPrompt()}
					systemPrompt={activeSystemPrompt(viewingPrompt)}
				/>
			)}

			{savingRecording && recordingData && (
				<SaveRecordingModal
					open
					onClose={() => setSavingRecording(false)}
					defaultName={`loan-approval-${new Date().toISOString().slice(0, 10)}`}
					recordingData={recordingData}
				/>
			)}
		</div>
	)
}
```

- [ ] **Step 6: Verify**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec tsc --noEmit
pnpm test
pnpm exec biome check .
```
Expected: `tsc --noEmit` exits 0 (this is where all of Tasks 5–8's types finally reconcile together — if this fails, cross-check the prop names passed to `ComparePanel` against its Task 5 interface exactly); all tests pass (32 existing + 3 new = 35); biome clean.

- [ ] **Step 7: Commit**

```bash
git add apps/demo/src/duration-banner.ts apps/demo/src/duration-banner.test.ts apps/demo/src/App.tsx
git commit --no-gpg-sign -m "feat(demo): wire up App with mode detection, timers, prompts, and recording save/replay"
```

---

### Task 9: End-to-End Verification

**Files:**
- No new files — verification only.

- [ ] **Step 1: Full test suite and build**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm exec tsc --noEmit
pnpm exec tsc -p tsconfig.server.json --noEmit
pnpm test
pnpm exec biome check .
pnpm exec vite build
```
Expected: all clean, build succeeds (this specifically confirms the Cascivo CSS imports and the `import.meta.glob` recordings bundling both resolve correctly in a production build, not just dev).

- [ ] **Step 2: Live smoke test — health, prompts, and a full run via curl**

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
tsx server/index.ts &
sleep 1
curl -s http://localhost:3001/health
echo
curl -s http://localhost:3001/prompts | head -c 150
echo
curl -N --max-time 60 http://localhost:3001/stream/without-sdk | tail -5
kill %1
```
Expected: `/health` returns `{"status":"ok"}`; `/prompts` returns real prompt text; the stream reaches a terminal `event: bpmn` or `event: error` within the timeout, same as verified in the original build.

- [ ] **Step 3: Hand off browser verification**

The following requires a browser and cannot be verified by an agent in this environment — run manually:

```bash
cd /home/adam/github.com/bpmnkit/monorepo/apps/demo
pnpm dev
```
Open `http://localhost:3000` and confirm:
1. Cascivo components render with the dark bpmnkit palette (Button, Badge, and Select/Modal all pick up the bridged colors, not Cascivo's own defaults)
2. Clicking "Run Demo" streams both panels; each shows a live-ticking timer (e.g. `3.2s`, `4.7s`, …)
3. Once both panels finish, the duration/speed-comparison banner appears below the header
4. "View Prompt" opens a modal with the scenario + that panel's system prompt, for both panels
5. "Save Recording" appears once both panels finish; saving it writes a real file into `apps/demo/recordings/`
6. Refreshing the page and selecting that recording from the dropdown replays both panels with realistic timing, without hitting `claude` again — confirm by checking no new process briefly spawns (or simply that it works while offline/without the `claude` binary on `PATH`, if you want a harder guarantee)
7. Run `pnpm exec vite build && pnpm exec vite preview`, stop the Hono server, and open the preview URL — confirm the app falls back to replay-only mode (no "Run Demo"/"Save Recording", only the recording picker) and a saved recording still replays correctly with zero backend running

Report back what you observe — if anything above doesn't match, we'll fix it as a follow-up task.
