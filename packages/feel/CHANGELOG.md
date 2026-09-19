# @bpmnkit/feel

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

## 0.1.0

### Minor Changes

- c8ceaaa: FEEL conformance: 1,939 of the DMN TCK's 2,053 FEEL cases, up from 1,282

  The package was compared expression by expression against `@bpmn-io/feelin`, and then
  against the DMN TCK itself, which now runs from a dmn-tck checkout via
  `pnpm --filter @bpmnkit/feel tck` and weekly in CI.

  **This release changes what existing expressions evaluate to.** Where the package was
  wrong, it was usually wrong by answering confidently rather than by failing, so expect
  results to move:
  - String literals decode every escape FEEL defines. `"a\nb"` was the six characters
    `a`, `\`, `n`, `b` and is now a string with a newline in it. Only `\"` and `\\` were
    decoded before.
  - Named arguments bind by parameter name instead of by the order they were written, so
    `replace(replacement: "x", pattern: "b", input: "abc")` is `"axc"` rather than `"x"`.
    An argument name the built-in does not declare is now null.
  - `and` and `or` follow DMN's ternary logic: a non-boolean operand leaves the result
    unknown, so `true and 123` is null where it was true. Equality across two different
    types is null, so `false = 0` is null where it was false. A condition that used to
    come back true or false may now come back null, which an engine reads as not true.
  - Numeric built-ins no longer coerce their arguments, so `sqrt("4")` is null; `number()`
    is the way to convert. Calling a built-in with an argument count no signature accepts
    is null rather than quietly ignoring the extras.
  - `**` is left-associative, as FEEL specifies for every infix operator, so `2 ** 3 ** 2`
    is 64 rather than 512.
  - `date()` and `time()` reject values no calendar or clock has, and adding months clamps
    the day: `date("2020-01-31") + duration("P1M")` is 2020-02-29, not a February 31st.
  - `string(null)` is null rather than the text "null", `count(null)` is null, and
    `string()` renders lists and contexts.

  What the package could not do before, and now can: `in` takes a unary test
  (`1 in <= 10`, `10 in (1, < 5, >= 10)`); `is()` exists; context entries see the entries
  before them (`{a: 1, b: a + 1}`); `for`/`some`/`every` take a range domain
  (`for i in 1..3`), each binding's domain sees the bindings to its left, and the body sees
  the results so far as `partial`; a function-valued expression can be invoked
  (`{f: function(a) a}.f(1)`); a filter condition sees a context element's entries
  (`[{a: 1}, {a: 2}][a >= 2]`); time zones resolve to the offset they are on that day;
  and names are not limited to ASCII.

  Two additions to the API:
  - `parseExpression(input, { names })` and `parseUnaryTests(input, { names })` take the
    names in scope, so a variable called `total order amount` parses as one name rather
    than three. Without it, only multi-word built-in names are recognized, as before.
  - A `call-expr` AST node represents invoking a function-valued expression. Code that
    switches exhaustively over `FeelNode["kind"]` needs a case for it; `@bpmnkit/core`'s
    FEEL identifier extractor has one.

  The 114 TCK cases that remain are listed in the package's `tests/tck.test.ts` with the
  reason each is held back. The largest groups belong to the decision model rather than the
  expression language — typeRef coercion and external Java functions — followed by XPath
  regular expression features V8 does not have. Numbers are compared to a relative 1e-9:
  DMN specifies decimal arithmetic to 34 significant digits and this package computes in
  float64, which is a deliberate trade for its parse-and-evaluate speed.

## 0.0.21

### Patch Changes

- 9d412da: Coordinated release of every published package

  `@bpmnkit/core` carries fixes that have been on `main` since the last release but never
  shipped — `compactify()`/`expand()` keeping `<bpmn:documentation>` through the operations
  API (#150) among them, which is still reported as reproducing because the newest artifact
  on npm predates the fix. Bumping every publishable package releases the workspace as one
  set, so no consumer resolves a core that a sibling package was never built against.

  Nothing here changes behaviour beyond what each package's own changesets describe.

## 0.0.20

### Patch Changes

- 9cd1942: Improvements around AI integration

## 0.0.19

### Patch Changes

- dcf850a: Improvements
- d6d1860: Several bugfixes and feature implementations

## 0.0.18

### Patch Changes

- [#89](https://github.com/bpmnkit/monorepo/pull/89) [`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c) Thanks [@urbanisierung](https://github.com/urbanisierung)! - docs

## 0.0.17

### Patch Changes

- [#81](https://github.com/bpmnkit/monorepo/pull/81) [`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

## 0.0.16

### Patch Changes

- [`802e1dd`](https://github.com/bpmnkit/monorepo/commit/802e1dde53dfda07371e6a83dcf0e05e2650d0a2) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Minor fixes.

## 0.0.15

### Patch Changes

- [#76](https://github.com/bpmnkit/monorepo/pull/76) [`8d1a978`](https://github.com/bpmnkit/monorepo/commit/8d1a978e0b8c321106d95226134cbba6433ab4af) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

## 0.0.14

### Patch Changes

- [#74](https://github.com/bpmnkit/monorepo/pull/74) [`e356b98`](https://github.com/bpmnkit/monorepo/commit/e356b98a6b281f825e757cb6e480e50369789d08) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Test suites, simulation mode, improved reebe-wasm

## 0.0.13

### Patch Changes

- [#53](https://github.com/bpmnkit/monorepo/pull/53) [`e9c16e0`](https://github.com/bpmnkit/monorepo/commit/e9c16e0e8f1d786feb10293a8abb2489846402db) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Introduction of CLI plugins, support for more services.

## 0.0.12

### Patch Changes

- [#47](https://github.com/bpmnkit/monorepo/pull/47) [`89e73af`](https://github.com/bpmnkit/monorepo/commit/89e73af16532adb580a338eb8e4996d29b361283) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Design, AI, OpenAPI

## 0.0.11

### Patch Changes

- [#44](https://github.com/bpmnkit/monorepo/pull/44) [`da36cc5`](https://github.com/bpmnkit/monorepo/commit/da36cc54f36abaf0bebd686d4996d516037fd36b) Thanks [@urbanisierung](https://github.com/urbanisierung)! - New logo

## 0.0.10

### Patch Changes

- [#42](https://github.com/bpmnkit/monorepo/pull/42) [`adb60ed`](https://github.com/bpmnkit/monorepo/commit/adb60ed90f675b3565edb7d82d937acce518c837) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Proper README

## 0.0.9

### Patch Changes

- [#39](https://github.com/bpmnkit/monorepo/pull/39) [`0b7e74b`](https://github.com/bpmnkit/monorepo/commit/0b7e74ba66e35ef5361ac35dccf695f4f0671d6a) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Renamed from @bpmn-sdk/_ to @bpmnkit/_. Update your imports.

## 0.0.8

### Patch Changes

- [#34](https://github.com/bpmnkit/monorepo/pull/34) [`a918a93`](https://github.com/bpmnkit/monorepo/commit/a918a93d3d57f69c93c963da1b2710a3467a1b19) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Design changes

## 0.0.7

### Patch Changes

- [#32](https://github.com/bpmnkit/monorepo/pull/32) [`1120205`](https://github.com/bpmnkit/monorepo/commit/11202057baaf25f9a29c9a3a90b1f1f1fc002b64) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Operate and CLI improvements

## 0.0.6

### Patch Changes

- [#30](https://github.com/bpmnkit/monorepo/pull/30) [`42ddd02`](https://github.com/bpmnkit/monorepo/commit/42ddd0255759ce35a14533cbc7667542ba9dac2e) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Operate, CLI, api

## 0.0.5

### Patch Changes

- [#28](https://github.com/bpmnkit/monorepo/pull/28) [`42455c0`](https://github.com/bpmnkit/monorepo/commit/42455c00033f3526a5cffdd0f68b973a5d556fec) Thanks [@urbanisierung](https://github.com/urbanisierung)! - SDK improvements, operate, editor UX improvements

## 0.0.4

### Patch Changes

- [#26](https://github.com/bpmnkit/monorepo/pull/26) [`454f119`](https://github.com/bpmnkit/monorepo/commit/454f1192d919ad0397f2e1d2f24de5acb1a38156) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Docs, Logo, AI improvements

## 0.0.3

### Patch Changes

- [`ee1610b`](https://github.com/bpmnkit/monorepo/commit/ee1610b2c310e8ae9e063632a53479656309920a) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Fix package.json

## 0.0.2

### Patch Changes

- [#22](https://github.com/bpmnkit/monorepo/pull/22) [`7470bd9`](https://github.com/bpmnkit/monorepo/commit/7470bd92c37b13ab9895a784ae667e933aa4b072) Thanks [@urbanisierung](https://github.com/urbanisierung)! - First ready features.
