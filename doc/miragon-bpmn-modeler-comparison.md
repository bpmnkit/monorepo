# Miragon `bpmn-modeler` — analysis and what is worth adapting

Analysis of [github.com/Miragon/bpmn-modeler](https://github.com/Miragon/bpmn-modeler)
(Apache-2.0, commit as of 2026-09-09) against this workspace. Two questions:

1. What does it do, and which of its features are worth adapting here?
2. Does a BPMN Kit VS Code extension make sense?

Analysis only — no code changes.

---

## 1. What it is

**"BPMN, where your work already happens."** A family of BPMN/DMN/Camunda-Form editors
built around one shared modeler core and shipped into IDEs rather than a desktop app. The
thesis is that process diagrams are code: they live in the repo, get reviewed in pull
requests, and should be editable without leaving the editor that already has the repo open.

The flagship deliverable is a **VS Code extension**, published on the Marketplace as
`miragon-gmbh.vs-code-bpmn-modeler`. The same core is also wrapped by a Theia/Electron
desktop shell and a JetBrains plugin.

### Architecture

A Yarn 4 workspace monorepo (`apps/*`, `libs/*`, `packages/*`, `docs`), orchestrated with
`npm-run-all` — TypeScript, Vitest, ESLint + Prettier, `knip` for dead-code detection,
release-please for versioning.

| Layer | Contents |
|---|---|
| **Hosts** | `apps/vscode-plugin` (published), `apps/standalone` (Theia/Electron, build-from-source), `apps/intellij-plugin` (Gradle + `apps/modeler-bridge`), `apps/demo-webapp` |
| **Webviews** | `apps/bpmn-webview`, `apps/dmn-webview`, `apps/form-webview`, `apps/deployment-webview` |
| **Published libs** | `packages/bpmn-modeler`, `packages/dmn-modeler` |
| **Feature libs (14)** | `modeler-core`, `shared`, `modeler-types`, `bpmn-diff`, `properties-panel`, `append-menu`, `element-template-chooser`, `code-link`, `model-navigation`, `flow-navigation`, `inline-scripting`, `bpmn-clipboard`, `bpmn-i18n-extras`, `standalone-extension` |

The decisive architectural difference: **it is a bpmn.io integration, not a rendering
engine**. `bpmn-js`, `dmn-js`, `form-js`, `bpmn-moddle`, `camunda-bpmn-moddle`, `bpmnlint`,
`bpmn-js-differ` and `@bpmn-io/properties-panel` do the modeling; Miragon's own code is the
*host integration* — the message protocol between an extension host and a sandboxed webview,
workspace-driven resolution, and UI that bpmn.io does not ship.

That is the mirror image of BPMN Kit, which reimplements the whole stack (parser, layout,
canvas, editor, FEEL, engine) with zero runtime dependencies and no bpmn.io anywhere.
Neither repo can lift code from the other; the value here is in **which problems they found
worth solving**, not in the implementations.

### Feature inventory

Measured from `apps/vscode-plugin/package.json`: **3 custom editors** (`.bpmn`, `.dmn`,
`.form`), **1 webview view** (deployment sidebar), **23 commands**, **12 settings**.

- **Full BPMN 2.0 + DMN** for Camunda 7 *and* 8 plus forks (Operaton, CIB7), engine-aware
  properties with no profile-switching ceremony.
- **Camunda Form editing** — visual `.form` editor with an Edit/Preview toggle, plus
  ephemeral `*.input.json` / `*.output.json` companion tabs (virtual filesystem, never
  written to disk) for testing what the form consumes and submits.
- **Element templates by convention** — dropped in `.camunda/element-templates/`, discovered
  by walking up from the BPMN file to the workspace root. No project config.
- **Template marketplace** — register a GitHub/GitLab repo or local folder holding a
  `marketplace.json`; templates are fetched, validated, cached and merged with
  workspace-local ones. Per-workspace or per-user scope, tokens in secret storage.
- **Editor modes (View / Design / Implement)** — one file, three surfaces: read-only viewer,
  engine-neutral shape modeling, or the full Camunda properties panel. *Implement* is greyed
  out on a model with no execution platform, and opening such a model never stamps one on.
  Mode is remembered per editor.
- **Visual BPMN diff** — overrides VS Code's text diff for `.bpmn`, rendering two read-only
  canvases with element-level markers (added / removed / changed / moved) and synchronised
  pan/zoom. Works from Source Control *and* from an Explorer two-file compare.
- **Linting** — bpmnlint in the extension host (a real Node context, so workspace
  `bpmnlint-plugin-*` packages and `plugin:*` configs resolve exactly like the CLI).
  Findings appear as canvas overlays, a status-bar badge, *and* Problems-panel entries.
  Zero-config default when no `.bpmnlintrc` exists: `bpmnlint:recommended` plus the
  `bpmnlint-plugin-camunda-compat` layer matching the diagram's detected engine.
- **Deployment sidebar** — deploy to C7 or C8 (no auth / Basic / OAuth2 client credentials)
  and start an instance with payloads discovered from `.camunda/payloads/`.
- **Code link** — "Go to implementation" on the context pad, jumping from a service/send/
  business-rule task to the workspace file implementing it. The entry *hides itself* when
  the implementation does not exist: the webview ships cheap `(activityId, kind, reference)`
  tuples to the host on import and after debounced edits, and the host pushes back a
  resolved-or-not map. The host never parses BPMN XML.
- **Model navigation** — jump from a Call Activity to the referenced process, a Business Rule
  Task to its DMN, a C8 User Task to the `.form` whose `id` matches its `formId`.
- **Flow navigation** — Tab / Shift+Tab traverse sequence flows, Tab cycles the outgoing
  flows at a fan-out, Enter follows, `u` drills out of a subprocess, `g` jumps to a link.
- **Inline scripting** (C7) — edit a script task's inline script in a *real editor tab*
  instead of the properties-panel textarea, with a single-writer lock that renders the panel
  field read-only while a tab owns it, and a divergence watch for undo/redo underneath.
- **Append menu** — replaces the flat bpmn-js append dropdown with a two-panel overlay:
  searchable element templates with detail cards on the left, category-grouped BPMN elements
  with pinned favourites on the right. It *decorates* `popupMenu.open()` and runs the
  original entry action, so presentation changes and dispatch does not.
- **9-locale UI** with a runtime-harvested translation overlay: a browser driver records
  every string the running modeler passes to `translate()`, and only keys the shared library
  lacks *and* the harvest actually observed survive into the overlay.
- **Clipboard bridge** — native browser clipboard by default; one override routes copy/paste
  through the host when the webview is sandboxed (VS Code, IntelliJ, Theia).

### What is notably good about how it is built

- **29 ADRs** in `docs/adr/` recording the architecture decisions, including the ones a
  reader would otherwise re-litigate (why the modeler core was extracted, why the properties
  panel is engine-neutral, why theming is container-scoped, why modes are a subpath).
- **A port pattern that keeps host APIs out of the libs.** `CodeLinkPort`,
  `ModelNavigationPort`, `InlineScriptingPort`, `ClipboardBridge` — every lib is a bpmn-js
  module that talks over the event bus and calls an injected port. None of them import
  `vscode`. That is exactly why the same libs serve VS Code, Theia *and* IntelliJ.
- **Optimistic-then-corrected availability.** Link actions show immediately and hide once the
  host says the target does not resolve, so there is no flash and no blocking round trip.
- Each lib's README explains *why it is a separate package*, including the deliberately
  opinionated choices (context-pad placement, JSX pragma isolation) so a later reader does
  not undo them.

---

## 2. What is worth adapting here

BPMN Kit is broader (CLI, engine, FEEL, layout, connectors, AI, Operate, desktop, Drop) and
Miragon is deeper on *IDE-resident modeling ergonomics*. The gaps below are ranked by value
per unit of work. Nothing here requires taking a bpmn.io dependency — each is a
reimplementation against `@bpmnkit/core` and the canvas plugin API.

### Tier 1 — clear wins, small-to-medium effort

**A. Element templates by convention.** `@bpmnkit/connectors` already understands the Zeebe
element-template JSON schema (`packages/connectors/src/template-types.ts`, `apply.ts`), but
templates only ever come from the *generated built-in catalogue*
(`packages/connectors/src/templates/generated.ts`). There is no path for a user's own
templates. Discovering `.camunda/element-templates/*.json` — walking up from the file to the
project root — would make the `connector-catalog` plugin work with in-house connectors, which
is the single most common real-world Camunda 8 need it currently cannot serve. Small change,
large surface-area gain. The `casen` CLI can validate them against the same schema.

**B. Visual BPMN diff.** Nothing in this repo renders a diagram diff, yet the pieces are all
present: `packages/core/src/bpmn/semantic-hash.ts` for element-level change detection, and
`@bpmnkit/canvas` for two synchronised read-only viewers. A `diff` canvas plugin plus
`casen bpmn diff a.bpmn b.bpmn` would serve the repo's own review workflow, the Drop viewer,
the studio, *and* be the headline feature of a VS Code extension if one is built. This is the
highest-leverage single item on the list.

**C. Editor modes (View / Design / Implement).** The rule that matters is not the three-way
switch, it is the invariant: *opening an engine-neutral model never stamps an execution
platform on it.* Anyone using BPMN Kit to open a diagram authored elsewhere is exposed to
silent contamination today. Worth adopting as a policy in `@bpmnkit/editor` even without the
mode strip UI.

**D. Keyboard flow navigation.** Tab / Shift+Tab along sequence flows, fan-out cycling, Enter
to follow, drill in and out of subprocesses. A self-contained canvas plugin with no host
dependency, and a genuine accessibility win — `@bpmnkit/canvas` already advertises keyboard
navigation and ARIA, so this extends an existing commitment rather than starting one.

**E. Model navigation / go-to-reference.** Call Activity → process, Business Rule Task →
DMN, User Task → form. `apps/drop` already does exactly this *within a drop* (cross-file
navigation between tabs). Generalising it into a plugin with an injected resolver port —
Miragon's `ModelNavigationPort` shape is the right one — makes it work in the studio, the
desktop app and any future host.

### Tier 2 — worth doing, larger

**F. A lint story that is not only CLI-deep.** `casen lint` has categories (`deploy`,
`connector`, `feel`, `feel-syntax`, `agentic`) built on `packages/core/src/bpmn/optimize/`,
which is arguably a *better* rule set than bpmnlint's. But the findings never reach the
canvas. Miragon's shape — overlays on offending elements, a summary badge, and entries in the
host's problem list — is the right target, and here it needs no host at all for the first two.
Their zero-config default (lint sensibly with no config file present, switch the engine layer
from the diagram's detected platform) is a good default to copy.

**G. Deployment as an editor surface.** `casen deploy` and the `deploy` plugin exist; what is
missing is Miragon's convention layer — payload files discovered from `.camunda/payloads/`
so starting an instance with real test data is a two-click operation rather than a paste.

**H. UI localisation.** BPMN Kit has the hook (`@bpmnkit/editor`'s `Translate` /
`defaultTranslate`) and ships English only. Miragon covers 9 locales. Their *method* is the
adaptable part: harvest the strings the running editor actually requests, and treat any key
the harvest never observed as dead. That keeps a translation file honest, and it applies to
this repo's editor, studio and Operate alike.

**I. Richer template/append picker.** The two-panel searchable overlay with detail cards is a
real improvement over a flat list. Lower priority — `connector-catalog` already has a panel
with tabs — but the *detail card* (implementation binding + property preview before you
apply) is the part worth stealing.

### Explicitly not worth adapting

- **Anything Camunda 7.** Inline scripting, C7 properties, C7 deploy endpoints, transaction
  boundaries. BPMN Kit is a Camunda 8 toolkit and should stay one.
- **The clipboard bridge.** Only needed because bpmn-js assumes the system clipboard. Solve
  it if and when a sandboxed host exists.
- **The template marketplace.** Elegant, but it presumes an established base of shared
  template repositories. Ship (A) first; a marketplace on top of nothing is premature.
- **bpmn.io anything.** The zero-dependency posture is this repo's differentiator.

---

## 3. Does a VS Code extension make sense?

**Yes — and it is the most defensible new surface this repo could add. But it should be
scoped as a viewer-and-review extension first, not a modeler.**

### Why it fits

- **The distribution gap is real.** BPMN Kit reaches developers through npm and a Tauri
  desktop app. The Marketplace is where developers who edit `.bpmn` files in a repo actually
  look, and Miragon's install count demonstrates the demand exists.
- **The technical prerequisites are already met, which is unusual.** `@bpmnkit/canvas` is
  zero-dependency, framework-agnostic plain DOM, explicitly themeable via CSS custom
  properties with light/dark/auto — that is a webview-shaped component by construction.
  `apps/drop` already proves the stack bundles to browser ESM
  (`apps/drop/scripts/build-client.mjs`: esbuild, `format: "esm"`, `platform: "browser"`),
  and `apps/desktop` already proves editor + plugins compose into a host shell. A VS Code
  extension is a *third* host over the same two proofs, not new ground.
- **The parsing story is genuinely better than the incumbent's.** After #161, `@bpmnkit/core`
  round-trips with full fidelity and is descriptor-checked against the BPMN and Zeebe
  schemas — which is what an editor writing to a git-tracked file needs above all else.
- **Differentiation is available.** Miragon owns "the bpmn.io modeler, embedded". BPMN Kit
  could own things bpmn.io cannot do in an editor: in-canvas process simulation
  (`@bpmnkit/engine`), the FEEL playground, the AI bridge, ASCII rendering of a diagram into
  a code review, the optimizer's findings, and `casen` deployment. None of that exists in the
  Marketplace today.

### Why to scope it down

- **Marketplace extensions are a support commitment**, not a build artifact. VS Code's API
  moves (Miragon's diff docs already carry a "since VS Code 1.129" caveat), and issues arrive
  from users who did not read the pre-1.0 badge.
- **Beating a mature bpmn-js modeler on modeling ergonomics is a multi-quarter project.**
  Miragon has 14 feature libs and 29 ADRs of accumulated decisions. Shipping a weaker second
  modeler helps nobody.
- **The custom-editor document protocol is the real work.** Dirty state, undo/undo-through-
  external-edit, backup and hot exit, conflicting edits from the text editor, `.bpmn` files
  in diff editors — this is the part that looks trivial and is not, and it is precisely what
  `apps/desktop` and `apps/drop` do *not* already solve.

### Recommended shape

**Phase 1 — `bpmnkit` extension, read and review only.**
`.bpmn`/`.dmn`/`.form` custom read-only editors backed by `@bpmnkit/canvas` and the
`dmn-viewer` / `form-viewer` plugins, plus minimap and zoom. Add the visual diff for `.bpmn`
in the Source Control panel (item B above) — that alone justifies the install for a team
reviewing process changes in pull requests, and read-only sidesteps the entire document
protocol. Surface `casen lint` findings in the Problems panel from the extension host, where
Node is available and `@bpmnkit/core` runs unchanged.

**Phase 2 — the things only this stack can do.** Step-through simulation of the open diagram
with `@bpmnkit/engine` and token highlighting; deploy/start against a `casen` profile; the
FEEL playground as a webview panel.

**Phase 3 — editing.** Only after Tier-1 items C, D and E have landed in `@bpmnkit/editor`,
and only with the document protocol treated as its own piece of work.

If a fourth host is going to exist, adopt Miragon's port pattern *now*, before writing it:
keep every feature as a canvas/editor plugin talking to an injected port, so the extension
contributes host wiring and nothing else. That is what let one codebase serve VS Code, Theia
and IntelliJ, and this repo already has three hosts (studio, desktop, drop) that would
benefit from the same discipline.

### Effort estimate

Phase 1 is on the order of a two-to-three-week build for one person: the extension host
scaffold, a webview message protocol, three read-only editors, the diff view, and the
Problems-panel integration — *assuming* item B (diff) lands in `@bpmnkit/canvas` first as a
plugin usable from the studio and Drop too. That ordering matters: the diff is worth building
whether or not the extension ever ships.
