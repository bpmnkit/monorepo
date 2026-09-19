# @bpmnkit/docspack

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

- 0ba6ef6: Index the new Stability and Versioning page.

  `docs/getting-started/stability` states the contract each package takes on at 1.0.0: that
  public API is what the `exports` entry points export minus `@internal`, how type-level changes
  are graded in each direction, and — the part no general semver policy covers — that a change to
  generated BPMN is breaking when it moves `semanticHash` and not when it only moves the bytes.

  The pack grows from 191 to 198 chunks.

## 0.0.6

### Patch Changes

- 191d4d2: Discover a vendor's second pack. The docspack spec names one pack per npm scope, `@<vendor>/docspack`, so `@bpmnkit/camunda-docspack` was published, documented and never found — every `--pack @bpmnkit/camunda-docspack` command answered `No documentation matches`, which reads as an answer rather than a failure. `discoverPacks` now reads `@<vendor>/<name>-docspack` as well: still a pure name check, still inside a scope the vendor owns, still no registry call.

  `--pack` naming a package that is not installed is now an error listing the packages that are, in both the CLI and `search()`. An empty result meant "the documentation does not cover this", which is a different claim and the wrong one to hand a model.

  `--pack` also narrows before the index is built rather than after. Indexing reads every chunk of every pack off disk, so a question scoped to one pack no longer pays for the others — roughly 150ms against 650ms with both packs installed.

## 0.0.5

### Patch Changes

- 677e58a: Add `@bpmnkit/camunda-docspack`: the Camunda 8.10 documentation — best practices, the BPMN and FEEL references, engine concepts and 227 Orchestration Cluster API operations — as an offline docspack pack, searchable with `bpmnkit-docs ask`. Embedded BPMN diagrams are rendered as text flow descriptions rather than dropped, and links are rewritten to absolute `docs.camunda.io` URLs. Licensed CC BY-SA 3.0, as ShareAlike requires for an adaptation of camunda-docs.

  `@bpmnkit/docspack`: a chunk's heading trail no longer keeps an empty level when a short preamble is merged into the section after it (`Title —  — Section`).

## 0.0.4

### Patch Changes

- 9d412da: Coordinated release of every published package

  `@bpmnkit/core` carries fixes that have been on `main` since the last release but never
  shipped — `compactify()`/`expand()` keeping `<bpmn:documentation>` through the operations
  API (#150) among them, which is still reported as reproducing because the newest artifact
  on npm predates the fix. Bumping every publishable package releases the workspace as one
  set, so no consumer resolves a core that a sibling package was never built against.

  Nothing here changes behaviour beyond what each package's own changesets describe.

## 0.0.3

### Patch Changes

- f990c94: Documentation moved from `docs.bpmnkit.com` to `bpmnkit.com/docs`.
  - `astro-shared`: `SITE.docsUrl` is now `https://bpmnkit.com/docs`.
  - `docspack`: the pack is built from `apps/landing/src/content/docs` with
    `siteUrl: https://bpmnkit.com/docs`, and each chunk's `Source:` link no longer ends in a
    trailing slash — the site serves extensionless URLs without one.
  - `plugins`: the command palette's default `docsBaseUrl` and its doc paths follow the new URLs.

- 00a65f5: Rebuilt the pack against the corrected round-trip documentation.

  The docs claimed "the parser preserves all attributes, extensions, and vendor-specific
  elements", which 11 of 12 measured blueprints contradicted, and the parsing example used
  `definitions.rootElements` rather than `definitions.processes`. `concepts.md`, `guides/ai.md`
  and `packages/core.md` now state what survives and what is dropped, and the chunks agents
  retrieve say the same.

## 0.0.2

### Patch Changes

- 1c5e32d: New `@bpmnkit/docspack` package: the BPMN Kit documentation shipped as an offline, version-locked [docspack](https://docspack.dev/spec) package, with a `bpmnkit-docs` CLI so an AI agent can search it without a server or a network call.
