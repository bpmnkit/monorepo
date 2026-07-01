# BPMN Comparison Demo — Cascivo UI, Timers, Recording & Replay

**Date:** 2026-07-01
**Branch:** video-demonstration
**Builds on:** `apps/demo` (see `docs/superpowers/specs/2026-06-30-bpmn-comparison-demo-design.md` and its implementation plan)

## Overview

Four related enhancements to the existing live BPMN SDK comparison demo:

1. Rebuild the frontend UI with Cascivo components (`@cascivo/react`), dark theme, following the same token-bridging pattern `apps/studio` already uses.
2. Per-panel live elapsed timers, plus a one-line duration/speed-comparison banner once both panels finish.
3. A "View Prompt" modal per panel showing the exact system + scenario prompt used.
4. Recording: save a completed run (with authentic per-chunk timing) as a JSON file in the repo, and replay it later — including from a **static build with no backend at all**, so the demo can be published (e.g. GitHub Pages) and viewed without a live `claude` process.

---

## 1. Cascivo Integration & Theming

Add to `apps/demo/package.json` dependencies:
```json
"@cascivo/react": "^0.3.1",
"@cascivo/themes": "^0.2.4",
"@cascivo/tokens": "^0.3.1"
```

No Vite alias changes needed — `@preact/preset-vite` (already in use) aliases `react`/`react-dom` → `preact/compat` automatically, so Cascivo's React components render fine under Preact.

`apps/demo/src/styles.css` gains the same bridge `apps/studio/src/styles/cascivo.css` uses:
```css
@import "@cascivo/tokens";
@import "@cascivo/themes/base.css";
@import "@cascivo/react/styles.css";

:root {
  --cascivo-color-bg: var(--bpmnkit-bg);
  --cascivo-color-surface: var(--bpmnkit-surface);
  --cascivo-color-foreground: var(--bpmnkit-fg);
  --cascivo-color-accent: var(--bpmnkit-accent);
  --cascivo-color-success: var(--bpmnkit-success);
  --cascivo-color-danger: var(--bpmnkit-danger);
  /* ...full mapping, mirroring apps/studio/src/styles/cascivo.css */
}
```

`index.html` already sets `data-theme="dark"` unconditionally — this app stays dark-only, no theme switcher.

**Component swaps:**
- Plain `<button>` (Run/Run Again) → Cascivo `Button`
- "WITH SDK"/"WITHOUT SDK" label pills → Cascivo `Badge`
- New "View Prompt" button per panel → Cascivo `Button` (icon variant)
- Prompt viewer → Cascivo `Modal`
- Save-recording name entry → Cascivo `Modal` + `Input`
- Recording picker (replay mode) → Cascivo `Select`/`Dropdown` if available, else a plain `<select>` styled via the bridged tokens
- Header/panel container divs stay plain elements styled via the bridged CSS variables where Cascivo has no equivalent primitive — no forced fit.

---

## 2. Timers & Duration Summary

Timing state is lifted to `App.tsx` since the duration banner needs both panels' results together.

- `App.tsx` holds `durations: Record<Variant, number | null>`, reset to `{ "with-sdk": null, "without-sdk": null }` on every new run/replay.
- `ComparePanel` gains an `onDone: (durationMs: number) => void` prop, invoked exactly once when it reaches its terminal `bpmn` or `error` event.
- `ComparePanel` renders its own live elapsed-time display (e.g. `12.3s`) next to its badge — a `setInterval` tick (~100ms) while `streaming`, computed from a `startedAt` timestamp captured when its `PanelSource` opens (works identically whether the source is live or replayed).
- Once both `durations` entries are non-null, `App.tsx` renders a banner beneath the header:
  `With SDK: 12.3s · Without SDK: 45.1s · SDK was 3.7× faster`
  — computed generically as `slower / faster`, phrased for whichever side actually finished first (no hardcoded assumption about which wins).
- The banner clears when a new run/replay starts.

---

## 3. Prompt Viewer

**Live mode:** new `GET /prompts` on the Hono server returns:
```json
{ "scenario": "...", "withSdk": "...", "withoutSdk": "..." }
```
— just the existing `SCENARIO_PROMPT`, `SDK_SYSTEM_PROMPT`, `WITHOUT_SDK_SYSTEM_PROMPT` constants exposed over HTTP; no new prompt-building logic. `App.tsx` fetches this once on mount and passes the relevant strings down as props.

**Replay mode:** the prompts come from the loaded `Recording`'s `scenarioPrompt` / `panels[variant].systemPrompt` fields instead — same modal component, different data source.

Each panel header gets a "View Prompt" button opening a `Modal` with the scenario prompt and that panel's system prompt in a scrollable monospace block. Available at all times (before/during/after a run), per the approved design — but disabled (not hidden) until prompt data actually exists: in live mode, until the `/prompts` fetch resolves; in replay-only mode, until a recording has been selected from the picker.

---

## 4. Recording Data Model & Save

**File location:** `apps/demo/recordings/<slug>.json`

**Shape:**
```ts
interface Recording {
  name: string             // display name, e.g. "loan-approval-2026-06-30"
  recordedAt: string       // ISO 8601 timestamp
  scenarioPrompt: string
  panels: {
    "with-sdk": RecordedPanel
    "without-sdk": RecordedPanel
  }
}

interface RecordedPanel {
  systemPrompt: string
  chunks: { t: number; text: string }[]   // t = ms since this panel's stream started
  durationMs: number
  result:
    | { type: "bpmn"; xml: string }
    | { type: "error"; message: string }
}
```

**Capture:** `ComparePanel` already receives every `chunk`/`bpmn`/`error` event during a live run. It appends each to an in-memory buffer with a relative timestamp (`t = Date.now() - startedAt`) unconditionally — negligible cost, only happens on an explicit user-triggered run. Once both panels finish, `App.tsx` has everything needed to assemble a full `Recording`.

**Save:** A "Save Recording" button appears once both panels have finished, **and only in live mode** (backend reachable — see §5). Clicking it opens a `Modal` with an `Input` for the recording name (defaulting to a slug derived from the scenario + current date), then `POST`s the assembled `Recording` to a new endpoint:

```
POST /recordings
Body: Recording (as above)
```

The server:
1. Slugifies `name` into a filesystem-safe string (lowercase, `[a-z0-9-]` only, collapse repeats) — **never uses the raw client-supplied name as a path segment**, to prevent path traversal.
2. Writes the JSON to `apps/demo/recordings/<slug>.json`, rejecting (400) if a file with that slug already exists (no silent overwrite) — the modal surfaces the conflict and lets the user rename.
3. Returns `{ slug }` on success, or `{ error: "..." }` with a 400/409 status on validation failure or name conflict.

The save modal shows the result inline (success message with the final slug, or the error message) — no toast/notification system needed for this.

This endpoint (and `/prompts`, `/health`) only exists on the Hono dev server — irrelevant to, and absent from, the static published build described next.

---

## 5. Replay Mode & Static Deployment

**Backend-availability detection:** new `GET /health` (trivial 200 OK) on the Hono server. On mount, `App.tsx` fetches it with a ~1.5s timeout.
- Succeeds → **live mode**: Run Demo, Save Recording, and `/prompts` fetching all enabled.
- Fails/times out → **replay-only mode** (this is what a static published build always hits, since there's no server at all): Run Demo is replaced by a recording picker; Save Recording is hidden; prompts come from whichever recording is loaded.

**Static bundling:** `apps/demo/src/recordings.ts`:
```ts
const modules = import.meta.glob<Recording>("../recordings/*.json", { eager: true, import: "default" })
export const recordings: Recording[] = Object.values(modules)
```
This makes every recording in the repo part of the `vite build` output — a published static site is fully self-contained, no server or filesystem access needed at runtime.

**Data-source abstraction** — the key refactor enabling both modes to share one `ComparePanel`:
```ts
interface PanelSource {
  subscribe(handlers: {
    onChunk: (text: string) => void
    onDone: () => void
    onBpmn: (xml: string) => void
    onError: (message: string) => void
  }): () => void   // cleanup/unsubscribe
}
```
- `LiveSource` wraps the real `EventSource` — behaviorally identical to `ComparePanel`'s current inline logic, just extracted.
- `ReplaySource` takes a `RecordedPanel` and schedules each `chunks[i]` via `setTimeout(chunks[i].t)`, then delivers the stored `result` at `durationMs` — reproducing the original typewriter timing exactly.

`ComparePanel` takes a `source: PanelSource` prop instead of constructing an `EventSource` itself. Its internal state/rendering/timer logic is unchanged — it has no idea whether data is live or replayed.

`App.tsx` constructs the right `PanelSource` per panel based on current mode (live run vs. selected recording) and passes it down.

**Picker UI:** a dropdown lists bundled `recordings` by `name`. In replay-only mode it's the only way to see the demo run; in live mode it's offered as an alternative to "Run Demo".

---

## File Map

**Modified:**
- `apps/demo/package.json` — add 3 Cascivo dependencies
- `apps/demo/src/styles.css` — add Cascivo import + token bridge
- `apps/demo/src/App.tsx` — mode detection (`/health`), prompt fetching, duration state + banner, recording assembly/save, recording picker, Cascivo `Button`
- `apps/demo/src/ComparePanel.tsx` — accept `PanelSource` instead of constructing `EventSource` directly; live timer; chunk buffering for recording capture; `onDone` callback; "View Prompt" button; Cascivo `Badge`
- `apps/demo/server/index.ts` — add `GET /health`, `GET /prompts`, `POST /recordings`

**Created:**
- `apps/demo/src/sources.ts` — `PanelSource` interface, `LiveSource`, `ReplaySource`
- `apps/demo/src/recordings.ts` — `import.meta.glob` bundling of `apps/demo/recordings/*.json`
- `apps/demo/src/PromptModal.tsx` — Cascivo `Modal` showing scenario + system prompt
- `apps/demo/src/SaveRecordingModal.tsx` — Cascivo `Modal` + `Input` for naming a recording
- `apps/demo/server/recordings-store.ts` — slug sanitization + file write logic for `POST /recordings` (separated for unit testability)
- `apps/demo/recordings/` — directory where saved recordings live (starts empty; no recordings are pre-seeded as part of this work)

---

## Out of Scope

- Theme switching (light/neon) — stays dark-only, matching the existing app
- Editing or deleting recordings via the UI (delete by removing the file manually)
- Multi-recording comparison (only one recording replays at a time)
- Any change to the LLM invocation mechanism, extraction logic, or SDK executor from the original demo build
- Pre-seeding an example recording (the capability is built; populating `recordings/` with a real captured run is a separate, later action)
