# @bpmnkit/connector-gen

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

## 0.0.16

### Patch Changes

- 9d412da: Coordinated release of every published package

  `@bpmnkit/core` carries fixes that have been on `main` since the last release but never
  shipped — `compactify()`/`expand()` keeping `<bpmn:documentation>` through the operations
  API (#150) among them, which is still reported as reproducing because the newest artifact
  on npm predates the fix. Bumping every publishable package releases the workspace as one
  set, so no consumer resolves a core that a sibling package was never built against.

  Nothing here changes behaviour beyond what each package's own changesets describe.

## 0.0.15

### Patch Changes

- 9cd1942: Improvements around AI integration

## 0.0.14

### Patch Changes

- dcf850a: Improvements
- d6d1860: Several bugfixes and feature implementations

## 0.0.13

### Patch Changes

- [#89](https://github.com/bpmnkit/monorepo/pull/89) [`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c) Thanks [@urbanisierung](https://github.com/urbanisierung)! - docs

## 0.0.12

### Patch Changes

- [#81](https://github.com/bpmnkit/monorepo/pull/81) [`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

## 0.0.11

### Patch Changes

- [`802e1dd`](https://github.com/bpmnkit/monorepo/commit/802e1dde53dfda07371e6a83dcf0e05e2650d0a2) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Minor fixes.

## 0.0.10

### Patch Changes

- [#76](https://github.com/bpmnkit/monorepo/pull/76) [`8d1a978`](https://github.com/bpmnkit/monorepo/commit/8d1a978e0b8c321106d95226134cbba6433ab4af) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

## 0.0.9

### Patch Changes

- [#74](https://github.com/bpmnkit/monorepo/pull/74) [`e356b98`](https://github.com/bpmnkit/monorepo/commit/e356b98a6b281f825e757cb6e480e50369789d08) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Test suites, simulation mode, improved reebe-wasm

## 0.0.8

### Patch Changes

- [#53](https://github.com/bpmnkit/monorepo/pull/53) [`e9c16e0`](https://github.com/bpmnkit/monorepo/commit/e9c16e0e8f1d786feb10293a8abb2489846402db) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Introduction of CLI plugins, support for more services.

## 0.0.7

### Patch Changes

- [#51](https://github.com/bpmnkit/monorepo/pull/51) [`9aa2ca7`](https://github.com/bpmnkit/monorepo/commit/9aa2ca7b49e3d9ebf09abee45006b68a79bfee6c) Thanks [@urbanisierung](https://github.com/urbanisierung)! - OpenAPI autogenerated templates integration into Editor

## 0.0.6

### Patch Changes

- [#47](https://github.com/bpmnkit/monorepo/pull/47) [`89e73af`](https://github.com/bpmnkit/monorepo/commit/89e73af16532adb580a338eb8e4996d29b361283) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Design, AI, OpenAPI

## 0.0.5

### Patch Changes

- [#44](https://github.com/bpmnkit/monorepo/pull/44) [`da36cc5`](https://github.com/bpmnkit/monorepo/commit/da36cc54f36abaf0bebd686d4996d516037fd36b) Thanks [@urbanisierung](https://github.com/urbanisierung)! - New logo

## 0.0.4

### Patch Changes

- [#42](https://github.com/bpmnkit/monorepo/pull/42) [`adb60ed`](https://github.com/bpmnkit/monorepo/commit/adb60ed90f675b3565edb7d82d937acce518c837) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Proper README

## 0.0.3

### Patch Changes

- [#39](https://github.com/bpmnkit/monorepo/pull/39) [`0b7e74b`](https://github.com/bpmnkit/monorepo/commit/0b7e74ba66e35ef5361ac35dccf695f4f0671d6a) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Renamed from @bpmn-sdk/_ to @bpmnkit/_. Update your imports.

## 0.0.2

### Patch Changes

- [#36](https://github.com/bpmnkit/monorepo/pull/36) [`5e8671e`](https://github.com/bpmnkit/monorepo/commit/5e8671e98bd6dafed271a5b5e52d406d2b9bedd8) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Template generation.
