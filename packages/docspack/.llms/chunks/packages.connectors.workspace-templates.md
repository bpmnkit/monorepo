# @bpmnkit/connectors — Workspace templates

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

---
Source: https://bpmnkit.com/docs/packages/connectors
