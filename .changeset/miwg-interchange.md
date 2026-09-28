---
"@bpmnkit/core": minor
---

Opens and round-trips all 22 OMG BPMN Model Interchange (MIWG) reference models.

- **Parses DI elements that omit the optional `id` or `bpmnElement`** — seven reference
  models failed to open. An absent one reads as `""` and is written back absent.
- **Writes a document whose default namespace is BPMN with unprefixed names.** It used to
  write `<:process>`, which is not XML.
- **Keeps** a default flow on an activity, the `name` of `<definitions>` and of a
  collaboration (new `BpmnCollaboration.name`), documentation and unknown children on
  sequence flows (new `BpmnSequenceFlow.documentation` / `unknownChildren`), documentation and
  extensions on data associations, the `id` of a multi-instance loop, empty timer parts and
  conditions (new `BpmnConditionalEventDefinition.conditionAttributes`), and diagram
  interchange from other tools: label styles, and attributes on diagrams, planes, labels and
  waypoints (new optional `unknownAttributes` / `unknownChildren` on the DI types).
- **`exportPreserving`** keeps a number's original spelling (`30.0`) and empty elements such
  as `<extensionElements/>` when re-reading proves the model unchanged. `preserveFormatting`
  gains the `equalNumbers` and `droppedEmptyElements` options behind this.
- **`reconcileCompact`** treats an empty flow label or condition as none, instead of deleting
  and re-adding the flow and losing its extensions.
