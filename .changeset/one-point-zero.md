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

Nothing about them changes in this release. A 1.0.0 is not a rewrite, it is a commitment: from
here, `^1` means an upgrade will not move your code, and anything that would — a removed
export, a narrowed return type, a generated document whose `semanticHash` shifts for the same
input — waits for a 2.0.

The bar was three things: a test suite that would catch the package's own breakage, a
documentation page, and an API worth defending for a year. Twelve of the twenty-six published
packages clear it. The other fourteen stay on 0.x deliberately — most are short of the first
two conditions, and the rest are worked examples, scaffolders or generated builds with no API
of their own to freeze. Joining later costs nothing, since 0.x → 1.0 breaks no one, so the bar
was applied strictly rather than generously.

Membership is not only prose: it lives in `STABLE` in `scripts/published-packages.mjs`, and
`check-packages.mjs` enforces both directions — nothing on the list may lack tests or a
documentation page, and nothing at 1.0.0 or above may be missing from the list, so a major
cannot arrive by accident.

Shipping alongside, because the promise would be hollow without them: documentation pages for
`@bpmnkit/plugins`, `@bpmnkit/feel`, `@bpmnkit/connectors` and `@bpmnkit/ascii`, which had
none; `engines.node` on every package in the set, which only two declared; and a correction to
`@bpmnkit/feel`'s README, whose Quick Start could not run — `evaluate` takes an `EvalContext`,
not a bare object, and `highlightFeel` returns HTML rather than tokens.
