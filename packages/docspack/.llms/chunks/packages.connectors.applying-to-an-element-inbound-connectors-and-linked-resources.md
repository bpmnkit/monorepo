# @bpmnkit/connectors — Applying to an element — inbound connectors and linked resources

An inbound connector does not live on its element alone. Its message name and correlation key
belong to a root `bpmn:message` the event references, and an RPA task's scripts to
`zeebe:linkedResources`. `applyTemplateToElement` writes a template onto an element of a parsed
model, all of it:

```typescript
import { applyTemplateToElement, getTemplate } from "@bpmnkit/connectors";
import { Bpmn } from "@bpmnkit/core";

const webhook = getTemplate("io.camunda.connectors.webhook.WebhookConnectorIntermediate.v1")!;
const { definitions, problems } = applyTemplateToElement(
  Bpmn.parse(xml),
  "payment-received",
  webhook,
  {
    "inbound.context": "payments",
    "message.correlationKey": "=orderId",
    correlationKeyExpression: "=request.body.orderId",
  },
);

Bpmn.export(definitions);
// <bpmn:message id="Message_…" name="…">
//   <bpmn:extensionElements>
//     <zeebe:subscription correlationKey="=orderId" />
//   </bpmn:extensionElements>
// </bpmn:message>
// <bpmn:intermediateCatchEvent id="payment-received"
//     zeebe:modelerTemplate="io.camunda.connectors.webhook.WebhookConnectorIntermediate.v1" …>
//   <bpmn:extensionElements>
//     <zeebe:properties>
//       <zeebe:property name="inbound.type" value="io.camunda:webhook:1" /> …
//   <bpmn:messageEventDefinition messageRef="Message_…" />
```

What it does, binding by binding:

| Binding | Written to |
|---|---|
| `bpmn:Message#property` (`name`) | The root `bpmn:message` the event definition or receive task references |
| `bpmn:Message#zeebe:subscription#property` (`correlationKey`) | That message's `zeebe:subscription` — where Camunda reads it. A copy on the event itself is removed |
| `zeebe:property` (`inbound.type`, …) | The element's `zeebe:properties` |
| `zeebe:linkedResource` | The element's `zeebe:linkedResources`, one `zeebe:linkedResource` per `linkName` |
| everything else | As `applyElementTemplate` resolves it, on the element |

- **The element's type follows the template.** `elementType` converts the element, keeping its
  id, name and flows; `elementType.eventDefinition` makes an event a message event. A template
  whose `appliesTo` does not cover the element is refused and the model comes back unchanged —
  `bpmn:Task` covers every task type, as it does in the Modeler.
- **Messages are reused, not multiplied.** A message already carrying the name is referenced; the
  element's own message is renamed when nothing else uses it; otherwise a new one is created.
- **A generated message name is deterministic.** Camunda generates an inbound message's name as
  a UUID. Here it keeps the name of the message the element already references, or is derived
  from the template and element ids — never from a clock or random source.
- **Re-applying is safe.** Each extension kind the template declares is replaced whole, so
  switching a dropdown off removes what it wrote, and applying twice gives the model applying
  once does. `zeebe:modelerTemplate`, `…Version` and `…Icon` are stamped the same way.
- **The input is never mutated.** The result is a copy.

The keys for these properties, where the template gives no `id`, are `message.name`,
`message.correlationKey` and `linkedResource.<linkName>.<property>` — for example
`linkedResource.RPAScript.resourceId`. `listConnectors` reports them like any other input.

---
Source: https://bpmnkit.com/docs/packages/connectors
