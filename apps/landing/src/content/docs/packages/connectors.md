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
