---
"@bpmnkit/connectors": minor
---

Apply inbound-connector and linked-resource element templates.

- `applyTemplateToElement(definitions, elementId, template, values)` writes a template onto an
  element of a parsed model: the root `bpmn:message` an event or receive task references
  (created, reused by name, or renamed in place), that message's `zeebe:subscription`
  correlation key, `zeebe:properties` (`inbound.type` and the rest), `zeebe:linkedResources`,
  the element type and message event definition `elementType` asks for, and the
  `zeebe:modelerTemplate` stamps. Deterministic and idempotent; the input is never mutated. A
  generated message name is derived from the template and element ids.
- `applyElementTemplate` now returns `messageName` / `correlationKey` on inbound intermediate and
  boundary results (and `messageName` on start events), and reports — rather than drops — the
  bindings builder options cannot carry.
- `propertyKey` gives these properties keys: `message.name`, `message.correlationKey`,
  `linkedResource.<linkName>.<property>`.
- `validateElementTemplate` no longer warns about `bpmn:Message#property`,
  `bpmn:Message#zeebe:subscription#property` or `zeebe:linkedResource`; it warns about an
  `elementType.eventDefinition` other than `bpmn:MessageEventDefinition` instead.
- A condition comparing a Boolean property against `true`/`false` now matches.
