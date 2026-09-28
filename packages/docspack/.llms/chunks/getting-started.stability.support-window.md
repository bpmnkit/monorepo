# Stability and Versioning — Support window

Fixes land on the **latest minor of the current major**. When a new major ships, the previous
major gets security fixes for **six months**; other fixes require an upgrade.

Security issues should be reported through
[GitHub](https://github.com/bpmnkit/monorepo/issues) rather than in a public pull request.


## Which packages this covers

A package is covered by this page once it is at **1.0.0 or above**, and not before. The
distinction is deliberate: several packages are published, useful, and not yet ready to freeze
an API — shipping them as 1.0 to make the list tidy would be a promise the project could not
keep. Joining later costs nothing, because going from 0.x to 1.0 breaks no one, so the bar is
applied strictly rather than generously.

Three conditions, all of which must hold:

1. **A test suite that would catch its own breakage.**
2. **A documentation page** on this site.
3. **An API worth defending for a year.**

**Twelve packages** meet them today and carry the promise:

| | |
|---|---|
| [`@bpmnkit/core`](/docs/packages/core) | [`@bpmnkit/feel`](/docs/packages/feel) |
| [`@bpmnkit/canvas`](/docs/packages/canvas) | [`@bpmnkit/editor`](/docs/packages/editor) |
| [`@bpmnkit/engine`](/docs/packages/engine) | [`@bpmnkit/plugins`](/docs/packages/plugins) |
| [`@bpmnkit/api`](/docs/packages/api) | [`@bpmnkit/ascii`](/docs/packages/ascii) |
| [`@bpmnkit/connectors`](/docs/packages/connectors) | [`@bpmnkit/connector-gen`](/docs/packages/connector-gen) |
| [`@bpmnkit/docspack`](/docs/packages/docspack) | [`@bpmnkit/cli`](/docs/cli/casen) |

The other sixteen published packages stay on 0.x on purpose, and make no semver promise;
their [tier](#product-tiers) says what they do promise. Most are
short of the first two conditions; the rest are worked examples, scaffolders, or generated
builds with no API of their own to freeze.

The membership is not only prose. It lives in `STABLE` in
[`scripts/published-packages.mjs`](https://github.com/bpmnkit/monorepo/blob/main/scripts/published-packages.mjs),
and the repo's own checks enforce both directions of it: nothing on the list may lack tests or
a documentation page, and nothing at 1.0.0 or above may be missing from the list. A major
version cannot arrive by accident.

Whatever this page says, a package's current version on
[npm](https://www.npmjs.com/org/bpmnkit) is the authoritative answer.

---
Source: https://bpmnkit.com/docs/getting-started/stability
