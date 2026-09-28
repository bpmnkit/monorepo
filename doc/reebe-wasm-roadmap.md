# Reebe WASM — Implementation Roadmap

> **Status (2026-09-23): the checkboxes below were never maintained.** The crate
> (`apps/reebe/crates/reebe-wasm`), its in-memory backend and clock exist and ship as
> `@bpmnkit/reebe-wasm` (0.1.x, experimental), used by `@bpmnkit/engine/wasm-runner`, `casen test`
> and Studio. `doc/progress.md` is the record of what was built; treat this file as the
> original plan.

> Deliver an interactive BPMN playground that runs entirely in the browser.
> See `reebe-wasm-plan.md` for the full analysis and design rationale.

---

## Guiding principles

- **No regressions.** Every phase must leave Postgres and SQLite server builds fully functional.
- **Additive by default.** New traits and crates are added; existing code is only changed where strictly necessary to make seams injectable.
- **Processors are never touched.** The 12 BPMN processors carry the execution logic and are treated as a black box throughout.
- **Shippable at each phase.** Each phase produces something runnable, not just scaffolding.

---

## Phase overview

| Phase | Name | Output | Duration |
|---|---|---|---|
| 0 | Standalone WASM libraries | `@reebe/bpmn` and `@reebe/feel` NPM packages | 1 week |
| 1 | StateBackend trait | Engine decoupled from sqlx; Postgres/SQLite unchanged | 2–3 weeks |
| 2 | InMemoryBackend | Engine runs with zero DB | 1–2 weeks |
| 3 | Clock abstraction | Virtual time for timer-driven processes | 3–5 days |
| 4 | `reebe-wasm` crate | Rust WASM binary with wasm-bindgen API | 1–2 weeks |
| 5 | JS playground | Browser UI wired to the WASM engine | 2–3 weeks |
| 6 | Polish & publish | NPM package, docs, demo site | 1 week |

**Total: 9–13 weeks**

---

## Phase 0 — Standalone WASM libraries

**Goal:** Ship `reebe-bpmn` and `reebe-feel` as standalone browser-compatible WASM packages. No engine changes. Proves the WASM toolchain works and delivers immediate value.

### Action items

#### 0.1 Set up WASM toolchain
- [ ] Add `wasm-pack` to the project (`cargo install wasm-pack` documented in README)
- [ ] Verify `wasm32-unknown-unknown` target installed (`rustup target add wasm32-unknown-unknown`)
- [ ] Add `.cargo/config.toml` with WASM build profile (`opt-level = "z"`, `lto = true`)

#### 0.2 `reebe-bpmn` WASM package
- [ ] Add `wasm-bindgen` as an optional dependency in `reebe-bpmn/Cargo.toml` behind a `wasm` feature flag
- [ ] Create `reebe-bpmn/src/wasm.rs` — export `parse_bpmn(xml: &str) -> JsValue` (returns JSON of the process graph)
- [ ] Export `list_elements(process_json: JsValue) -> JsValue` — returns all flow elements with IDs and types
- [ ] Export `validate_bpmn(xml: &str) -> JsValue` — returns list of validation errors
- [ ] Run `wasm-pack build crates/reebe-bpmn --target web --features wasm`
- [ ] Verify output `.wasm` + `.js` + `.d.ts` in `pkg/`
- [ ] Add `just build-wasm-bpmn` to justfile

#### 0.3 `reebe-feel` WASM package
- [ ] Add `wasm-bindgen` as optional dependency in `reebe-feel/Cargo.toml` behind a `wasm` feature flag
- [ ] Create `reebe-feel/src/wasm.rs` — export `evaluate(expression: &str, context_json: &str) -> JsValue`
- [ ] Export `evaluate_condition(expression: &str, context_json: &str) -> bool`
- [ ] Run `wasm-pack build crates/reebe-feel --target web --features wasm`
- [ ] Add `just build-wasm-feel` to justfile

#### 0.4 Basic smoke test
- [ ] Create `wasm-test/index.html` — a minimal HTML page that loads both packages and runs a quick test
- [ ] Parse a sample BPMN from Phase 0 test page
- [ ] Evaluate a FEEL expression from Phase 0 test page
- [ ] Add `just serve-wasm-test` (e.g. `python3 -m http.server` in `wasm-test/`)

#### 0.5 Verify server builds still pass
- [ ] `cargo check -p reebe-server` — no regressions
- [ ] `cargo check --no-default-features --features embedded -p reebe-server` — no regressions

---

## Phase 1 — StateBackend trait

**Goal:** Decouple the engine's repository access from sqlx. The Postgres and SQLite backends remain fully functional and unchanged from a user perspective — they just implement the new trait.

### Action items

#### 1.1 Define the `StateBackend` trait in `reebe-db`
- [ ] Create `reebe-db/src/backend.rs`
- [ ] Define `trait StateBackend: Send + Sync` covering all repository operations used by processors:
  - Process instance CRUD
  - Element instance CRUD
  - Job CRUD + activation queries
  - Variable CRUD
  - Incident CRUD
  - Timer CRUD
  - Signal subscription CRUD
  - Gateway token operations
  - Deployment CRUD
  - User task CRUD
  - Identity/authorization operations
  - `insert_record`, `insert_batch`, `next_position_batch`, `next_position_and_key`
- [ ] Export `StateBackend` from `reebe-db/src/lib.rs`

#### 1.2 Implement `SqlxBackend` wrapping the existing repositories
- [ ] Create `reebe-db/src/sqlx_backend.rs`
- [ ] Implement `StateBackend` for `SqlxBackend` by delegating to the existing repository structs (`ProcessInstanceRepository`, `JobRepository`, etc.)
- [ ] `SqlxBackend` holds a `DbPool` internally — exactly as the engine does today
- [ ] Gate behind `#[cfg(any(feature = "postgres", feature = "sqlite"))]`
- [ ] Export from `reebe-db`

#### 1.3 Thread `Arc<dyn StateBackend>` through `reebe-engine`
- [ ] Update `EngineState` in `engine.rs`: replace `pub pool: DbPool` with `pub backend: Arc<dyn StateBackend>`
- [ ] Update `Engine::new()` to accept `Arc<dyn StateBackend>` instead of `DbPool`
- [ ] Update `commit_results` — replace `RecordRepository::new(&self.state.pool)` with calls through `self.state.backend`
- [ ] Update `write_command_to_db` — same
- [ ] Update all processors that currently create repositories from `state.pool` to use `state.backend` instead
- [ ] Update `reebe-server/src/main.rs` — wrap the existing pool in `SqlxBackend` before passing to `Engine::new()`

#### 1.4 Verify no regressions
- [ ] `cargo check --workspace` — all crates compile
- [ ] `cargo check --no-default-features --features embedded -p reebe-server` — embedded still compiles
- [ ] Run existing tests: `cargo test --workspace`

---

## Phase 2 — InMemoryBackend

**Goal:** A complete in-memory implementation of `StateBackend` with no SQL, no filesystem, and no async I/O. The engine can run end-to-end without any database.

### Action items

#### 2.1 Create `reebe-db/src/memory_backend.rs`
- [ ] `InMemoryBackend` struct with `Arc<Mutex<InMemoryStore>>`
- [ ] `InMemoryStore` contains:
  - `BTreeMap<i64, ProcessInstance>` keyed by key
  - `BTreeMap<i64, ElementInstance>` keyed by key
  - `BTreeMap<i64, Job>` keyed by key
  - `BTreeMap<i64, Variable>` keyed by (scope_key, name)
  - `BTreeMap<i64, Incident>` keyed by key
  - `BTreeMap<i64, Timer>` keyed by key
  - `BTreeMap<i64, Deployment>` keyed by key
  - `BTreeMap<i64, UserTask>` keyed by key
  - `Vec<DbRecord>` for the event log (append-only)
  - `u64` next_key counter
  - `u64` next_position counter
- [ ] Implement all `StateBackend` methods using in-memory operations
- [ ] Gate behind `#[cfg(feature = "memory")]` in `reebe-db`
- [ ] Add `memory` feature to `reebe-db/Cargo.toml`

#### 2.2 Add query methods needed for the playground
Beyond `StateBackend` (which mirrors the server's write path), add read methods for the snapshot API:
- [ ] `list_process_instances() -> Vec<ProcessInstance>`
- [ ] `list_element_instances(process_instance_key: i64) -> Vec<ElementInstance>`
- [ ] `list_jobs() -> Vec<Job>`
- [ ] `list_variables(scope_key: i64) -> Vec<Variable>`
- [ ] `list_incidents() -> Vec<Incident>`
- [ ] `list_records() -> Vec<DbRecord>` (event log)
- [ ] `list_active_timers() -> Vec<Timer>`

#### 2.3 Integration test: engine with `InMemoryBackend`
- [ ] Create `reebe-engine/tests/memory_engine.rs`
- [ ] Test: deploy a start→end BPMN, create instance, verify it completes
- [ ] Test: deploy a process with a service task, create instance, activate job, complete job, verify completion
- [ ] Test: deploy a process with an exclusive gateway, verify correct path taken
- [ ] Test: deploy a process with a parallel gateway, verify both paths execute and join
- [ ] Test: deploy a process with a timer, advance virtual clock, verify timer fires
- [ ] All tests use `InMemoryBackend` — no DB required

---

## Phase 3 — Clock abstraction

**Goal:** Make all time-dependent behavior injectable so the playground can simulate time freely.

### Action items

#### 3.1 Define `Clock` trait in `reebe-engine`
- [ ] Create `reebe-engine/src/clock.rs`
- [ ] Define `trait Clock: Send + Sync { fn now(&self) -> DateTime<Utc>; }`
- [ ] Implement `RealClock` (delegates to `Utc::now()`)
- [ ] Implement `VirtualClock { current: Arc<Mutex<DateTime<Utc>>> }` with `fn advance(&self, duration: Duration)` and `fn set(&self, t: DateTime<Utc>)`

#### 3.2 Thread `Arc<dyn Clock>` through `EngineState`
- [ ] Add `pub clock: Arc<dyn Clock>` to `EngineState`
- [ ] Update `Engine::new()` to accept `Arc<dyn Clock>` (default: `Arc::new(RealClock)`)
- [ ] Update server `main.rs` to pass `Arc::new(RealClock)`

#### 3.3 Replace `Utc::now()` call sites in processors
- [ ] Audit all `Utc::now()` usages across `reebe-engine/src/processor/` (expect ~15–20 sites)
- [ ] Replace each with `state.clock.now()`
- [ ] Replace `Utc::now()` in `engine.rs` (`write_command_to_db`, `commit_results`) with `self.state.clock.now()`
- [ ] Replace `Utc::now()` in scheduler with clock injection

#### 3.4 Verify no regressions
- [ ] `cargo test --workspace` — all tests pass (RealClock is the default)
- [ ] Extend Phase 2 timer test to use `VirtualClock` — verify timer fires after `advance()`

---

## Phase 4 — `reebe-wasm` crate

**Goal:** A self-contained Rust crate that compiles to `wasm32-unknown-unknown` and exposes a clean JS API for the playground.

### Action items

#### 4.1 Create the crate
- [ ] `crates/reebe-wasm/Cargo.toml`:
  - Dependencies: `reebe-bpmn`, `reebe-feel`, `reebe-dmn`, `reebe-protocol`, `reebe-db/memory`, `reebe-engine`
  - No `sqlx`, no `tokio` (beyond `sync`), no `axum`, no `tonic`
  - Add `wasm-bindgen`, `wasm-bindgen-futures`, `serde-wasm-bindgen`, `js-sys`, `gloo-timers`
  - `[lib] crate-type = ["cdylib"]`
- [ ] Add to workspace `Cargo.toml` members

#### 4.2 `WasmEngine` struct
- [ ] Create `reebe-wasm/src/engine.rs`
- [ ] `WasmEngine` wraps `Arc<InMemoryBackend>` + `Arc<VirtualClock>` + engine processor chain
- [ ] `#[wasm_bindgen]` on `WasmEngine`

#### 4.3 Process deployment API
- [ ] `#[wasm_bindgen] fn deploy(&mut self, bpmn_xml: &str) -> Result<JsValue, JsValue>`
  - Returns `{ processDefinitionKey, bpmnProcessId, version, resourceName }`
- [ ] `#[wasm_bindgen] fn list_deployments(&self) -> JsValue`

#### 4.4 Process instance API
- [ ] `#[wasm_bindgen] fn create_process_instance(&mut self, bpmn_process_id: &str, variables_json: &str) -> Result<JsValue, JsValue>`
  - Submits `CREATE_PROCESS_INSTANCE`, drains engine until idle, returns `{ key, bpmnProcessId, state }`
- [ ] `#[wasm_bindgen] fn cancel_process_instance(&mut self, key: i64) -> Result<(), JsValue>`
- [ ] `#[wasm_bindgen] fn list_process_instances(&self) -> JsValue`

#### 4.5 Job worker API
- [ ] `#[wasm_bindgen] fn get_activatable_jobs(&self, job_type: &str) -> JsValue`
  - Returns `[{ key, jobType, processInstanceKey, elementId, retries, variables }]`
- [ ] `#[wasm_bindgen] fn activate_job(&mut self, key: i64, worker: &str, timeout_ms: i64) -> Result<JsValue, JsValue>`
- [ ] `#[wasm_bindgen] fn complete_job(&mut self, key: i64, variables_json: &str) -> Result<(), JsValue>`
- [ ] `#[wasm_bindgen] fn fail_job(&mut self, key: i64, retries: i32, error_message: &str, backoff_ms: i64) -> Result<(), JsValue>`
- [ ] `#[wasm_bindgen] fn throw_error(&mut self, key: i64, error_code: &str, error_message: &str) -> Result<(), JsValue>`

#### 4.6 Message and signal API
- [ ] `#[wasm_bindgen] fn publish_message(&mut self, name: &str, correlation_key: &str, variables_json: &str) -> Result<(), JsValue>`
- [ ] `#[wasm_bindgen] fn broadcast_signal(&mut self, signal_name: &str, variables_json: &str) -> Result<(), JsValue>`

#### 4.7 Variable API
- [ ] `#[wasm_bindgen] fn get_variables(&self, scope_key: i64) -> JsValue`
- [ ] `#[wasm_bindgen] fn set_variables(&mut self, scope_key: i64, variables_json: &str) -> Result<(), JsValue>`

#### 4.8 Incident API
- [ ] `#[wasm_bindgen] fn list_incidents(&self) -> JsValue`
- [ ] `#[wasm_bindgen] fn resolve_incident(&mut self, key: i64) -> Result<(), JsValue>`

#### 4.9 Virtual time API
- [ ] `#[wasm_bindgen] fn get_virtual_time(&self) -> String` (ISO 8601)
- [ ] `#[wasm_bindgen] fn set_virtual_time(&mut self, iso_datetime: &str) -> Result<(), JsValue>`
- [ ] `#[wasm_bindgen] fn advance_clock(&mut self, milliseconds: f64) -> Result<(), JsValue>`
  - After advancing, drains engine (processes any newly due timers)

#### 4.10 Snapshot API
- [ ] `#[wasm_bindgen] fn snapshot(&self) -> JsValue`
  - Returns full engine state: process instances, element instances (with `state` field for active/completing/completed), jobs, variables, incidents, timers, event log
- [ ] `#[wasm_bindgen] fn event_log(&self) -> JsValue`
  - Returns the full `Vec<DbRecord>` as JSON array (partition_records equivalent)

#### 4.11 State export/import
- [ ] `#[wasm_bindgen] fn export_state(&self) -> String` (JSON string)
- [ ] `#[wasm_bindgen] fn import_state(&mut self, json: &str) -> Result<(), JsValue>`
  - Allows users to save and restore playground sessions

#### 4.12 Build and test
- [ ] `wasm-pack build crates/reebe-wasm --target web`
- [ ] Add `just build-wasm` to justfile
- [ ] Write Rust unit tests in `reebe-wasm/tests/` (run with `--target wasm32-unknown-unknown` via `wasm-pack test`)
- [ ] Test: full start→end process from JS API
- [ ] Test: process with service task (job activate + complete from JS)
- [ ] Test: process with timer (advance_clock from JS)
- [ ] Verify TypeScript definitions in generated `.d.ts`

---

## Phase 5 — JS playground UI

**Goal:** A functional browser playground that a developer can open and immediately start running BPMN processes.

### Action items

#### 5.1 Technology choices
- [ ] Decide: vanilla JS, React, Svelte, or Vue? (Recommendation: **Svelte** — minimal bundle, excellent WASM interop)
- [ ] Decide: BPMN renderer — **bpmn-js** (Camunda's open-source library) is the natural choice; it renders BPMN diagrams and can highlight elements
- [ ] Decide: hosting — static site (GitHub Pages or Vercel)
- [ ] Create `playground/` directory at workspace root

#### 5.2 WASM integration
- [ ] Wire `reebe-wasm` package into the JS build (Vite or Rollup with WASM plugin)
- [ ] Implement `EngineService` singleton that loads and wraps the WASM module
- [ ] Handle WASM initialization (async `init()`) before any engine calls
- [ ] Error boundaries for WASM panics (map to user-visible messages)

#### 5.3 BPMN editor / viewer panel
- [ ] Integrate `bpmn-js` for diagram display
- [ ] Support drag-and-drop upload of `.bpmn` files
- [ ] Include a library of built-in example processes:
  - `hello-world.bpmn` — start → end
  - `service-task.bpmn` — start → service task → end
  - `exclusive-gateway.bpmn` — start → XOR gateway → two paths → end
  - `parallel-gateway.bpmn` — start → parallel split → two tasks → join → end
  - `timer-event.bpmn` — start → timer intermediate catch event → end
  - `error-boundary.bpmn` — service task with error boundary event
  - `message-event.bpmn` — wait for message correlation
- [ ] Highlight active elements (read `elementInstances` from snapshot, apply CSS class to bpmn-js shapes)
- [ ] Show token counts on elements (for parallel gateway progress)

#### 5.4 Control panel
- [ ] "Create Instance" button with optional variables JSON editor (Monaco or CodeMirror)
- [ ] Active process instances list (click to select / inspect)
- [ ] "Cancel Instance" button for selected instance

#### 5.5 Job worker panel
- [ ] Show pending jobs filtered by type
- [ ] Per-job: "Activate" → "Complete" / "Fail" / "Throw Error" workflow
- [ ] Variables editor for job output
- [ ] Auto-worker mode: checkbox to automatically complete all jobs of a given type

#### 5.6 Timer panel
- [ ] Display virtual clock (large readable time)
- [ ] "Advance by" input: seconds / minutes / hours / days
- [ ] "Jump to" — set specific datetime
- [ ] Show all pending timers with due dates and associated element IDs

#### 5.7 Variables inspector
- [ ] Show variable scopes (process instance scope, element instance scope)
- [ ] Expandable JSON tree view
- [ ] Allow editing variables in-place (calls `set_variables`)

#### 5.8 Event log panel
- [ ] Display `partition_records` as a table: position, record_type, value_type, intent, key, payload
- [ ] Filterable by record_type (COMMAND / EVENT), value_type, intent
- [ ] Click a record to expand the full payload JSON
- [ ] Useful for developers learning the Zeebe event-sourcing model

#### 5.9 Incident panel
- [ ] Show active incidents with element ID, error code, and message
- [ ] "Resolve" button (triggers `resolve_incident`)

#### 5.10 State persistence
- [ ] "Export state" button → downloads `reebe-state.json`
- [ ] "Import state" button → restores a previous session
- [ ] Auto-save to `localStorage` (serialized engine state) on each action

---

## Phase 6 — Polish & publish

**Goal:** Clean, documented, shareable playground that represents the project well.

### Action items

#### 6.1 NPM package
- [ ] Publish `@reebe/engine-wasm` to NPM (or GitHub Packages)
- [ ] Include TypeScript types (generated by `wasm-pack`)
- [ ] `README.md` with JS API reference for the NPM package
- [ ] Version aligned with `reebe-server` workspace version

#### 6.2 Justfile commands
- [ ] `just build-wasm` — builds `reebe-wasm` with `wasm-pack`
- [ ] `just build-wasm-bpmn` — builds `reebe-bpmn` WASM package
- [ ] `just build-wasm-feel` — builds `reebe-feel` WASM package
- [ ] `just playground` — builds WASM + starts the playground dev server
- [ ] `just playground-build` — production build of the playground (for deployment)

#### 6.3 CI/CD
- [ ] Add GitHub Actions workflow: build WASM packages on PR
- [ ] Add GitHub Actions workflow: deploy playground to GitHub Pages on merge to `main`
- [ ] Add `wasm32-unknown-unknown` target to CI matrix

#### 6.4 Documentation updates
- [ ] Update `README.md` — add playground link and "try it in your browser" section
- [ ] Add `docs/playground-user-guide.md` — how to use the playground
- [ ] Document the JS API in `docs/reebe-wasm-api.md`

#### 6.5 Example processes
- [ ] Ensure all 7 built-in example processes work end-to-end in the playground
- [ ] Add a more complex showcase process (e.g. order fulfillment with error handling and a timer)
- [ ] Write a short walkthrough for each example

---

## Dependency notes per phase

| Phase | New Rust deps | New JS deps |
|---|---|---|
| 0 | `wasm-bindgen` (optional, `reebe-bpmn` + `reebe-feel`) | `wasm-pack` |
| 1 | None | None |
| 2 | None | None |
| 3 | None | None |
| 4 | `wasm-bindgen`, `wasm-bindgen-futures`, `serde-wasm-bindgen`, `js-sys`, `gloo-timers` | `wasm-pack` |
| 5 | None | `bpmn-js`, `vite` (or Rollup), UI framework |
| 6 | None | None |

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `StateBackend` trait turns out too large / leaky | Medium | High | Define trait incrementally; start with only what processors actually call |
| Processors have hidden direct DB access not found in audit | Low | High | Full grep for `sqlx::query` in processor files before starting Phase 1 |
| `wasm-pack` output size too large for comfortable download | Low | Medium | Apply `wasm-opt -Oz` + Brotli; measure early in Phase 4 |
| `bpmn-js` license incompatible | Low | Medium | Check license (it's Apache 2.0 — same as Reebe); confirm no issue |
| `InMemoryBackend` diverges semantically from `SqlxBackend` | Medium | Medium | Shared integration test suite run against both backends |
| Timer semantics differ between server (wall clock) and WASM (virtual) | Medium | Low | Documented clearly; virtual clock is explicit opt-in |
| Browser SharedArrayBuffer restrictions block Web Worker approach | Low | Low | Fall back to main-thread execution; engine is fast enough for small processes |

---

## Success criteria

- [ ] A developer can open the playground URL (no install) and run a hello-world BPMN in under 30 seconds
- [ ] All 12 BPMN element types supported by `reebe-engine` work in the playground
- [ ] Job tasks, timer events, message events, signal events, and error boundary events all work interactively
- [ ] The virtual clock lets users simulate days of process execution in seconds
- [ ] The event log is visible and understandable (teaches the event-sourcing model)
- [ ] State can be exported and re-imported
- [ ] Existing `reebe-server` Postgres and SQLite builds have zero regressions
- [ ] WASM bundle is under 1 MB gzipped
