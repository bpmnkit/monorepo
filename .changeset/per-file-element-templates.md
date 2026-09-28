---
"@bpmnkit/plugins": minor
"@bpmnkit/proxy": minor
"@bpmnkit/cli": minor
"bpmnkit": minor
---

Element templates now resolve per diagram, the way Camunda Desktop Modeler does: a diagram sees the `.camunda/element-templates/` folders from its own folder up to the project root, the nearest winning, and never a sibling folder's.

- `@bpmnkit/plugins`: `createConnectorCatalogPlugin` takes a `diagramPath` option and gains `setDiagramPath(path)` and `setWorkspaceTemplates(templates)`. Switching diagrams unregisters the previous diagram's templates first, and the plugin's workspace templates are also unregistered on uninstall. `createConfigPanelBpmnPlugin` gains `unregisterTemplate(id)`, which brings back a bundled template the removed one shadowed. `TemplateRegistrar` gains an optional `unregisterTemplate`. Registering a template whose id is already in the connector picker now updates its label.
- `@bpmnkit/proxy`: `GET /element-templates?root=<dir>&file=<path>` returns only the templates that apply to that diagram. `file` must lie inside `root`, and `configFolder` must be a single folder name. `?root=` alone is unchanged.
- `@bpmnkit/cli`: `casen lint` and the `casen dev` checks check a connector task's required inputs against the diagram's own templates as well as the bundled catalogue. The search stops at the current directory for `casen lint` and at the served folder for `casen dev`.
- VS Code: the Problems panel checks connector inputs against the file's own templates too, with the workspace folder as the root.
