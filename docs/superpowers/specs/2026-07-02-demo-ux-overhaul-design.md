# Demo UX Overhaul — Design

## Goal

Five improvements to the live/replay demo experience, prompted by running the quote-to-cash scenario and hitting a confusing failure:

1. Show the real error message when a panel fails, instead of a generic "Could not render".
2. Keep some visible sign of progress while Claude is generating, even under the new default view (item 4).
3. Let the user change replay speed (1x/2x/5x/10x) at any time during playback, not just at the start.
4. Change the default view to a horizontal race-bar chart (one bar per side, animated against a time axis), with a toggle to the existing detailed view.
5. Switch the demo's theme to something less blue.

## 1. Error message surfacing

`BpmnViewer.tsx:32-40` renders a fixed `"Could not render"` string whenever its `error` prop is set, discarding the actual message even though `ComparePanel` already tracks it (`bpmnError` state). Errors can be short ("No BPMN XML found in LLM output") or a full multi-line Node stack trace (confirmed against the quote-to-cash recording: a `TypeError` with a stack trace). Rather than special-casing error shapes, render the full message in a scrollable monospace block — same visual treatment (danger-colored surface) as today, but showing the truth instead of a canned string.

## 2 & 3. Live progress + adjustable replay speed — shared architecture problem

Both of these need the same underlying fix, so they're designed together.

**The problem:** `ReplaySource` (`sources.ts`) currently pre-schedules every chunk/done/result with a fixed `setTimeout` at its exact recorded timestamp. That can't support a speed the user changes mid-playback — the timers are already scheduled at fixed real-world delays. It also means "elapsed time" during replay is implicitly just wall-clock time, which breaks once speed ≠ 1.

**The fix:** rewrite `ReplaySource` around a self-rescheduling virtual clock:
- Track `virtualElapsedMs`, a mutable `speed` multiplier (default 1), and a sorted list of `{t, fire}` events (each chunk, the "done" marker, and the final bpmn/error result).
- A recursive `setTimeout` tick (starting at 0ms, then every 100ms) computes `realDelta` since the last tick, advances `virtualElapsedMs += realDelta * speed`, fires every event whose `t` has now been crossed, and reschedules itself until all events have fired.
- `setSpeed(multiplier)` just reassigns `speed` — takes effect on the next tick, no rescheduling needed. This is what makes real-time speed changes possible.

**New shared interface piece:** `PanelSourceHandlers` gains `onTick: (elapsedMs: number) => void`, called periodically while a run is active. `LiveSource` gets an equivalent tick (real `Date.now()`-based, same 100ms cadence) so both source types report elapsed time the same way. `PanelSource` gains an optional `setSpeed?(multiplier: number): void` — `LiveSource` doesn't implement it (you can't speed up a real Claude call); `ReplaySource` does.

**Consequence — a necessary refactor:** today `ComparePanel` privately subscribes to its `source` and owns all the run state (`text`, `bpmnXml`, `bpmnError`, `elapsedMs`, `usage`, `streaming`). The new race-bar view (item 4) needs that *same* data. Two components independently calling `source.subscribe()` would be wrong — for `LiveSource` specifically, `subscribe()` opens a new `EventSource`, and a second one would spawn a second real `claude` subprocess server-side, doubling cost. So the subscription moves up: a new hook, `usePanelRun(source, onFinish?)`, owns the subscription and returns `{ text, bpmnXml, bpmnError, streaming, elapsedMs, usage }`. `App.tsx` calls it once per variant and passes the result down as props to whichever view is currently displayed. `ComparePanel` becomes purely presentational (props instead of self-managed state) — no behavior change from a user's perspective, just where the state lives.

**Speed control UI:** a small control (four options: 1x, 2x, 5x, 10x) visible only while replaying (`selectedRecording !== null`), driving one shared `replaySpeed` state in `App.tsx` that's applied to both panels' sources via `sources[variant]?.setSpeed?.(replaySpeed)`. One control for both panels, since they're always replaying the same recording together — like a single video player's speed control.

**Live progress ticker (item 2):** with `usePanelRun` centralizing `text` regardless of which view is shown, the race-bar view can display a one-line, tail-truncated ticker of the live streamed text (last ~70 characters, replaced continuously) beneath each bar while `streaming` is true — giving visible motion without needing the full detailed pane open.

## 4. Default race-bar chart view

New component, `RaceChart.tsx`. Two horizontal bars (with-SDK, without-SDK — reusing the existing success/destructive color convention from `ComparePanel`'s badges), each bar's length proportional to `elapsedMs / axisMaxMs`. The x-axis starts at a 300,000ms (5 min) max and auto-extends (rounds up to the next whole minute) if either panel's `elapsedMs` actually exceeds it, so a slow run never clips off-screen. Axis ticks every 60s, labeled `mm:ss`. Each bar shows its live ticker text (item 2 above) while running, and its final duration + token counts (same info as today's per-panel header) once finished.

`App.tsx` gets a `view: "chart" | "detailed"` state (default `"chart"`) and a toggle button that switches to today's dual-`ComparePanel` layout and back, at any time, for both live and replay runs. Both `usePanelRun` calls run unconditionally regardless of which view is visible, so toggling never restarts or interrupts an in-flight run.

## 5. Darker theme

`apps/demo/index.html:2` sets `data-theme="dark"`, whose token values (`--bpmnkit-bg: #0d0d16`, `--bpmnkit-surface: #161626`, defined in `packages/ui/src/tokens.css`) carry a navy/indigo cast. That file also already ships a `"neon"` theme with much lower-chroma, near-neutral-black backgrounds (`oklch(11% 0.025 270)` etc.) built on the same accent family. Switching the demo to `data-theme="neon"` is a one-line change in `index.html` — no edits to the shared token file, so it doesn't ripple into the editor, canvas, or any other app consuming `@bpmnkit/ui`.

## Out of scope

- No persistence of the chart/detailed view toggle across page reloads or runs — resets to chart view each time.
- No per-panel independent replay speed — one shared control for both.
- No new theme tokens or edits to `packages/ui` — reusing the existing `"neon"` theme as-is.
- No automated tests for `RaceChart.tsx`, `usePanelRun.ts`, or `App.tsx` changes — this codebase has never had automated tests for `App.tsx`/`ComparePanel.tsx` (UI wiring, verified via `tsc`/`biome`/manual dev-server checks in every prior round); staying consistent rather than introducing new test infrastructure here. `sources.ts`'s `ReplaySource`/`LiveSource` changes ARE covered by existing + new unit tests, since that file already has full test coverage today.
