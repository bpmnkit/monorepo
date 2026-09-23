# Conformance

This page says how much of each standard BPMN Kit implements, and how that was checked. Where
there is a public test suite the number comes from it. Where there is not, the page lists what
is supported and what is missing, and links to the test that enforces it. Everything below
describes the current `main` branch.


## FEEL — 94.4% of the DMN TCK

`@bpmnkit/feel` passes **1,939 of the 2,053 FEEL test cases** in the
[DMN Technology Compatibility Kit](https://dmn-tck.github.io/tck/).

- The cases are extracted from a checkout of the TCK by
  `packages/feel/tasks/extract-tck-tests.mjs` and run by `packages/feel/tests/tck.test.ts`.
- The [DMN TCK workflow](https://github.com/bpmnkit/monorepo/actions/workflows/dmn-tck.yml)
  runs them against the latest TCK every Monday.
- The 114 cases that do not pass are listed in `KNOWN_FAILURES` in that test file, each with
  its reason. The run fails if a listed case starts passing, so the list cannot go stale.

The TCK's own [results table](https://dmn-tck.github.io/tck/) scores whole DMN engines across
every test, not only the FEEL cases. The figure above is not directly comparable with it, and
BPMN Kit has not submitted results.

---
Source: https://bpmnkit.com/docs/getting-started/conformance
