# Conformance — BPMN Model Interchange (MIWG)

The [OMG BPMN Model Interchange Working Group test suite](https://github.com/bpmn-miwg/bpmn-miwg-test-suite)
is how BPMN tools show they can read and write each other's files. Its reference models
cover layout (`A.*`), the descriptive and analytic conformance classes (`B.*`) and complex
real-world scenarios (`C.*`). They were exported by Trisotech, Signavio, W4, BOC, itp commerce
and others, so they carry each vendor's namespaces, label styles and optional attributes.

All 22 reference models are part of the round-trip corpus (suite commit `2ff82d4`,
2026-09-21) and are checked on every build:

| Check | Result |
|---|---|
| Import (parse) | 22 / 22 |
| Export re-imports to the same model | 22 / 22 |
| Export is a fixed point (a second round trip changes nothing) | 22 / 22 |
| Semantic content preserved | 22 / 22, apart from attributes on `<documentation>` (2 models) |
| Diagram interchange preserved (bounds, waypoints, label styles, vendor DI attributes) | 22 / 22 |
| `exportPreserving` of an unchanged model is byte-identical | 22 / 22 |

What a plain export changes is listed per model in `ALLOWED` in
`packages/core/tests/roundtrip-corpus.test.ts`:
- `false` defaults such as `isForCompensation="false"` are not written back;
- an empty `<extensionElements/>` is not written back;
- the `id` and `textFormat` attributes of `<documentation>` are lost.

That last one is the only loss of content. The comparison is keyed by namespace, so
`<process>`, `<semantic:process>` and `<bpmn:process>` count as the same element.

Running the suite found seven models BPMN Kit could not open and several losses, all fixed
before these results were recorded:
- DI elements without the optional `id` or `bpmnElement` would not parse;
- a document with BPMN as its default namespace was written back as invalid XML;
- a default flow on an activity was dropped;
- so were documentation on sequence flows, the name of `<definitions>` and of a
  collaboration, and empty timer and condition expressions;
- extensions on data associations and label styles were lost.

The results are BPMN Kit's own run of the suite's models, not a submission to the MIWG, which
publishes vendor-submitted results separately.

---
Source: https://bpmnkit.com/docs/getting-started/conformance
