# Conformance

This page says how much of each standard BPMN Kit implements, and how that was checked. Where
there is a public test suite the number comes from it. Where there is not, the page lists what
is supported and what is missing, and links to the test that enforces it. Everything below
describes the current `main` branch.


## FEEL — 94.5% of the DMN TCK, 375 of 378 Camunda examples

`@bpmnkit/feel` passes **1,941 of the 2,053 FEEL test cases** in the
[DMN Technology Compatibility Kit](https://dmn-tck.github.io/tck/).

- The cases are extracted from a checkout of the TCK by
  `packages/feel/tasks/extract-tck-tests.mjs` and run by `packages/feel/tests/tck.test.ts`.
- The [DMN TCK workflow](https://github.com/bpmnkit/monorepo/actions/workflows/dmn-tck.yml)
  runs them against the latest TCK every Monday.
- The 112 cases that do not pass are listed in `KNOWN_FAILURES` in that test file, each with
  its reason. The run fails if a listed case starts passing, so the list cannot go stale.

The TCK's own [results table](https://dmn-tck.github.io/tck/) scores whole DMN engines across
every test, not only the FEEL cases. The figure above is not directly comparable with it, and
BPMN Kit has not submitted results.

**Camunda 8.** Zeebe evaluates FEEL with Camunda's own engine, which adds built-ins and
behaviour DMN does not define (`assert`, `partition`, `context put` with a key path, `to json`,
`fromAi`, …). There is no test suite for that dialect, so the measure is Camunda's
documentation: `@bpmnkit/feel` matches **375 of the 378 worked examples** in the FEEL pages of
the Camunda 8 docs.

- `packages/feel/tests/camunda-parity.test.ts` reads the examples from
  `@bpmnkit/camunda-docspack` at test time, evaluates each one, and compares the result with
  the documented one. It runs with the package's normal tests.
- Examples that cannot run standalone — signatures, results written in prose, anything that
  reads the clock — are skipped. `node packages/feel/tasks/extract-camunda-examples.mjs
  --skipped` lists each one with its reason.
- The three that differ are in `KNOWN_DIFFERENCES` in that file, and on the
  [FEEL page](/docs/packages/feel#camunda-parity): `round up` without a scale (twice), and
  moving a date and time without a zone into another zone.
- Camunda fails an evaluation that errors. This package returns `null`, as DMN specifies.

---
Source: https://bpmnkit.com/docs/getting-started/conformance
