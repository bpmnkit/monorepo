# @bpmnkit/connectors

## 0.1.1

### Patch Changes

- Updated dependencies [8fdc6d4]
  - @bpmnkit/core@0.4.0

## 0.1.0

### Minor Changes

- 1d2ec66: Element templates by convention — a project's own connectors reach the tools.

  `@bpmnkit/connectors` could parse the Zeebe element-template schema but only ever loaded its
  own generated catalogue, so a team's in-house connectors could not reach the editor at all.
  Now they can:
  - **`@bpmnkit/connectors/node`** — `discoverElementTemplates({ from, root, configFolder })`
    walks up from a diagram to the project root collecting `.camunda/element-templates/*.json`,
    nearest last so a template beside the diagram overrides one at the root, which overrides the
    bundle. `collectElementTemplates({ root })` is the opposite walk, for checking a whole
    project. The filesystem half sits behind its own entry point so the main package stays
    importable in a browser.
  - **`validateElementTemplate` / `readTemplateDocument`** — structural validation with paths
    (`properties[3].binding.type`) rather than a JSON-schema engine's `oneOf` noise. Every
    problem is reported at once, a file that fails is named and skipped rather than silently
    dropped, and one bad template never costs the good ones beside it. A separate `warnings`
    channel flags a binding the schema allows that `applyElementTemplate` does not write yet.
  - **`registerElementTemplates` / `clearRegisteredTemplates`** — merge templates into the
    catalogue, later registration winning on an id collision, so `listConnectors`, `getTemplate`
    and `searchConnectors` see a project's own.
  - **`casen connector validate [path]`** — validates a whole project (scanning downward, so a
    template beside a sub-folder's diagrams is checked too) or a single `.json` file, with
    `--format json` and a non-zero exit for CI. `list`, `search` and `show` now include the
    project's templates, with `--workspace` and `--config-folder`.
  - **`GET /element-templates?root=…`** on the proxy, and `workspaceRoot` / `workspaceTemplates`
    on the connector-catalog plugin — the browser path, where the host supplies templates rather
    than reaching for a filesystem.

  `TemplateBinding` also gains `bpmn:Message#property`,
  `bpmn:Message#zeebe:subscription#property` and `zeebe:linkedResource`. The bundled catalogue
  uses all three across 98 properties; the union did not admit them, and `applyElementTemplate`
  still does not write them — which is now what the new warning says out loud.

### Patch Changes

- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
  - @bpmnkit/core@0.3.0

## 0.0.3

### Patch Changes

- Updated dependencies [00a65f5]
  - @bpmnkit/core@0.2.0

## 0.0.2

### Patch Changes

- 9cd1942: Improvements around AI integration
- Updated dependencies [9cd1942]
  - @bpmnkit/core@0.1.2
  - @bpmnkit/feel@0.0.20
