# Changelog

## 0.1.0

First release.

- Read-only custom editors for `.bpmn`, `.dmn` and `.form`, rendered by `@bpmnkit/canvas`
  with no bpmn.io dependency. Minimap and zoom controls for BPMN.
- The preview follows the open buffer as it is typed, and keeps the last drawing that
  parsed when the file is momentarily invalid.
- Visual BPMN diff against `HEAD` from the Source Control panel, and between any two
  selected `.bpmn` files from the Explorer. Added, removed, changed and moved elements are
  marked on synchronised canvases.
- Static analysis in the Problems panel, placed on the element that caused each finding.
  Camunda 8 deployability rules are applied only to diagrams that declare an execution
  platform, unless `bpmnkit.lint.forceEngineRules` says otherwise.
- Colours follow the active VS Code theme, and fall back to the BPMN Kit palette when a
  theme does not define one.
