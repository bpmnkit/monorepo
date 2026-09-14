# Stability and Versioning — Support window

Fixes land on the **latest minor of the current major**. When a new major ships, the previous
major gets security fixes for **six months**; other fixes require an upgrade.

Security issues should be reported through
[GitHub](https://github.com/bpmnkit/monorepo/issues) rather than in a public pull request.


## Which packages this covers

A package is covered by this page once it is at **1.0.0 or above**, and not before. The
distinction is deliberate: several packages are published, useful, and not yet ready to freeze
an API — shipping them as 1.0 to make the list tidy would be a promise the project could not
keep.

To reach 1.0.0 a package needs an API worth defending for a year, a test suite that would
catch its own breakage, and a documentation page. Check any package's current version on
[npm](https://www.npmjs.com/org/bpmnkit) — the number is the answer.

---
Source: https://bpmnkit.com/docs/getting-started/stability
