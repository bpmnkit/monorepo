# Conformance — Zeebe extensions

Every `zeebe:` element in the vendored Zeebe descriptor is modelled or preserved, and 26 of
them are checked for placement — which BPMN element each may appear on — by
`packages/core/src/bpmn/zeebe-placement.ts`. That includes task definitions, IO mappings,
task headers, called decisions and elements, forms, user tasks, scripts, linked resources,
ad-hoc sub-process and AI agent settings, version tags, and execution and task listeners.

[Element templates](/docs/packages/connectors) (Camunda's connector template JSON) are applied
for outbound and inbound connectors. `applyTemplateToElement` writes the inbound bindings to
the element's message and its `zeebe:subscription` correlation key, where Camunda reads them,
and applies `zeebe:linkedResource` bindings.

Camunda 7 (`camunda:` extensions) is not supported: those attributes and elements are kept on
round trip but not modelled.

---
Source: https://bpmnkit.com/docs/getting-started/conformance
