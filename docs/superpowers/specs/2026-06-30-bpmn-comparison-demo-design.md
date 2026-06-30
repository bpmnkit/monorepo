# BPMN SDK Comparison Demo — Design Spec

**Date:** 2026-06-30  
**Branch:** video-demonstration  
**Goal:** Animated side-by-side comparison showing Claude generating a Camunda 8 BPMN process with vs. without the `@bpmnkit/core` SDK — usable as a shareable microsite and screen-recordable for video.

---

## Overview

A new `apps/demo` application in the monorepo. Two-column, two-row grid: top row is "with SDK", bottom row is "without SDK". Both LLM runs fire simultaneously when the user clicks "Run". The left column in each row streams the LLM output live (typewriter effect); the right column renders the BPMN diagram once the stream completes. Both runs use the same model (Claude via `claude -p`) and the same scenario prompt — the only variable is the system prompt.

The "without SDK" case shows the LLM generating raw XML from memory (likely verbose, possibly malformed). The "with SDK" case shows the LLM generating clean TypeScript using `@bpmnkit/core`, which the server executes with `tsx` to produce valid BPMN XML. The contrast — clean diagram vs. broken/partial render — is the point.

---

## Fixed Scenario

**Prompt (sent to both runs):**

> "Generate a Loan Approval BPMN process for Camunda 8. It should include: credit score check via REST connector, exclusive gateway for pre-screening, DMN business rule task for risk scoring, user task for manual underwriter review, and separate end events for approved/rejected outcomes."

This scenario is hardcoded. It maps directly to `apps/examples/src/03-loan-approval.ts`, which is also injected as context in the "with SDK" run.

---

## App Structure

```
apps/demo/
  src/
    main.tsx              # Vite/React entry
    App.tsx               # root: 2x2 grid, SSE wiring, Run button
    ComparePanel.tsx      # single row: label + code stream + BPMN viewer
    BpmnViewer.tsx        # wraps @bpmnkit/canvas, handles load/error/loading states
  server/
    index.ts              # Hono SSE server on port 3001
    claude-runner.ts      # spawns `claude -p`, parses stream-json, forwards chunks
    sdk-executor.ts       # extracts TS code, runs tsx, captures stdout XML
    system-prompt.ts      # builds fat SDK context at startup from repo files
  index.html
  vite.config.ts          # proxies /stream/* to :3001
  package.json
  tsconfig.json
```

---

## Runtime Flow

1. User opens page, sees the fixed scenario label and "Run Demo" button.
2. User clicks "Run Demo".
3. Browser opens two SSE connections simultaneously:
   - `GET /stream/with-sdk`
   - `GET /stream/without-sdk`
4. Server spawns two `claude -p` subprocesses in parallel, each with a different system prompt.
5. Token chunks stream in → forwarded as `chunk` SSE events → typewriter effect in left columns.
6. When each stream ends:
   - **without-sdk**: server scans accumulated text for `<?xml … </bpmn:definitions>`, emits `bpmn` event (or `error` if not found).
   - **with-sdk**: server extracts the TypeScript code block, writes to a temp file, runs `tsx`, captures stdout as BPMN XML, emits `bpmn` event.
7. Browser renders BPMN in right column via `@bpmnkit/canvas`.
8. "Run Demo" button resets both panels and restarts the streams.

---

## SSE Protocol

Both `/stream/with-sdk` and `/stream/without-sdk` emit the same event types:

| Event  | Payload                  | Meaning                              |
|--------|--------------------------|--------------------------------------|
| `chunk` | `{"text": "..."}` | Streaming token from LLM |
| `bpmn`  | `{"xml": "..."}` | Final BPMN XML — triggers render |
| `error` | `{"message": "..."}` | Extraction or execution failure |
| `done`  | `{}` | Stream finished (may precede `bpmn`) |

---

## LLM Invocation

**Command (both runs):**
```
claude -p "<scenario prompt>" --system "<system prompt>" --output-format stream-json
```

Uses existing `claude` CLI auth — no API key management needed.

**Without SDK system prompt:**
```
You are a BPMN expert. Output only valid BPMN 2.0 XML for Camunda 8.
No explanation, no markdown, no code fences. Raw XML only.
```

**With SDK system prompt** (built by `system-prompt.ts` at server startup):
1. One-paragraph intro to `@bpmnkit/core` and what it does
2. Full exported TypeScript type definitions from `packages/core/src`
3. `packages/core/README.md`
4. Full content of `apps/examples/src/03-loan-approval.ts`
5. Output instruction: "Generate TypeScript using `@bpmnkit/core`. Call `process.stdout.write(definitions.toXml())` at the end instead of `writeFileSync`. Output code only, no explanation, no markdown fences."

---

## SDK Execution (`sdk-executor.ts`)

1. Extract the TypeScript code block from the accumulated LLM response (strip markdown fences if present).
2. Write to a temp file (e.g. `/tmp/bpmnkit-demo-<uuid>.ts`).
3. Run `tsx <tempfile>` with the monorepo's `node_modules` on the resolution path.
4. Capture stdout as BPMN XML.
5. Clean up temp file.
6. Emit `bpmn` SSE event with the XML.
7. On any failure (tsx error, empty stdout), emit `error` event.

---

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  bpmnkit        Loan Approval Process    [Run Demo]      │
├────────────────────────────┬────────────────────────────┤
│  ● WITH SDK                │                            │
│  ── ── ── ── ── ──         │   [BPMN renders here]      │
│  Bpmn.createProcess(...)   │                            │
│  .startEvent(...)          │                            │
│  .branch(...)▌             │                            │
├────────────────────────────┼────────────────────────────┤
│  ✕ WITHOUT SDK             │                            │
│  ── ── ── ── ── ──         │   [broken/partial render   │
│  <bpmn:definitions         │    or "Could not render"]  │
│    xmlns:bpmn="...">▌      │                            │
│                            │                            │
└────────────────────────────┴────────────────────────────┘
```

- **Theme:** Dark (`--bpmnkit-bg`, `--bpmnkit-surface` tokens), optimized for screen recording
- **Left column:** Monospace, `--bpmnkit-font-mono`, scrolls automatically, fixed height, blinking cursor while streaming
- **Right column:** Shimmer placeholder while waiting; `@bpmnkit/canvas` render on `bpmn` event; red "Could not render" state on `error` — contrast is intentional
- **Row badges:** "WITH SDK" in `--bpmnkit-success` color; "WITHOUT SDK" in `--bpmnkit-danger` color
- **Run button:** Resets both panels, closes existing SSE connections, opens fresh ones
- **No other controls** — fixed scenario, fixed model, no configuration UI

---

## Turborepo Wiring

- Add `apps/demo` to `pnpm-workspace.yaml`
- Add `build`, `dev`, `typecheck` scripts to `apps/demo/package.json`
- The demo's dev mode runs both Vite (`port 3000`) and Hono server (`port 3001`) via `concurrently`
- Runtime dependencies: `hono`, `@bpmnkit/canvas`, `@bpmnkit/core` (for type resolution in executor)
- New root devDependencies needed: `tsx`, `concurrently` (not currently at root; `vite` and `typescript` already are)

---

## Out of Scope

- Model picker / configurable scenario
- Auth or deployment pipeline
- Mobile layout
- Any animation beyond typewriter streaming and BPMN render-in
