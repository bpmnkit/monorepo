# @bpmnkit/cli

## 1.1.0

### Minor Changes

- 56ad670: A team's `.bpmnlintrc` is honoured. `casen lint` and the VS Code Problems panel use the nearest `.bpmnlintrc`, starting in the diagram's folder. They apply its rule levels, including `off`, to BPMN Kit's equivalent findings. When the project has `bpmnlint` and `bpmn-moddle` installed, they run the project's own bpmnlint instead, so `bpmnlint-plugin-*` rules work too. BPMN Kit does not show its own finding a second time for any rule that bpmnlint ran.

  `@bpmnkit/core` adds `parseBpmnlintConfig`, `resolveBpmnlintConfig`, `applyBpmnlintConfig`, `normalizeBpmnlintRuleName`, `bpmnlintRuleForFinding` and `BPMNLINT_RULE_MAP`, all pure and dependency-free. `lintDiagram` accepts `bpmnlint` and `bpmnlintDelegated`. `LintDiagnostic` and `OptimizationFinding` gain an optional `bpmnlintRule` field, and `LintReport` gains an optional `bpmnlintUnsupported` field. `@bpmnkit/core/node` adds `findBpmnlintrc`, `readBpmnlintrc`, `runBpmnlint` and `prepareBpmnlint`. bpmnlint is loaded with a dynamic `import()` from the project and is never a dependency.

  All 28 bpmnlint built-in rules are mapped. 19 of them are new native checks, which run only when a `.bpmnlintrc` enables them, so the default report is unchanged. Rules that cannot be applied (plugin rules, unknown rules, `plugin:` configs without bpmnlint installed) are reported, not ignored.

  `casen lint` gains `--no-bpmnlintrc` and prints the rule name for each governed finding. The VS Code extension gains the `bpmnkit.lint.bpmnlintrc` setting.

- 56ad670: Lint now checks a diagram against the Camunda 8 version it targets, as Camunda Modeler does with `@camunda/linting`. Its findings (`compat/…`, in the existing `deploy` category) read `modeler:executionPlatformVersion` and report two kinds of problem. The first is a construct the target version cannot run, for example `Ad-hoc sub-process "Tools" needs Camunda 8.7 or newer; this model targets Camunda 8.6.` The second is a property the target version requires, such as a timer value that does not parse or an error without an error code. The version table comes from `bpmnlint-plugin-camunda-compat` 2.61.0: 62 of its 65 rules are reproduced, and the other 3 are covered by existing findings. A problem that a `deploy/*` check already reports on the same element is not repeated. The check runs with the `deploy` category in `optimize()`, `lintDiagram()`, `casen lint`, the editor's lint panel and the VS Code Problems panel. A model with no Camunda 8 version gets no `compat` findings.

  A `.bpmnlintrc` that extends `plugin:camunda-compat/camunda-cloud-X-Y` now runs this check against version X.Y and is no longer reported as "not applied". `camunda-compat/<rule>` entries re-level or turn off its findings. When the project's own bpmnlint runs the plugin, BPMN Kit's findings step aside.

  `@bpmnkit/core` adds `analyzeCamundaCompat`, `splitCamundaCompatConfig`, `applyCamundaCompatConfig`, `normalizeCamundaVersion`, `CAMUNDA_COMPAT_RULES`, `CAMUNDA_COMPAT_VERSIONS` and `CAMUNDA_COMPAT_PLUGIN_VERSION`. `isCamundaCompatFinding` tells these findings apart. `OptimizeOptions` gains `camundaVersion`; `OptimizationCategory` is unchanged, since widening a union the API returns would be a major change.

- 56ad670: Camunda 7 → 8 model migration. `casen migrate c7 <files...>` converts Camunda 7 models to Camunda 8. It writes `<name>.c8.bpmn` beside each input, or writes into `--out <dir>`, and never overwrites a file without `--force`. It reports every Camunda 7 construct as `convertible`, `manual` or `unsupported`, with the Camunda 8 equivalent. `--check` writes nothing and exits 1 while manual or unsupported findings remain. `--format json` gives the report as JSON.

  `@bpmnkit/core` adds `convertCamunda7(definitions, { executionPlatformVersion? })`, `analyzeCamunda7` and `translateJuelToFeel`, all pure and dependency-free. They convert external tasks, IO mappings, conditions, timers, user-task assignment, schedule, priority and forms, decisions, call-activity variable passing, multi-instance collections, FEEL scripts, version tags and properties. Java delegates get a job type from a documented naming rule and keep the original as a task header. JUEL becomes FEEL only when the translation is provable; any other expression is kept and reported as manual.

- 56ad670: `casen dev [dir]` is a one-command local development loop. It needs no Docker, no cluster and no licence key. It finds every `.bpmn`, `.dmn` and `.form` file in the folder and serves a local web UI on `127.0.0.1` (port 4747 by default, `--port`). The UI opens each file in the BPMN Kit editor, with in-browser simulation on `@bpmnkit/engine` and the Tests tab bound to the `.bpmn.tests.json` sidecar. Saves are written back to disk into the existing file with its formatting kept, and each save is read back to check it. Changes made on disk reload the open diagram. Every change re-runs lint (the same analysis as `casen lint`, including a `.bpmnlintrc`) and the file's scenarios. Results show in the browser and as a compact status list in the terminal. `--engine wasm` runs the scenarios on reebe-wasm for Zeebe semantics. `--no-open` skips opening the browser. The UI is pre-bundled into the package's `dist`, so it adds no runtime dependencies.
- 56ad670: Element templates now resolve per diagram, the way Camunda Desktop Modeler does: a diagram sees the `.camunda/element-templates/` folders from its own folder up to the project root, the nearest winning, and never a sibling folder's.
  - `@bpmnkit/plugins`: `createConnectorCatalogPlugin` takes a `diagramPath` option and gains `setDiagramPath(path)` and `setWorkspaceTemplates(templates)`. Switching diagrams unregisters the previous diagram's templates first, and the plugin's workspace templates are also unregistered on uninstall. `createConfigPanelBpmnPlugin` gains `unregisterTemplate(id)`, which brings back a bundled template the removed one shadowed. `TemplateRegistrar` gains an optional `unregisterTemplate`. Registering a template whose id is already in the connector picker now updates its label.
  - `@bpmnkit/proxy`: `GET /element-templates?root=<dir>&file=<path>` returns only the templates that apply to that diagram. `file` must lie inside `root`, and `configFolder` must be a single folder name. `?root=` alone is unchanged.
  - `@bpmnkit/cli`: `casen lint` and the `casen dev` checks check a connector task's required inputs against the diagram's own templates as well as the bundled catalogue. The search stops at the current directory for `casen lint` and at the served folder for `casen dev`.
  - VS Code: the Problems panel checks connector inputs against the file's own templates too, with the workspace folder as the root.

- 56ad670: Process documentation export: a document to circulate, built from the model.

  `@bpmnkit/core` adds `renderDocumentationHtml`, `renderDocumentationMarkdown` and `renderDocumentationDocx`. They take parsed definitions plus optional DMN decisions and forms. The HTML is self-contained and print-ready: an inline SVG diagram on a landscape page, a table of contents, and a section per process or pool. Each section has its lanes, a steps table and a detail block for every element in flow order: type, documentation, lane, job type, headers, mappings, called decision, called process, form, assignment, timers, messages, errors and the conditions on outgoing flows. The decision tables and form fields follow. Print → Save as PDF gives a clean PDF on A4 or Letter. Markdown has the same content without the diagram. The Word file is a small hand-written OOXML package with the diagram as SVG. `buildProcessDocumentation` returns the structured content, and `documentationToHtml`, `documentationToMarkdown` and `documentationToDocx` render it. Output is deterministic and all model text is escaped.

  `@bpmnkit/editor`: the HUD's More menu has **Export documentation…**. It offers a print view, HTML, Markdown and Word. The new `getDocumentationContext` option on `initEditorHud` supplies the linked decisions and forms. All new strings go through the editor's `translate` hook.

  `@bpmnkit/cli`: `casen doc export <file.bpmn> [linked .dmn/.form…] --format html|md|docx [--out] [--title] [--paper a4|letter]`.

  `@bpmnkit/drop`: a shared drop has a **Docs** button for anyone who can read it. It documents the drop's BPMN file together with every DMN and form file in the drop.

- 56ad670: **Security: the local proxy is no longer open to every web page and every machine on the network.** This changes default behaviour.

  Until now the proxy listened on all interfaces, answered every request with `Access-Control-Allow-Origin: *`, and let its `/fs/*` routes read, write, move and delete any absolute path. While it ran, any web page you visited, and any host on your network, could read or overwrite local files, use your Camunda profiles through `/api/*`, read secrets through `/secrets/*`, and start AI CLIs through `/chat`.
  - **Loopback only.** The proxy listens on `127.0.0.1` and `::1`. `casen proxy start --host <addr>` or `BPMNKIT_PROXY_HOST` listens elsewhere and prints a warning.
  - **Allowed origins only.** Browser requests must come from `https://bpmnkit.com`, `https://studio.bpmnkit.com`, `https://bpmnkit-studio.pages.dev`, the desktop app (`tauri://localhost`, `http(s)://tauri.localhost`) or a `localhost` / `127.0.0.1` / `[::1]` origin on any port. Other origins get `403` with no CORS headers, and the allowed origin is reflected with `Vary: Origin` instead of `*`. Cross-site browser requests without an `Origin` are refused too. Add origins with `--allow-origin` or `BPMNKIT_PROXY_ALLOWED_ORIGINS`.
  - **Loopback `Host` only**, against DNS rebinding. Add names with `--allow-host` or `BPMNKIT_PROXY_ALLOWED_HOSTS`.
  - **Workspace roots.** `/fs/*` and `/element-templates` work only inside folders passed with `--root` / `BPMNKIT_PROXY_ROOTS` or opened by Studio. The proxy refuses to open the filesystem root, your home directory, a folder that contains it, or a hidden folder unless you pass it with `--root`. Inside a root, only `.bpmn`, `.dmn`, `.form` and `.md` files and their metadata can be touched; `..` and symlinks out of the root are refused. The `/fs/*` routes accept an optional `root` (query or body) naming the workspace the path belongs to.
  - `@bpmnkit/proxy` exports `createProxyServer`, `listenProxy` and the `ProxyServerOptions` type; `startServer(port, options)` takes the same options.
  - The desktop app's bundled AI server (`proxy-rs`) applies the same bind, `Host` and origin rules.

  Programs that send no `Origin` header (the CLI, the MCP server, `curl`) work as before. First-party clients need no change; Studio now names its project root on every file call so saves keep working after the proxy restarts.

  Why a minor for `@bpmnkit/cli` at 1.x: the command line is unchanged apart from four new optional flags. What changes is what the proxy lets in, and the only callers it now turns away are ones that were never meant to reach it — any web page and any host on the network. A web app on your own origin needs `--allow-origin`; a proxy you reach over the network needs `--host` and `--allow-host`. Closing a hole that let any site read your files does not wait for a major.

- 56ad670: - `@bpmnkit/patterns/templates` (new export): 25 runnable Camunda 8 process templates — order
  to cash, approvals, onboarding, incidents, documents, SLAs, sagas, human-in-the-loop and seven
  AI agent patterns — each with DMN/forms where used and a `.bpmn.tests.json` scenario set that
  passes on `@bpmnkit/engine`'s `runScenario`. `ALL_TEMPLATES`, `TEMPLATE_CATEGORIES`,
  `getTemplate`, `templatesInCategory`, `templateFiles`, `listJobTypes`. The package now
  depends on `@bpmnkit/core`.
  - `casen template list [--category]` and `casen template use <id> [dir] [--force]` write a
    template's files into a project.
  - Core: `receiveTask(..., { correlationKey })` now writes the `zeebe:subscription` it
    documented; it was silently dropped, so the task failed `deploy/message-catch-no-correlation`.
- 56ad670: Typed code generation from BPMN, and a worker contract check.

  `@bpmnkit/core` adds `generateProcessTypes(definitions | definitions[], options?)`, which returns TypeScript source, and `extractProcessContract`, which returns the same contract as data. Both are pure and deterministic. The source types the process ids and every static job type: its input variables, its output, its task headers as literal types, and the error codes that catch events handle. It also types message names (with correlation keys), signal names, error codes and escalation codes, and a `JobTypes` map for typed workers. Values are `unknown` and keys are exact. The typed workers guide documents the rules.

  `casen generate types` (`casen gen types`) writes the file from BPMN files, directories or globs. `--check` exits 1 when the file is stale. `--check-workers <glob>` reports BPMN job types that have no worker and worker registrations that match no job type. This scan is a heuristic. `--strict` makes it exit 1 on a mismatch.

  `@bpmnkit/worker-client`: `createWorkerClient<JobTypes>()` types `job.variables`, `job.complete()`, `job.throwError()` and the new `job.customHeaders` by job type. Without a type argument, the client is untyped as before.

### Patch Changes

- 56ad670: `casen dev --help` no longer prints the command as "casen dev dev".
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

- 56ad670: Each README now shows the package's product tier (Core, Tools or Experimental) and what that tier promises. The `@bpmnkit/reebe-wasm` README and description say that Reebe is a dev/test engine, not for production: a clean-room implementation of the Zeebe API, not affiliated with Camunda.
- 56ad670: **Security hardening: the AI CLIs the proxy starts can no longer run commands, touch files or open URLs.**

  `/chat` started `claude` with `--dangerously-skip-permissions --permission-mode bypassPermissions`, so anything that reached the route — an XSS on an allowed origin, or a prompt injection carried in a BPMN file, chat text or a process variable — could have the CLI run shell commands on your machine. `copilot` ran with `--yolo`, and so did the desktop app's `gemini`. The diagram tool `compose_diagram` (and `sdk_search` / `sdk_execute`) ran the model's code under `node:vm`, which a Bridge function's `constructor` escapes to `process`.
  - **No built-in tools, no bypass.** Every run — `/chat`, `/improve`, `/operate/chat`, `/operate/incident-assist`, `/operate/ai-search`, the `io.bpmnkit:llm:1` worker, `casen ask` — gets permission checks on and no shell, file or web tools. `claude` runs with `--tools "" --strict-mcp-config --setting-sources "" --permission-mode dontAsk`; `copilot` with `--deny-tool=shell --deny-tool=write --deny-tool=url` and no `--allow-all-tools`; `gemini` with a policy that denies every tool, `--extensions none`, and `--skip-trust` for the empty run folder.
  - **Only the proxy's diagram tools for diagram edits.** A `/chat` edit may call the eight `bpmn` MCP tools and nothing else; none of your own MCP servers, settings, plugins or project instructions load. Each run starts in an empty temporary folder.
  - **`compose_diagram`, `sdk_search` and `sdk_execute` run in an `isolated-vm` isolate** that sees only copies of what the Bridge returns.
  - **Request data is fenced.** Chat text, diagrams, incident details and variable values reach the model inside `<untrusted-input>` tags the system prompt marks as data. `claude` gets the conversation on stdin and `--system-prompt` in place of its coding-agent prompt.
  - `@bpmnkit/proxy` exports `askText(cli, systemPrompt, userText)` for a one-off tool-less answer; `casen ask` now uses it.
  - The desktop app's AI server (`proxy-rs`) applies the same flags, fencing and empty working folder, and no longer passes `--yolo` to `gemini`.

  Features are unchanged: the AI panel still edits diagrams through the MCP tools, and `/improve`, incident assist and AI search still answer with text or JSON. A developer who set up Bedrock or Vertex for `claude` through `~/.claude/settings.json` `env` needs those variables in the proxy's environment instead, since user settings are no longer loaded.

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
- Updated dependencies [4e3bf2f]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
- Updated dependencies [56ad670]
  - @bpmnkit/api@1.0.1
  - @bpmnkit/core@1.1.0
  - @bpmnkit/engine@1.1.0
  - @bpmnkit/connectors@1.1.0
  - @bpmnkit/proxy@0.4.0
  - @bpmnkit/ascii@1.0.1
  - @bpmnkit/profiles@0.0.21
  - @bpmnkit/connector-gen@1.0.1
  - @bpmnkit/patterns@0.1.0

## 1.0.0

### Major Changes

- 0ba6ef6: **1.0.0.** These twelve packages now carry the stability promise at
  https://bpmnkit.com/docs/getting-started/stability.

  A 1.0.0 is not a rewrite, it is a commitment: from here, `^1` means an upgrade will not move
  your code, and anything that would — a removed export, a narrowed return type, a generated
  document whose `semanticHash` shifts for the same input — waits for a 2.0.

  The bar was three things: a test suite that would catch the package's own breakage, a
  documentation page, and an API worth defending for a year. Twelve of the twenty-six published
  packages clear it. The other fourteen stay on 0.x deliberately — most are short of the first
  two conditions, and the rest are worked examples, scaffolders or generated builds with no API
  of their own to freeze. Joining later costs nothing, since 0.x → 1.0 breaks no one, so the bar
  was applied strictly rather than generously.

  Membership is not only prose: it lives in `STABLE` in `scripts/published-packages.mjs`, and
  `check-packages.mjs` enforces both directions — nothing on the list may lack tests or a
  documentation page, and nothing at 1.0.0 or above may be missing from the list. `api-surface.json`
  records every export of every package in the set, and CI fails a pull request that removes or
  renames one without saying so.

  ### Breaking
  - **`@bpmnkit/core`** — `BuildOptions.strict` is removed. It had been a deprecated alias for
    `explicitJoins` since that option was renamed; rename the call and the behaviour is
    identical. Deliberately taken now rather than carried into 1.0, where it would have been
    stuck until a 2.0. (`applyBpmnOperations`' unrelated `strict` option is untouched.)

  ### Fixed
  - **`@bpmnkit/core`** — parse failures now throw `ParseError`, as the package has always
    documented. They threw a bare `Error` at 35 of the 36 throw sites across the BPMN, DMN and
    Form parsers, so the `if (err instanceof ParseError)` branch `errors.ts` tells callers to
    write never ran. Additive: `ParseError extends BpmnSdkError extends Error`, so code that
    caught `Error` is unaffected and the documented check starts working.
  - **`@bpmnkit/feel`** — the README's Quick Start could not run. `evaluate` takes an
    `EvalContext` (`{ vars }`), not a bare object; `highlightFeel` returns an HTML string rather
    than tokens to iterate; `formatFeel` takes a parsed node, not source text; `annotate` returns
    classified tokens, not an AST; and `ParseError` is `{ message, start, end }`. Four of eight
    rows in its API table were wrong.

  ### Added
  - **`@bpmnkit/feel`** — `builtinNames()` and `getBuiltin()` are exported, so an editor can
    enumerate the 88 built-in functions without reaching into `dist/`.
  - Documentation pages for `@bpmnkit/plugins`, `@bpmnkit/feel`, `@bpmnkit/connectors` and
    `@bpmnkit/ascii`, which had none.
  - `engines.node` on every package in the set; only two declared one before.

### Patch Changes

- 0ba6ef6: Rename the MCP entry point from `@bpmnkit/proxy/dist/aikit-mcp.js` to
  `@bpmnkit/proxy/aikit-mcp`.

  The old spelling named a build path as public API, on the same day the stability policy
  started saying that deep `dist/` paths are not. `@bpmnkit/proxy` is still 0.x and makes no
  compatibility promise, so this is the free moment to fix it — once it reaches 1.0 the
  contradiction would be frozen in, and the choice would be between breaking it later or
  publishing a policy the package's own manifest contradicts.

  `casen proxy mcp` resolves the new subpath. Nothing about the command changes.

- 0ba6ef6: Depend on sibling packages by caret range instead of an exact version.

  Every internal dependency was `workspace:*`, which publishes as an **exact** pin —
  `@bpmnkit/plugins` depended on `@bpmnkit/core` at exactly `0.4.0`, not `^0.4.0`. In a
  lockstep 0.x that is invisible. It stops being invisible the moment two BPMN Kit
  packages in one dependency tree disagree about which version of a third they want: npm
  and pnpm both satisfy that by installing **two copies**, and a second copy of
  `@bpmnkit/core` is not a duplicate of the first. Class identity, `instanceof`, module-level
  registries and TypeScript's structural-but-nominal-at-the-boundary types all quietly stop
  matching across the seam.

  `workspace:^` publishes `^0.4.0`, so a consumer resolves one copy. The change has to land
  before 1.0.0 rather than with it: widening a published range is itself a change to every
  manifest, and doing it as part of the 1.0 tag would mean the first stable release is also
  the one that moves everyone's dependency graph.

  The private apps in the workspace keep `workspace:*`. They are never published, so the
  range has no consumer to reach.

- Updated dependencies [d910fae]
- Updated dependencies [0ba6ef6]
- Updated dependencies [0ba6ef6]
- Updated dependencies [d910fae]
- Updated dependencies [0ba6ef6]
  - @bpmnkit/proxy@0.3.0
  - @bpmnkit/connector-gen@1.0.0
  - @bpmnkit/connectors@1.0.0
  - @bpmnkit/engine@1.0.0
  - @bpmnkit/ascii@1.0.0
  - @bpmnkit/core@1.0.0
  - @bpmnkit/api@1.0.0
  - @bpmnkit/profiles@0.0.20

## 0.2.6

### Patch Changes

- Updated dependencies [191d4d2]
  - @bpmnkit/core@0.8.0
  - @bpmnkit/proxy@0.2.6
  - @bpmnkit/ascii@0.0.38
  - @bpmnkit/connectors@0.1.6
  - @bpmnkit/engine@0.1.38

## 0.2.5

### Patch Changes

- Updated dependencies [c8ceaaa]
  - @bpmnkit/core@0.7.1
  - @bpmnkit/connectors@0.1.5
  - @bpmnkit/engine@0.1.37
  - @bpmnkit/proxy@0.2.5
  - @bpmnkit/ascii@0.0.37

## 0.2.4

### Patch Changes

- Updated dependencies [e096585]
  - @bpmnkit/core@0.7.0
  - @bpmnkit/proxy@0.2.4
  - @bpmnkit/ascii@0.0.36
  - @bpmnkit/connectors@0.1.4
  - @bpmnkit/engine@0.1.36

## 0.2.3

### Patch Changes

- Updated dependencies [780e39d]
  - @bpmnkit/core@0.6.0
  - @bpmnkit/proxy@0.2.3
  - @bpmnkit/ascii@0.0.35
  - @bpmnkit/connectors@0.1.3
  - @bpmnkit/engine@0.1.35

## 0.2.2

### Patch Changes

- 9d412da: Coordinated release of every published package

  `@bpmnkit/core` carries fixes that have been on `main` since the last release but never
  shipped — `compactify()`/`expand()` keeping `<bpmn:documentation>` through the operations
  API (#150) among them, which is still reported as reproducing because the newest artifact
  on npm predates the fix. Bumping every publishable package releases the workspace as one
  set, so no consumer resolves a core that a sibling package was never built against.

  Nothing here changes behaviour beyond what each package's own changesets describe.

- Updated dependencies [53a9e25]
- Updated dependencies [9d412da]
- Updated dependencies [9d412da]
  - @bpmnkit/core@0.5.0
  - @bpmnkit/proxy@0.2.2
  - @bpmnkit/api@0.0.21
  - @bpmnkit/ascii@0.0.34
  - @bpmnkit/connector-gen@0.0.16
  - @bpmnkit/connectors@0.1.2
  - @bpmnkit/engine@0.1.34
  - @bpmnkit/patterns@0.0.6
  - @bpmnkit/profiles@0.0.19

## 0.2.1

### Patch Changes

- Updated dependencies [8fdc6d4]
  - @bpmnkit/core@0.4.0
  - @bpmnkit/proxy@0.2.1
  - @bpmnkit/ascii@0.0.33
  - @bpmnkit/connectors@0.1.1
  - @bpmnkit/engine@0.1.33

## 0.2.0

### Minor Changes

- 1d2ec66: Element templates by convention — a project's own connectors reach the tools.

  `@bpmnkit/connectors` could parse the Zeebe element-template schema but only ever loaded its
  own generated catalogue, so a team's in-house connectors could not reach the editor at all.
  Now they can:
  - **`@bpmnkit/connectors/node`** — `discoverElementTemplates({ from, root, configFolder })`
    walks up from a diagram to the project root collecting `.camunda/element-templates/*.json`,
    nearest last so a template beside the diagram overrides one at the root, which overrides the
    bundle. `collectElementTemplates({ root })` is the opposite walk, for checking a whole
    project. The filesystem half sits behind its own entry point so the main package stays
    importable in a browser.
  - **`validateElementTemplate` / `readTemplateDocument`** — structural validation with paths
    (`properties[3].binding.type`) rather than a JSON-schema engine's `oneOf` noise. Every
    problem is reported at once, a file that fails is named and skipped rather than silently
    dropped, and one bad template never costs the good ones beside it. A separate `warnings`
    channel flags a binding the schema allows that `applyElementTemplate` does not write yet.
  - **`registerElementTemplates` / `clearRegisteredTemplates`** — merge templates into the
    catalogue, later registration winning on an id collision, so `listConnectors`, `getTemplate`
    and `searchConnectors` see a project's own.
  - **`casen connector validate [path]`** — validates a whole project (scanning downward, so a
    template beside a sub-folder's diagrams is checked too) or a single `.json` file, with
    `--format json` and a non-zero exit for CI. `list`, `search` and `show` now include the
    project's templates, with `--workspace` and `--config-folder`.
  - **`GET /element-templates?root=…`** on the proxy, and `workspaceRoot` / `workspaceTemplates`
    on the connector-catalog plugin — the browser path, where the host supplies templates rather
    than reaching for a filesystem.

  `TemplateBinding` also gains `bpmn:Message#property`,
  `bpmn:Message#zeebe:subscription#property` and `zeebe:linkedResource`. The bundled catalogue
  uses all three across 98 properties; the union did not admit them, and `applyElementTemplate`
  still does not write them — which is now what the new warning says out loud.

- 1d2ec66: Static analysis reaches the canvas, and stops accusing engine-neutral diagrams.

  `casen lint` has had five categories of rules for a while and none of them were visible while
  modelling. `@bpmnkit/plugins/lint` puts them on the diagram: a marker on every offending
  element (worst severity wins, so a task with an error and three warnings reads as an error), a
  control in the corner counting them, and clicking it steps through them one at a time. It
  re-lints after an edit, debounced, so typing a name does not re-run the analysis per keystroke.

  **`lintDiagram(defs, options)` in `@bpmnkit/core`** is the seam a host needs. Two things it adds
  over calling `optimize` directly, both about handing findings somewhere else:
  - The result is **serialisable**. An `OptimizationFinding` carries an `applyFix` function, so it
    cannot cross a `postMessage` or a JSON boundary; a `LintDiagnostic` says `fixable: true` and
    leaves the fix where it can still be called. It also names the diagram plane each finding is
    on, since a viewer shows one plane at a time.
  - The **rules match the model**. A diagram that names no `modeler:executionPlatform` is no longer
    judged against Camunda 8 deployability. This was measured, not assumed: on an engine-neutral
    model every other category either stays quiet or reports something structural that holds
    regardless, while `deploy` calls a plain service task an **error** for having no
    `zeebe:taskDefinition` — a demand its author never signed up for.

  **`casen lint` changes behaviour** to match: on a model with no execution platform it skips the
  `deploy`, `connector` and `agentic` categories and says why. `--profile deploy` forces them back
  on, since asking for the deploy gate is asking for those rules. Both surfaces ask
  `lintCategories` the same question rather than each keeping their own list.

- 1d2ec66: Visual BPMN diff — a diagram diff, not a model diff.

  `diffDiagram(before, after)` joins `diffSemantics` in `@bpmnkit/core`. The semantic half
  excludes diagram interchange by design, so a task somebody dragged reads there as no change at
  all; `diffDiagram` adds the layout half back as its own `moved` category, computed from DI
  (bounds, waypoints, label placement, and flags such as collapsed/expanded). An element that
  both changed and moved is reported as changed. The result covers only elements carrying DI on
  one side or the other — a changed `targetNamespace` has nothing to draw — and carries a
  per-plane breakdown, since a viewer shows one plane at a time and a change inside a collapsed
  sub-process is otherwise invisible.

  `@bpmnkit/plugins/diff` renders it: `createBpmnDiff()` returns a pair of canvas plugins, one
  per version. Install them on two canvases and every element is marked on the side that can
  show it, a legend counts each category and names how many differences sit on a plane the
  canvas is not currently showing, and panning or zooming either canvas moves the other.

  `casen diff bpmn <before> <after>` reports the same thing in a terminal, naming elements rather
  than printing bare ids, with `--format json`, `--ascii`, and `--exit-code` to gate a pipeline.

### Patch Changes

- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
  - @bpmnkit/core@0.3.0
  - @bpmnkit/connectors@0.1.0
  - @bpmnkit/proxy@0.2.0
  - @bpmnkit/ascii@0.0.32
  - @bpmnkit/engine@0.1.32

## 0.1.0

### Minor Changes

- 00a65f5: `casen generate bpmn --input <file>` no longer replaces its input by default.

  It used to rebuild the file from the compact model and write the result back over the source,
  reporting success — which on a real Camunda blueprint silently dropped pools, lanes,
  `zeebe:subscription` correlation keys and `ioMapping` detail. The command now:
  - applies the patch to the full model, so nothing outside the compact view is lost;
  - requires `--output <file>`, or the new `--force` flag to replace the input in place
    (`--output` resolving to the input counts as in place), and names what an in-place write
    costs when it refuses;
  - settles the destination **before** reading stdin, so an unwritable target fails immediately
    rather than after the work is done.

  Two `--input` examples in the command's help that wrote in place now pass `--output`.

### Patch Changes

- Updated dependencies [00a65f5]
- Updated dependencies [00a65f5]
- Updated dependencies [00a65f5]
  - @bpmnkit/proxy@0.1.0
  - @bpmnkit/core@0.2.0
  - @bpmnkit/ascii@0.0.31
  - @bpmnkit/connectors@0.0.3
  - @bpmnkit/engine@0.1.31

## 0.0.37

### Patch Changes

- 9cd1942: Improvements around AI integration
- Updated dependencies [9cd1942]
  - @bpmnkit/connector-gen@0.0.15
  - @bpmnkit/connectors@0.0.2
  - @bpmnkit/patterns@0.0.5
  - @bpmnkit/profiles@0.0.18
  - @bpmnkit/engine@0.1.30
  - @bpmnkit/ascii@0.0.30
  - @bpmnkit/core@0.1.2
  - @bpmnkit/api@0.0.20
  - @bpmnkit/proxy@0.0.33

## 0.0.36

### Patch Changes

- Updated dependencies [c8f04ae]
  - @bpmnkit/core@0.1.1
  - @bpmnkit/proxy@0.0.32
  - @bpmnkit/ascii@0.0.29
  - @bpmnkit/engine@0.1.29

## 0.0.35

### Patch Changes

- Updated dependencies [b90111f]
- Updated dependencies [b90111f]
  - @bpmnkit/core@0.1.0
  - @bpmnkit/proxy@0.0.31
  - @bpmnkit/ascii@0.0.28
  - @bpmnkit/engine@0.1.28

## 0.0.34

### Patch Changes

- Updated dependencies [5ea5318]
  - @bpmnkit/core@0.0.27
  - @bpmnkit/proxy@0.0.30
  - @bpmnkit/ascii@0.0.27
  - @bpmnkit/engine@0.1.27

## 0.0.33

### Patch Changes

- Updated dependencies [c93b45d]
- Updated dependencies [c93b45d]
  - @bpmnkit/core@0.0.26
  - @bpmnkit/proxy@0.0.29
  - @bpmnkit/ascii@0.0.26
  - @bpmnkit/engine@0.1.26

## 0.0.32

### Patch Changes

- Updated dependencies [7916980]
  - @bpmnkit/core@0.0.25
  - @bpmnkit/proxy@0.0.28
  - @bpmnkit/ascii@0.0.25
  - @bpmnkit/engine@0.1.25

## 0.0.31

### Patch Changes

- dcf850a: Improvements
- d6d1860: Several bugfixes and feature implementations
- Updated dependencies [e9ac598]
- Updated dependencies [dcf850a]
- Updated dependencies [d6d1860]
  - @bpmnkit/core@0.0.24
  - @bpmnkit/proxy@0.0.27
  - @bpmnkit/api@0.0.19
  - @bpmnkit/ascii@0.0.24
  - @bpmnkit/connector-gen@0.0.14
  - @bpmnkit/engine@0.1.24
  - @bpmnkit/profiles@0.0.17

## 0.0.30

### Patch Changes

- Updated dependencies [[`c9aa98d`](https://github.com/bpmnkit/monorepo/commit/c9aa98d6430ec2022278631dae7c281aae9ae499), [`5897d0f`](https://github.com/bpmnkit/monorepo/commit/5897d0f77a9d29dc7e88c5123f467686ff6e1960)]:
  - @bpmnkit/core@0.0.23
  - @bpmnkit/proxy@0.0.26
  - @bpmnkit/ascii@0.0.23
  - @bpmnkit/engine@0.1.23

## 0.0.29

### Patch Changes

- [#93](https://github.com/bpmnkit/monorepo/pull/93) [`b7f6b1f`](https://github.com/bpmnkit/monorepo/commit/b7f6b1f8190c3d3be7439f832146169c26c25ae1) Thanks [@urbanisierung](https://github.com/urbanisierung)! - CLI: generate and view

## 0.0.28

### Patch Changes

- [#91](https://github.com/bpmnkit/monorepo/pull/91) [`1e90536`](https://github.com/bpmnkit/monorepo/commit/1e905362cb60fab2e03e0eafbe399eabcb0c80f0) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI Kit

## 0.0.27

### Patch Changes

- [#89](https://github.com/bpmnkit/monorepo/pull/89) [`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c) Thanks [@urbanisierung](https://github.com/urbanisierung)! - docs

- Updated dependencies [[`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c)]:
  - @bpmnkit/connector-gen@0.0.13
  - @bpmnkit/profiles@0.0.16
  - @bpmnkit/engine@0.1.22
  - @bpmnkit/ascii@0.0.22
  - @bpmnkit/core@0.0.22
  - @bpmnkit/api@0.0.18
  - @bpmnkit/proxy@0.0.25

## 0.0.26

### Patch Changes

- [#87](https://github.com/bpmnkit/monorepo/pull/87) [`6b3748a`](https://github.com/bpmnkit/monorepo/commit/6b3748a8a6b5dfde418c06873ec4412c5db6cec2) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AIKit extensions

- Updated dependencies [[`6b3748a`](https://github.com/bpmnkit/monorepo/commit/6b3748a8a6b5dfde418c06873ec4412c5db6cec2)]:
  - @bpmnkit/engine@0.1.21
  - @bpmnkit/proxy@0.0.24

## 0.0.25

### Patch Changes

- [#85](https://github.com/bpmnkit/monorepo/pull/85) [`293d719`](https://github.com/bpmnkit/monorepo/commit/293d71928066dd7ad0d2399b2036ed2496447a8a) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI plugins

- Updated dependencies [[`293d719`](https://github.com/bpmnkit/monorepo/commit/293d71928066dd7ad0d2399b2036ed2496447a8a)]:
  - @bpmnkit/proxy@0.0.23

## 0.0.24

### Patch Changes

- [#81](https://github.com/bpmnkit/monorepo/pull/81) [`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

- Updated dependencies [[`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40)]:
  - @bpmnkit/connector-gen@0.0.12
  - @bpmnkit/profiles@0.0.15
  - @bpmnkit/engine@0.1.20
  - @bpmnkit/ascii@0.0.21
  - @bpmnkit/core@0.0.21
  - @bpmnkit/api@0.0.17
  - @bpmnkit/proxy@0.0.22

## 0.0.23

### Patch Changes

- [#79](https://github.com/bpmnkit/monorepo/pull/79) [`94fde2c`](https://github.com/bpmnkit/monorepo/commit/94fde2ca21990234be7765fe8d9cb840f7f7e6f3) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Commands to start proxy and engine.

## 0.0.22

### Patch Changes

- [`802e1dd`](https://github.com/bpmnkit/monorepo/commit/802e1dde53dfda07371e6a83dcf0e05e2650d0a2) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Minor fixes.

- Updated dependencies [[`802e1dd`](https://github.com/bpmnkit/monorepo/commit/802e1dde53dfda07371e6a83dcf0e05e2650d0a2)]:
  - @bpmnkit/api@0.0.16
  - @bpmnkit/ascii@0.0.20
  - @bpmnkit/connector-gen@0.0.11
  - @bpmnkit/core@0.0.20
  - @bpmnkit/engine@0.1.19
  - @bpmnkit/profiles@0.0.14

## 0.0.21

### Patch Changes

- [#76](https://github.com/bpmnkit/monorepo/pull/76) [`8d1a978`](https://github.com/bpmnkit/monorepo/commit/8d1a978e0b8c321106d95226134cbba6433ab4af) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

- Updated dependencies [[`8d1a978`](https://github.com/bpmnkit/monorepo/commit/8d1a978e0b8c321106d95226134cbba6433ab4af)]:
  - @bpmnkit/engine@0.1.18
  - @bpmnkit/core@0.0.19
  - @bpmnkit/api@0.0.15
  - @bpmnkit/ascii@0.0.19
  - @bpmnkit/connector-gen@0.0.10
  - @bpmnkit/profiles@0.0.13

## 0.0.20

### Patch Changes

- [#74](https://github.com/bpmnkit/monorepo/pull/74) [`e356b98`](https://github.com/bpmnkit/monorepo/commit/e356b98a6b281f825e757cb6e480e50369789d08) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Test suites, simulation mode, improved reebe-wasm

- Updated dependencies [[`e356b98`](https://github.com/bpmnkit/monorepo/commit/e356b98a6b281f825e757cb6e480e50369789d08)]:
  - @bpmnkit/engine@0.1.17
  - @bpmnkit/api@0.0.14
  - @bpmnkit/ascii@0.0.18
  - @bpmnkit/connector-gen@0.0.9
  - @bpmnkit/core@0.0.18
  - @bpmnkit/profiles@0.0.12

## 0.0.19

### Patch Changes

- Updated dependencies [[`3f3b8f7`](https://github.com/bpmnkit/monorepo/commit/3f3b8f777cfb192582452757d86dc53b3de8059d)]:
  - @bpmnkit/core@0.0.17
  - @bpmnkit/ascii@0.0.17
  - @bpmnkit/engine@0.1.16

## 0.0.18

### Patch Changes

- [#65](https://github.com/bpmnkit/monorepo/pull/65) [`58adc33`](https://github.com/bpmnkit/monorepo/commit/58adc33d1818367a68c27cc02aabec7e68aca002) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Profile improvements

- [#66](https://github.com/bpmnkit/monorepo/pull/66) [`270078c`](https://github.com/bpmnkit/monorepo/commit/270078c52fce2c2a567fa1b4b9d6de8001c6f18e) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Improved AI capabilities.

- Updated dependencies [[`58adc33`](https://github.com/bpmnkit/monorepo/commit/58adc33d1818367a68c27cc02aabec7e68aca002), [`270078c`](https://github.com/bpmnkit/monorepo/commit/270078c52fce2c2a567fa1b4b9d6de8001c6f18e)]:
  - @bpmnkit/profiles@0.0.11
  - @bpmnkit/core@0.0.16
  - @bpmnkit/ascii@0.0.16
  - @bpmnkit/engine@0.1.15

## 0.0.17

### Patch Changes

- [#58](https://github.com/bpmnkit/monorepo/pull/58) [`4953231`](https://github.com/bpmnkit/monorepo/commit/49532315a01c884d2a50375e6ea0148d6e294034) Thanks [@urbanisierung](https://github.com/urbanisierung)! - UX improvements

- Updated dependencies [[`4953231`](https://github.com/bpmnkit/monorepo/commit/49532315a01c884d2a50375e6ea0148d6e294034)]:
  - @bpmnkit/engine@0.1.14
  - @bpmnkit/core@0.0.15
  - @bpmnkit/ascii@0.0.15

## 0.0.16

### Patch Changes

- [#53](https://github.com/bpmnkit/monorepo/pull/53) [`e9c16e0`](https://github.com/bpmnkit/monorepo/commit/e9c16e0e8f1d786feb10293a8abb2489846402db) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Introduction of CLI plugins, support for more services.

- Updated dependencies [[`e9c16e0`](https://github.com/bpmnkit/monorepo/commit/e9c16e0e8f1d786feb10293a8abb2489846402db)]:
  - @bpmnkit/connector-gen@0.0.8
  - @bpmnkit/profiles@0.0.10
  - @bpmnkit/ascii@0.0.14
  - @bpmnkit/api@0.0.13

## 0.0.15

### Patch Changes

- Updated dependencies [[`9aa2ca7`](https://github.com/bpmnkit/monorepo/commit/9aa2ca7b49e3d9ebf09abee45006b68a79bfee6c)]:
  - @bpmnkit/connector-gen@0.0.7

## 0.0.14

### Patch Changes

- [#49](https://github.com/bpmnkit/monorepo/pull/49) [`7918d12`](https://github.com/bpmnkit/monorepo/commit/7918d120740b85a2c4a363ff7dd9605d4f0f8a0d) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI in CLI, improved AI search in Operate, improved ASCII rendering

- Updated dependencies [[`7918d12`](https://github.com/bpmnkit/monorepo/commit/7918d120740b85a2c4a363ff7dd9605d4f0f8a0d)]:
  - @bpmnkit/ascii@0.0.13

## 0.0.13

### Patch Changes

- [#47](https://github.com/bpmnkit/monorepo/pull/47) [`89e73af`](https://github.com/bpmnkit/monorepo/commit/89e73af16532adb580a338eb8e4996d29b361283) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Design, AI, OpenAPI

- Updated dependencies [[`89e73af`](https://github.com/bpmnkit/monorepo/commit/89e73af16532adb580a338eb8e4996d29b361283)]:
  - @bpmnkit/connector-gen@0.0.6
  - @bpmnkit/profiles@0.0.9
  - @bpmnkit/ascii@0.0.12
  - @bpmnkit/api@0.0.12

## 0.0.12

### Patch Changes

- [#44](https://github.com/bpmnkit/monorepo/pull/44) [`da36cc5`](https://github.com/bpmnkit/monorepo/commit/da36cc54f36abaf0bebd686d4996d516037fd36b) Thanks [@urbanisierung](https://github.com/urbanisierung)! - New logo

- Updated dependencies [[`da36cc5`](https://github.com/bpmnkit/monorepo/commit/da36cc54f36abaf0bebd686d4996d516037fd36b)]:
  - @bpmnkit/connector-gen@0.0.5
  - @bpmnkit/profiles@0.0.8
  - @bpmnkit/ascii@0.0.11
  - @bpmnkit/api@0.0.11

## 0.0.11

### Patch Changes

- [#42](https://github.com/bpmnkit/monorepo/pull/42) [`adb60ed`](https://github.com/bpmnkit/monorepo/commit/adb60ed90f675b3565edb7d82d937acce518c837) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Proper README

- Updated dependencies [[`adb60ed`](https://github.com/bpmnkit/monorepo/commit/adb60ed90f675b3565edb7d82d937acce518c837)]:
  - @bpmnkit/connector-gen@0.0.4
  - @bpmnkit/profiles@0.0.7
  - @bpmnkit/ascii@0.0.10
  - @bpmnkit/api@0.0.10

## 0.0.10

### Patch Changes

- [#39](https://github.com/bpmnkit/monorepo/pull/39) [`0b7e74b`](https://github.com/bpmnkit/monorepo/commit/0b7e74ba66e35ef5361ac35dccf695f4f0671d6a) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Renamed from @bpmn-sdk/_ to @bpmnkit/_. Update your imports.

- Updated dependencies [[`0b7e74b`](https://github.com/bpmnkit/monorepo/commit/0b7e74ba66e35ef5361ac35dccf695f4f0671d6a)]:
  - @bpmnkit/connector-gen@0.0.3
  - @bpmnkit/profiles@0.0.6
  - @bpmnkit/ascii@0.0.9
  - @bpmnkit/api@0.0.9

## 0.0.9

### Patch Changes

- [#36](https://github.com/bpmnkit/monorepo/pull/36) [`5e8671e`](https://github.com/bpmnkit/monorepo/commit/5e8671e98bd6dafed271a5b5e52d406d2b9bedd8) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Template generation.

- Updated dependencies [[`5e8671e`](https://github.com/bpmnkit/monorepo/commit/5e8671e98bd6dafed271a5b5e52d406d2b9bedd8)]:
  - @bpmnkit/connector-gen@0.0.2

## 0.0.8

### Patch Changes

- [#34](https://github.com/bpmnkit/monorepo/pull/34) [`a918a93`](https://github.com/bpmnkit/monorepo/commit/a918a93d3d57f69c93c963da1b2710a3467a1b19) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Design changes

- Updated dependencies [[`a918a93`](https://github.com/bpmnkit/monorepo/commit/a918a93d3d57f69c93c963da1b2710a3467a1b19)]:
  - @bpmnkit/profiles@0.0.5
  - @bpmnkit/ascii@0.0.8
  - @bpmnkit/api@0.0.8

## 0.0.7

### Patch Changes

- [#32](https://github.com/bpmnkit/monorepo/pull/32) [`1120205`](https://github.com/bpmnkit/monorepo/commit/11202057baaf25f9a29c9a3a90b1f1f1fc002b64) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Operate and CLI improvements

- Updated dependencies [[`1120205`](https://github.com/bpmnkit/monorepo/commit/11202057baaf25f9a29c9a3a90b1f1f1fc002b64)]:
  - @bpmnkit/profiles@0.0.4
  - @bpmnkit/ascii@0.0.7
  - @bpmnkit/api@0.0.7

## 0.0.6

### Patch Changes

- [#30](https://github.com/bpmnkit/monorepo/pull/30) [`42ddd02`](https://github.com/bpmnkit/monorepo/commit/42ddd0255759ce35a14533cbc7667542ba9dac2e) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Operate, CLI, api

- Updated dependencies [[`42ddd02`](https://github.com/bpmnkit/monorepo/commit/42ddd0255759ce35a14533cbc7667542ba9dac2e)]:
  - @bpmnkit/profiles@0.0.3
  - @bpmnkit/ascii@0.0.6
  - @bpmnkit/api@0.0.6

## 0.0.5

### Patch Changes

- [#28](https://github.com/bpmnkit/monorepo/pull/28) [`42455c0`](https://github.com/bpmnkit/monorepo/commit/42455c00033f3526a5cffdd0f68b973a5d556fec) Thanks [@urbanisierung](https://github.com/urbanisierung)! - SDK improvements, operate, editor UX improvements

- Updated dependencies [[`42455c0`](https://github.com/bpmnkit/monorepo/commit/42455c00033f3526a5cffdd0f68b973a5d556fec)]:
  - @bpmnkit/profiles@0.0.2
  - @bpmnkit/api@0.0.5

## 0.0.4

### Patch Changes

- [#26](https://github.com/bpmnkit/monorepo/pull/26) [`454f119`](https://github.com/bpmnkit/monorepo/commit/454f1192d919ad0397f2e1d2f24de5acb1a38156) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Docs, Logo, AI improvements

- Updated dependencies [[`454f119`](https://github.com/bpmnkit/monorepo/commit/454f1192d919ad0397f2e1d2f24de5acb1a38156)]:
  - @bpmnkit/api@0.0.4

## 0.0.3

### Patch Changes

- [`ee1610b`](https://github.com/bpmnkit/monorepo/commit/ee1610b2c310e8ae9e063632a53479656309920a) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Fix package.json

- Updated dependencies [[`ee1610b`](https://github.com/bpmnkit/monorepo/commit/ee1610b2c310e8ae9e063632a53479656309920a)]:
  - @bpmnkit/api@0.0.3

## 0.0.2

### Patch Changes

- [#22](https://github.com/bpmnkit/monorepo/pull/22) [`7470bd9`](https://github.com/bpmnkit/monorepo/commit/7470bd92c37b13ab9895a784ae667e933aa4b072) Thanks [@urbanisierung](https://github.com/urbanisierung)! - First ready features.

- Updated dependencies [[`7470bd9`](https://github.com/bpmnkit/monorepo/commit/7470bd92c37b13ab9895a784ae667e933aa4b072)]:
  - @bpmnkit/api@0.0.2
