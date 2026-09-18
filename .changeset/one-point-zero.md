---
"@bpmnkit/connector-gen": major
"@bpmnkit/connectors": major
"@bpmnkit/docspack": major
"@bpmnkit/plugins": major
"@bpmnkit/canvas": major
"@bpmnkit/editor": major
"@bpmnkit/engine": major
"@bpmnkit/ascii": major
"@bpmnkit/core": major
"@bpmnkit/feel": major
"@bpmnkit/api": major
"@bpmnkit/cli": major
---

**1.0.0.** These twelve packages now carry the stability promise at
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
  enumerate the 87 built-in functions without reaching into `dist/`.
- Documentation pages for `@bpmnkit/plugins`, `@bpmnkit/feel`, `@bpmnkit/connectors` and
  `@bpmnkit/ascii`, which had none.
- `engines.node` on every package in the set; only two declared one before.
