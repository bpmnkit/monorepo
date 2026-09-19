# Stability and Versioning — Versions are per package, not per repo

Packages version independently. `@bpmnkit/core` reaching 2.0.0 does not make
`@bpmnkit/canvas` 2.0.0, and the two can sit many majors apart.

Sibling dependencies are declared as carets, so `@bpmnkit/plugins` depending on
`^1.2.0` of `@bpmnkit/core` resolves to one shared copy alongside your own `^1.4.0`.
Two copies of `@bpmnkit/core` in one tree is not a duplicate of one copy — class identity,
`instanceof` and module-level registries all stop matching across the seam — so keep BPMN Kit
packages within one major of each other.

Releases are cut by [Changesets](https://github.com/changesets/changesets). Every change that
reaches npm has a changeset naming its packages and its bump, and lands in that package's
`CHANGELOG.md`.

---
Source: https://bpmnkit.com/docs/getting-started/stability
