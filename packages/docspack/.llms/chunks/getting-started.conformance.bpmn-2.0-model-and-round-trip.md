# Conformance — BPMN 2.0 — model and round trip

`@bpmnkit/core` parses and writes BPMN 2.0 XML. Coverage is measured against the BPMN, BPMN DI
and Zeebe moddle descriptors vendored into the repository, which list every type the
standard and Camunda 8 define (151 in total):

| Status | Types | Meaning |
|---|---|---|
| Modelled | 109 | Parsed into typed objects and written back |
| Preserved | 34 | Not modelled, but kept verbatim on round trip |
| Dropped | 6 | Lost on round trip — see below |
| Unprobed | 2 | Not reachable from `bpmn:definitions` |

The dropped types are the data-association internals (`Assignment`, `DataAssociation`,
`FormalExpression` inside one, `DataState`, `ItemAwareElement`) and `ImplicitThrowEvent`. The
`packages/core/tests/descriptor-coverage.test.ts` gate fails the build if a new type would be
dropped silently; `pnpm --filter @bpmnkit/core check:descriptors` prints the full report.

[Round-trip fidelity](/docs/getting-started/concepts#round-trip-fidelity) lists the
deliberate normalisations and the children that are still not preserved.

---
Source: https://bpmnkit.com/docs/getting-started/conformance
