# @bpmnkit/connectors — Installation

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

---
Source: https://bpmnkit.com/docs/packages/connectors
