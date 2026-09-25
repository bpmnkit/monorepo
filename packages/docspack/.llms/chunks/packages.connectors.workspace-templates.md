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

The previous diagram's templates are unregistered before the next diagram's are registered, and
a bundled template they shadowed comes back, so the properties panel's connector picker lists
only the current diagram's templates plus the bundled and built-in ones. A host that resolves
templates itself (with its own filesystem access) passes them with
`catalog.setWorkspaceTemplates(templates)` instead. Without `diagramPath`, `workspaceRoot` keeps
the project-wide merge (`GET /element-templates?root=…`).

---
Source: https://bpmnkit.com/docs/packages/connectors
