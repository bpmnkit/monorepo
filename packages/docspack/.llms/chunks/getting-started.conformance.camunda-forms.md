# Conformance — Camunda Forms

Camunda form JSON at schema version 16, with 22 component types: text, text field, text area,
number, date/time, select, radio, checkbox, checklist, tag list, group, dynamic list, table,
image, document preview, iframe, HTML, expression, file picker, button, separator and spacer.


## Known gaps, in one list

- Choreography and conversation diagrams
- Camunda 7 extensions (preserved, not modelled; `casen migrate c7` converts them to Camunda 8)
- DMN boxed expressions and literal-expression decisions
- TS simulator: conditional events, message start events of a top-level process, transaction
  cancel events, compensation event sub-processes, inclusive and complex joins (they do not
  wait), complex gateway activation conditions, and inner activities of ad-hoc sub-processes
- Reebe: complex gateway, ad-hoc sub-process, single-node only, no published comparison with
  Zeebe

Found something this page gets wrong? [Open an issue](https://github.com/bpmnkit/monorepo/issues).

---
Source: https://bpmnkit.com/docs/getting-started/conformance
