# Changelog

## 0.3.0

- **Editing.** `.bpmn`, `.dmn` and `.form` are now edited, not only read. The editors are
  **text** custom editors backed by the same `TextDocument` a text editor opens, so dirty
  state, save, hot exit, undo and a concurrent text editor are VS Code's rather than
  reimplemented — and typing in the XML updates the diagram as you go. Set
  `bpmnkit.editing.enabled` to `false` for the same editors with editing switched off.
- **Test data from the repository.** Deploy-and-start offers the payloads it finds in
  `.camunda/payloads/*.json`, walking up from the diagram the way element templates do.
- **Detail cards in the connector picker.** Selecting a template shows what it binds and
  what it will ask for — including which fields read like credentials — before it is
  applied. The card's own button still applies straight away.
- The command **Open Preview to the Side** is now **Open Diagram to the Side**; its id is
  unchanged, so any keybinding still works.

## 0.2.0

- **Step-through simulation.** The BPMN preview runs the diagram through
  `@bpmnkit/engine` with token highlighting: Run, One Step, Cancel, live variables and a
  replay timeline. Entirely local — nothing is deployed.
- **FEEL playground**, opened as its own panel and pre-filled from the editor selection.
- **Deploy to Camunda 8**, and deploy-and-start with variables, against the clusters
  `casen` already knows about. Credentials are read to sign the request and nothing else.
- **Copy Diagram as ASCII**, dedented and fenced for pasting into a code review.
- Fixed: the simulator no longer offers a Tests tab a host cannot serve, and the FEEL
  playground brings its own stylesheet (both fixed in `@bpmnkit/plugins`).

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
