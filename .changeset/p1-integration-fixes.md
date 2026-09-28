---
"@bpmnkit/core": patch
---

- `deploy/message-catch-no-correlation` accepts a correlation key on the referenced
  `bpmn:message`'s `zeebe:subscription`, where Camunda reads it and Camunda Modeler and
  `applyTemplateToElement` write it. It used to flag every such catch.
- Variable-flow analysis takes FEEL's built-in names from `@bpmnkit/feel`, so newer
  built-ins such as `is empty`, `partition` or `fromAi` are no longer reported as undefined
  variables.
- The bpmnlint rules `no-implicit-split` and `superfluous-label` recognise a default flow on
  an activity, and now match bpmnlint exactly.
