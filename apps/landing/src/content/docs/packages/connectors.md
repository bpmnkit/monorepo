---
title: "@bpmnkit/connectors"
description: The Camunda 8 connector catalog, with deterministic element-template application and validation.
sidebar:
  order: 9
---

## Overview

`@bpmnkit/connectors` answers two questions about Camunda 8 connectors: **which ones exist**,
and **what happens to a task when you apply one**.

It bundles the 116 out-of-the-box Camunda connector templates as data, so a catalog, a search
box or an AI tool call can work offline. And it resolves a template plus a set of values into
the `zeebe:taskDefinition`, `zeebe:ioMapping` and `zeebe:modelerTemplate` bookkeeping the
Modeler would write — deterministically, so the same template and values always produce the
same XML.

The package root is browser-safe. Everything that touches the filesystem lives behind
`@bpmnkit/connectors/node`.

## Installation

```sh
npm install @bpmnkit/connectors
```

## Browsing the catalog

```typescript
import { listConnectors, searchConnectors, getTemplate } from "@bpmnkit/connectors";

listConnectors().length;        // 116
searchConnectors("slack");      // 6 matches, inbound and outbound

const template = getTemplate("io.camunda.connectors.Slack.v1");
```

`listConnectors` and `searchConnectors` return `ConnectorSummary` — the shape a picker needs,
without the full template:

```typescript
interface ConnectorSummary {
  id: string;
  name: string;
  description?: string;
  taskType: string;              // e.g. "io.camunda:http-json:1"
  appliesTo: string[];           // e.g. ["bpmn:Task"]
  direction: ConnectorDirection; // "outbound" | "inbound"
  keywords: string[];
  requiredInputs: ConnectorInputSpec[];
  optionalInputs: ConnectorInputSpec[];
}
```

Each `ConnectorInputSpec` carries what a form needs to render the field — `label`,
`description`, `default`, `choices`, whether it is `isSecret` or `isFeel`, and the `condition`
that decides whether it applies at all. `summarizeTemplate` produces the same shape from a
template you hold yourself.

`CAMUNDA_CONNECTOR_TEMPLATES` is the raw bundled array if you would rather work with the
templates directly.

## Applying a template

Applying does not mutate an element. It turns a template plus your values into the **builder
options** for whichever element kind the template applies to, which you hand to
`@bpmnkit/core`:

```typescript
import { applyConnectorTemplate } from "@bpmnkit/connectors";
import { Bpmn } from "@bpmnkit/core";

const { serviceTask, problems } = applyConnectorTemplate("io.camunda.connectors.Slack.v1", {
  token: "=secrets.SLACK_TOKEN",
  "data.channel": "#alerts",
  "data.text": "=message",
});

// serviceTask = {
//   name: "Slack connector",
//   taskType: "io.camunda:slack:1",
//   ioMapping: { inputs: [...], outputs: [] },
//   modelerTemplate: "io.camunda.connectors.Slack.v1",
//   modelerTemplateVersion: "1",
//   modelerTemplateIcon: "data:image/svg+xml;utf8,...",
// }

Bpmn.createProcess("alerting").startEvent("in").serviceTask("notify", serviceTask).build();
```

`applyElementTemplate(template, values)` is the same operation against a template object
rather than a catalog id — the path a workspace template takes.

The result carries exactly one populated element key, so the template decides what it applies
to rather than the caller guessing:

```typescript
interface ApplyResult {
  serviceTask?: ServiceTaskOptions;
  adHocSubProcess?: Partial<AdHocSubProcessOptions>;
  startEvent?: Partial<StartEventOptions>;
  boundaryEvent?: Partial<BoundaryEventOptions>;
  intermediateEvent?: Partial<IntermediateCatchEventOptions>;
  problems: ApplyProblem[];
}
```

Nothing throws — "this value does not belong to this template" and "this required value is
missing" are answers a UI has to show, so they come back as `problems` alongside whatever
could be built:

```typescript
applyConnectorTemplate("io.camunda.connectors.Slack.v1", {}).problems;
// [{ key: "token", kind: "missing-required",
//    message: 'Missing required value for "OAuth token" (token)' }, …]

applyConnectorTemplate("nope.does.not.exist", {}).problems;
// [{ message: 'Unknown connector template "nope.does.not.exist"' }]
```

Application is deterministic: property order and the emitted bindings depend only on the
template and the values, never on iteration order or the clock. That is what lets a diagram be
rebuilt in CI and diffed.

Builder options have no field for some bindings. A message start event's correlation key and
`zeebe:linkedResource` come back as `problems` rather than being dropped, and an inbound
template's message name — which Camunda generates per element — must be passed as
`message.name`. To write every binding, apply to an element instead.

## Applying to an element — inbound connectors and linked resources

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

## Workspace templates

A project can ship its own `.camunda/element-templates/`. The filesystem half lives behind its
own entry point so importing the catalog in a browser never pulls in `node:fs`:

```typescript
import { discoverElementTemplates, collectElementTemplates } from "@bpmnkit/connectors/node";
```

- `discoverElementTemplates` walks **upward** from a diagram to the project root, nearest
  winning — the resolution a modeler needs.
- `collectElementTemplates` walks **downward** from a root — the sweep a CI check needs, so a
  broken template in a sub-folder is reported rather than skipped because the root looked fine.

`registerElementTemplates` merges what you found into the catalog, later registration winning
on an id collision, so `listConnectors`, `searchConnectors` and `getTemplate` then see a
project's own templates alongside the bundled ones. `clearRegisteredTemplates` undoes it.

### Which host resolves how

Per-file resolution is what Camunda Desktop Modeler does: a diagram in `a/` sees
`a/.camunda/element-templates/` and every folder above it up to the project root, and never
`b/`'s. When two folders define the same id, the one nearer the diagram wins.

| Host | Resolution |
|---|---|
| `casen lint`, `casen dev` checks | Per file. Each diagram's `connector/*` findings use the templates from its folder up to the project root (`casen lint`: the current directory; `casen dev`: the served folder), then the bundled catalog. |
| VS Code extension | Per file. The extension host calls `discoverElementTemplates` directly — no proxy — with the workspace folder as the root, and the Problems panel checks connector inputs against them. |
| Studio (project opened from disk) | Per file. The connector-catalog plugin asks the proxy for `GET /element-templates?root=<project>&file=<model path>` and swaps the set when you open another model. |
| `casen connector list/search/show` | Upward from the current directory. |
| `casen connector validate` | Downward: every template in the project (`collectElementTemplates`). |
| bpmnkit.com/editor, Drop | Bundled templates only. A browser with no filesystem has no path to resolve from. |

In a browser host, the [connector-catalog plugin](/docs/packages/plugins) does the swapping:

```typescript
const catalog = createConnectorCatalogPlugin(configPanelBpmn, palette, {
  proxyUrl: "http://localhost:3033",
  workspaceRoot: "/home/me/project",
  diagramPath: "processes/orders/order.bpmn", // absolute, or relative to workspaceRoot
});

// The user opened another diagram:
await catalog.setDiagramPath("processes/billing/invoice.bpmn");
```

The proxy serves `/element-templates` only for a `workspaceRoot` it accepts as a workspace: a
folder passed with `casen proxy start --root`, or a project folder that is not your home
directory, the filesystem root or a hidden folder. The diagram path must resolve inside that
root. See [Local proxy](/docs/cli/casen#local-proxy).

The previous diagram's templates are unregistered before the next diagram's are registered, and
a bundled template they shadowed comes back, so the properties panel's connector picker lists
only the current diagram's templates plus the bundled and built-in ones. A host that resolves
templates itself (with its own filesystem access) passes them with
`catalog.setWorkspaceTemplates(templates)` instead. Without `diagramPath`, `workspaceRoot` keeps
the project-wide merge (`GET /element-templates?root=…`).

## Validating a template

```typescript
import { validateElementTemplate } from "@bpmnkit/connectors";

validateElementTemplate(template);
// {
//   valid: false,
//   problems: [
//     { path: 'properties[0].type',
//       message: 'unknown property type "nope" — expected one of String, Text, Hidden, Dropdown, Boolean, Number' },
//     { path: 'properties[0].binding', message: 'binding is required' },
//   ],
//   warnings: [],
// }
```

Problems are reported by **path** rather than as a JSON-schema `oneOf` dump, and every problem
is collected rather than stopping at the first. Warnings are kept separate from problems, so a
CI gate can fail on one and not the other. `readTemplateDocument` parses a file that may hold
one template or an array of them.

The CLI wraps this as [`casen connector validate`](/docs/cli/connector), which exits non-zero
for CI and takes `--format json`.

## API Reference

| Export | Description |
|---|---|
| `listConnectors()` | Every connector in the catalog, as summaries |
| `searchConnectors(query)` | Summaries matching name, description or keywords |
| `getTemplate(id)` | The full `ElementTemplate` for an id |
| `summarizeTemplate(template)` | `ConnectorSummary` from a template you hold |
| `propertyKey(property)` | The variable name a template property binds to |
| `applyConnectorTemplate(id, values)` | Catalog template → builder options + problems |
| `applyElementTemplate(template, values)` | Template object → builder options + problems |
| `applyTemplateToElement(definitions, elementId, template, values)` | Template written onto an element of a parsed model → `{ definitions, problems }` |
| `validateElementTemplate(template)` | `{ valid, problems, warnings }` |
| `readTemplateDocument(text)` | Parse a file holding one template or many |
| `registerElementTemplates(templates)` | Merge templates into the catalog |
| `clearRegisteredTemplates()` | Drop everything registered |
| `CAMUNDA_CONNECTOR_TEMPLATES` | The 116 bundled templates, raw |

From `@bpmnkit/connectors/node`: `discoverElementTemplates`, `collectElementTemplates`,
`DEFAULT_CONFIG_FOLDER`, `TEMPLATES_SUBFOLDER`.

## Stability

`@bpmnkit/connectors` carries the [1.0 stability promise](/docs/getting-started/stability):
its exports will not change shape without a major version.

Two things the promise does **not** freeze, because both track Camunda rather than this
package:

- **The catalog's contents.** Connectors are added, and upstream templates gain versions and
  properties. A changed `CAMUNDA_CONNECTOR_TEMPLATES` is a minor; the types describing it are
  covered as usual.
- **Template validation being strict about new upstream shapes.** A template that validates
  today will not start failing in a minor — that direction *is* covered.
