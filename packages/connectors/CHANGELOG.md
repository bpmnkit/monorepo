# @bpmnkit/connectors

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

- Updated dependencies [0ba6ef6]
- Updated dependencies [d910fae]
- Updated dependencies [0ba6ef6]
  - @bpmnkit/core@1.0.0
  - @bpmnkit/feel@1.0.0

## 0.1.6

### Patch Changes

- Updated dependencies [191d4d2]
  - @bpmnkit/core@0.8.0

## 0.1.5

### Patch Changes

- Updated dependencies [c8ceaaa]
  - @bpmnkit/feel@0.1.0
  - @bpmnkit/core@0.7.1

## 0.1.4

### Patch Changes

- Updated dependencies [e096585]
  - @bpmnkit/core@0.7.0

## 0.1.3

### Patch Changes

- Updated dependencies [780e39d]
  - @bpmnkit/core@0.6.0

## 0.1.2

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
  - @bpmnkit/feel@0.0.21

## 0.1.1

### Patch Changes

- Updated dependencies [8fdc6d4]
  - @bpmnkit/core@0.4.0

## 0.1.0

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

### Patch Changes

- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
  - @bpmnkit/core@0.3.0

## 0.0.3

### Patch Changes

- Updated dependencies [00a65f5]
  - @bpmnkit/core@0.2.0

## 0.0.2

### Patch Changes

- 9cd1942: Improvements around AI integration
- Updated dependencies [9cd1942]
  - @bpmnkit/core@0.1.2
  - @bpmnkit/feel@0.0.20
