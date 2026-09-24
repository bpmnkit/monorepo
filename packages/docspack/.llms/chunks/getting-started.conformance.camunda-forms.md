# Conformance — Camunda Forms

Camunda form JSON at schema version 16, with 22 component types: text, text field, text area,
number, date/time, select, radio, checkbox, checklist, tag list, group, dynamic list, table,
image, document preview, iframe, HTML, expression, file picker, button, separator and spacer.


## Known gaps, in one list

- Attributes on `<documentation>` (`id`, `textFormat`) are not preserved
- Choreography and conversation diagrams
- Camunda 7 extensions (preserved, not modelled)
- DMN boxed expressions and literal-expression decisions
- TS simulator: call activities, event sub-processes, event-based and complex gateways,
  signal / escalation / compensation / conditional / link events, multi-instance,
  message and non-interrupting boundary events
- Reebe: complex gateway, ad-hoc sub-process, single-node only, no published comparison with
  Zeebe

Found something this page gets wrong? [Open an issue](https://github.com/bpmnkit/monorepo/issues).

---
Source: https://bpmnkit.com/docs/getting-started/conformance
