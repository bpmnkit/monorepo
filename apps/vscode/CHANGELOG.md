# Changelog

## 0.5.0

### Minor Changes

- 56ad670: A team's `.bpmnlintrc` is honoured. `casen lint` and the VS Code Problems panel use the nearest `.bpmnlintrc`, starting in the diagram's folder. They apply its rule levels, including `off`, to BPMN Kit's equivalent findings. When the project has `bpmnlint` and `bpmn-moddle` installed, they run the project's own bpmnlint instead, so `bpmnlint-plugin-*` rules work too. BPMN Kit does not show its own finding a second time for any rule that bpmnlint ran.

  `@bpmnkit/core` adds `parseBpmnlintConfig`, `resolveBpmnlintConfig`, `applyBpmnlintConfig`, `normalizeBpmnlintRuleName`, `bpmnlintRuleForFinding` and `BPMNLINT_RULE_MAP`, all pure and dependency-free. `lintDiagram` accepts `bpmnlint` and `bpmnlintDelegated`. `LintDiagnostic` and `OptimizationFinding` gain an optional `bpmnlintRule` field, and `LintReport` gains an optional `bpmnlintUnsupported` field. `@bpmnkit/core/node` adds `findBpmnlintrc`, `readBpmnlintrc`, `runBpmnlint` and `prepareBpmnlint`. bpmnlint is loaded with a dynamic `import()` from the project and is never a dependency.

  All 28 bpmnlint built-in rules are mapped. 19 of them are new native checks, which run only when a `.bpmnlintrc` enables them, so the default report is unchanged. Rules that cannot be applied (plugin rules, unknown rules, `plugin:` configs without bpmnlint installed) are reported, not ignored.

  `casen lint` gains `--no-bpmnlintrc` and prints the rule name for each governed finding. The VS Code extension gains the `bpmnkit.lint.bpmnlintrc` setting.

- 56ad670: Lint now checks a diagram against the Camunda 8 version it targets, as Camunda Modeler does with `@camunda/linting`. Its findings (`compat/…`, in the existing `deploy` category) read `modeler:executionPlatformVersion` and report two kinds of problem. The first is a construct the target version cannot run, for example `Ad-hoc sub-process "Tools" needs Camunda 8.7 or newer; this model targets Camunda 8.6.` The second is a property the target version requires, such as a timer value that does not parse or an error without an error code. The version table comes from `bpmnlint-plugin-camunda-compat` 2.61.0: 62 of its 65 rules are reproduced, and the other 3 are covered by existing findings. A problem that a `deploy/*` check already reports on the same element is not repeated. The check runs with the `deploy` category in `optimize()`, `lintDiagram()`, `casen lint`, the editor's lint panel and the VS Code Problems panel. A model with no Camunda 8 version gets no `compat` findings.

  A `.bpmnlintrc` that extends `plugin:camunda-compat/camunda-cloud-X-Y` now runs this check against version X.Y and is no longer reported as "not applied". `camunda-compat/<rule>` entries re-level or turn off its findings. When the project's own bpmnlint runs the plugin, BPMN Kit's findings step aside.

  `@bpmnkit/core` adds `analyzeCamundaCompat`, `splitCamundaCompatConfig`, `applyCamundaCompatConfig`, `normalizeCamundaVersion`, `CAMUNDA_COMPAT_RULES`, `CAMUNDA_COMPAT_VERSIONS` and `CAMUNDA_COMPAT_PLUGIN_VERSION`. `isCamundaCompatFinding` tells these findings apart. `OptimizeOptions` gains `camundaVersion`; `OptimizationCategory` is unchanged, since widening a union the API returns would be a major change.

- 56ad670: Element templates now resolve per diagram, the way Camunda Desktop Modeler does: a diagram sees the `.camunda/element-templates/` folders from its own folder up to the project root, the nearest winning, and never a sibling folder's.
  - `@bpmnkit/plugins`: `createConnectorCatalogPlugin` takes a `diagramPath` option and gains `setDiagramPath(path)` and `setWorkspaceTemplates(templates)`. Switching diagrams unregisters the previous diagram's templates first, and the plugin's workspace templates are also unregistered on uninstall. `createConfigPanelBpmnPlugin` gains `unregisterTemplate(id)`, which brings back a bundled template the removed one shadowed. `TemplateRegistrar` gains an optional `unregisterTemplate`. Registering a template whose id is already in the connector picker now updates its label.
  - `@bpmnkit/proxy`: `GET /element-templates?root=<dir>&file=<path>` returns only the templates that apply to that diagram. `file` must lie inside `root`, and `configFolder` must be a single folder name. `?root=` alone is unchanged.
  - `@bpmnkit/cli`: `casen lint` and the `casen dev` checks check a connector task's required inputs against the diagram's own templates as well as the bundled catalogue. The search stops at the current directory for `casen lint` and at the served folder for `casen dev`.
  - VS Code: the Problems panel checks connector inputs against the file's own templates too, with the workspace folder as the root.

### Patch Changes

- 56ad670: Descriptions and READMEs now say what each package does, with the numbers that back it.
  - `@bpmnkit/feel` states its conformance — 1,939 of the DMN TCK's 2,053 FEEL cases (94.4%) —
    instead of calling itself complete.
  - `@bpmnkit/engine` is described as a simulator for tests and demos, and its README lists the
    elements it executes and the ones it completes without their semantics.
  - `@bpmnkit/plugins` counts its 34 plugins and documents the seven the README left out.
  - `@bpmnkit/cli` declares `mcpName`, so `casen proxy mcp` can be listed in the MCP Registry.
  - `@bpmnkit/astro-shared`'s `Seo` component loads Cloudflare Web Analytics when a build sets
    `PUBLIC_CF_WEB_ANALYTICS_TOKEN`, and nothing otherwise.
  - The desktop app is named BPMN Kit, ships icons for every platform, finds its bundled AI
    server on Windows, and builds again: the proxy-rs build script still filtered on the
    pre-rename `@bpmn-sdk/proxy` package. Installers are attached to GitHub Releases.
  - The VS Code extension is packaged on every release and attached to GitHub Releases, and
    published to the Visual Studio Marketplace and Open VSX once their tokens are configured.

- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
  - @bpmnkit/core@1.1.0
  - @bpmnkit/editor@1.1.0
  - @bpmnkit/plugins@1.1.0
  - @bpmnkit/ui@0.3.1
  - @bpmnkit/engine@1.1.0
  - @bpmnkit/connectors@1.1.0
  - @bpmnkit/canvas@1.0.1
  - @bpmnkit/ascii@1.0.1
  - @bpmnkit/profiles@0.0.21

## 0.4.11

### Patch Changes

- Updated dependencies [d910fae]
- Updated dependencies [0ba6ef6]
- Updated dependencies [d910fae]
- Updated dependencies [d910fae]
- Updated dependencies [0ba6ef6]
  - @bpmnkit/plugins@1.0.0
  - @bpmnkit/canvas@1.0.0
  - @bpmnkit/editor@1.0.0
  - @bpmnkit/engine@1.0.0
  - @bpmnkit/ascii@1.0.0
  - @bpmnkit/core@1.0.0
  - @bpmnkit/profiles@0.0.20

## 0.4.10

### Patch Changes

- Updated dependencies [191d4d2]
- Updated dependencies [f0a0ea2]
  - @bpmnkit/core@0.8.0
  - @bpmnkit/ui@0.3.0
  - @bpmnkit/plugins@0.4.0
  - @bpmnkit/canvas@0.2.5
  - @bpmnkit/ascii@0.0.38
  - @bpmnkit/editor@0.2.5
  - @bpmnkit/engine@0.1.38

## 0.4.9

### Patch Changes

- Updated dependencies [c8ceaaa]
  - @bpmnkit/core@0.7.1
  - @bpmnkit/engine@0.1.37
  - @bpmnkit/plugins@0.3.5
  - @bpmnkit/ascii@0.0.37
  - @bpmnkit/canvas@0.2.4
  - @bpmnkit/editor@0.2.4

## 0.4.8

### Patch Changes

- Updated dependencies [e096585]
  - @bpmnkit/core@0.7.0
  - @bpmnkit/ascii@0.0.36
  - @bpmnkit/canvas@0.2.3
  - @bpmnkit/editor@0.2.3
  - @bpmnkit/engine@0.1.36
  - @bpmnkit/plugins@0.3.4

## 0.4.7

### Patch Changes

- Updated dependencies [780e39d]
  - @bpmnkit/core@0.6.0
  - @bpmnkit/ascii@0.0.35
  - @bpmnkit/canvas@0.2.2
  - @bpmnkit/editor@0.2.2
  - @bpmnkit/engine@0.1.35
  - @bpmnkit/plugins@0.3.3

## 0.4.6

### Patch Changes

- Updated dependencies [53a9e25]
- Updated dependencies [9d412da]
- Updated dependencies [2cdc7f9]
- Updated dependencies [9d412da]
  - @bpmnkit/core@0.5.0
  - @bpmnkit/ui@0.2.0
  - @bpmnkit/ascii@0.0.34
  - @bpmnkit/canvas@0.2.1
  - @bpmnkit/editor@0.2.1
  - @bpmnkit/engine@0.1.34
  - @bpmnkit/plugins@0.3.2
  - @bpmnkit/profiles@0.0.19

## 0.4.5

### Patch Changes

- Updated dependencies [8fdc6d4]
- Updated dependencies [e4c16a9]
- Updated dependencies [e4c16a9]
- Updated dependencies [e4c16a9]
- Updated dependencies [e4c16a9]
  - @bpmnkit/core@0.4.0
  - @bpmnkit/canvas@0.2.0
  - @bpmnkit/editor@0.2.0
  - @bpmnkit/ascii@0.0.33
  - @bpmnkit/engine@0.1.33
  - @bpmnkit/plugins@0.3.1

## 0.4.4

### Patch Changes

- Updated dependencies [dc33af9]
- Updated dependencies [dc33af9]
- Updated dependencies [dc33af9]
  - @bpmnkit/editor@0.1.0
  - @bpmnkit/plugins@0.3.0
  - @bpmnkit/ui@0.1.0

## 0.4.3

### Patch Changes

- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
  - @bpmnkit/core@0.3.0
  - @bpmnkit/canvas@0.1.0
  - @bpmnkit/plugins@0.2.0
  - @bpmnkit/ascii@0.0.32
  - @bpmnkit/editor@0.0.35
  - @bpmnkit/engine@0.1.32

## 0.4.2

- **Saving a `.dmn` really does preserve the file now.** It was claimed in 0.4.0 and did not
  hold: a decision with a diagram section came back with its whole `dmndi` block rewritten,
  and a table with hit policy `UNIQUE` lost everything the write was keeping. Opening a
  decision and saving it unchanged now leaves the file byte for byte, and editing one rule
  changes two lines.

## 0.4.1

- **Form files preserve their formatting too.** Saving a `.form` now keeps its indentation,
  key order and trailing newline; relabelling one field changes one line, whether the file is
  indented with tabs, two spaces, four, or not at all. Completes what 0.4.0 did for `.bpmn`
  and `.dmn`.

## 0.4.0

- **Saving preserves the file.** Edits are written into the document that was already there
  rather than reformatting it to this toolkit's output: renaming a task changes one line,
  moving a box changes two numbers, and indentation, attribute order and comments survive.
  Opening a diagram and saving it unchanged leaves the file byte for byte. Applies to `.bpmn`
  and `.dmn`; form files are JSON and still reformat.

## 0.3.0

- **Editing.** `.bpmn`, `.dmn` and `.form` are now edited, not only read. The editors are
  **text** custom editors backed by the same `TextDocument` a text editor opens, so dirty
  state, save, hot exit, undo and a concurrent text editor are VS Code's rather than
  reimplemented — and typing in the XML updates the diagram as you go. Set
  `bpmnkit.editing.enabled` to `false` for the same editors with editing switched off.
- **Test data from the repository.** Deploy-and-start offers the payloads it finds in
  `.camunda/payloads/*.json`, walking up from the diagram the way element templates do.
- **Detail cards in the connector picker.** Selecting a template shows what it binds and
  what it will ask for — including which fields read like credentials — before it is
  applied. The card's own button still applies straight away.
- The command **Open Preview to the Side** is now **Open Diagram to the Side**; its id is
  unchanged, so any keybinding still works.

## 0.2.0

- **Step-through simulation.** The BPMN preview runs the diagram through
  `@bpmnkit/engine` with token highlighting: Run, One Step, Cancel, live variables and a
  replay timeline. Entirely local — nothing is deployed.
- **FEEL playground**, opened as its own panel and pre-filled from the editor selection.
- **Deploy to Camunda 8**, and deploy-and-start with variables, against the clusters
  `casen` already knows about. Credentials are read to sign the request and nothing else.
- **Copy Diagram as ASCII**, dedented and fenced for pasting into a code review.
- Fixed: the simulator no longer offers a Tests tab a host cannot serve, and the FEEL
  playground brings its own stylesheet (both fixed in `@bpmnkit/plugins`).

## 0.1.0

First release.

- Read-only custom editors for `.bpmn`, `.dmn` and `.form`, rendered by `@bpmnkit/canvas`
  with no bpmn.io dependency. Minimap and zoom controls for BPMN.
- The preview follows the open buffer as it is typed, and keeps the last drawing that
  parsed when the file is momentarily invalid.
- Visual BPMN diff against `HEAD` from the Source Control panel, and between any two
  selected `.bpmn` files from the Explorer. Added, removed, changed and moved elements are
  marked on synchronised canvases.
- Static analysis in the Problems panel, placed on the element that caused each finding.
  Camunda 8 deployability rules are applied only to diagrams that declare an execution
  platform, unless `bpmnkit.lint.forceEngineRules` says otherwise.
- Colours follow the active VS Code theme, and fall back to the BPMN Kit palette when a
  theme does not define one.
