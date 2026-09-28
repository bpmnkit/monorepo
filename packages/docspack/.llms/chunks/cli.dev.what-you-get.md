# casen dev — What you get

- **A file list.** Every `.bpmn`, `.dmn` and `.form` file under the folder, with a green or red
  mark for its last check. Hidden directories, `node_modules`, `dist`, `build`, `target`,
  `coverage` and `out` are skipped.
- **The editor.** BPMN opens in the full diagram editor with in-canvas lint markers; DMN in the
  decision editor; forms in the form editor.
- **Simulation.** The Play button runs the diagram in the browser on `@bpmnkit/engine`, with
  tokens drawn on the elements they sit on. DMN files in the same folder are deployed with it,
  so business rule tasks evaluate.
- **Saving back to disk.** Edits are written about half a second after you stop, or at once with
  <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>S</kbd>. Each save is written into the file that is
  already there, keeping its indentation, attribute order and comments, and is only used if it
  reads back as the same model — the same writer as the [VS Code extension](/docs/guides/vscode),
  so moving a box changes the lines for that box, not the whole file.
- **Live reload.** Change a file anywhere else — your text editor, `git checkout`, a code
  generator — and the open diagram reloads. If you have unsaved edits in the browser at the same
  time, nothing is thrown away: you choose between reloading and overwriting.
- **Checks on every change.** Each changed BPMN file is linted exactly as
  `casen lint` would lint it (including a project `.bpmnlintrc`, and connector inputs checked
  against the element templates from the file's folder up to the served folder — see
  [workspace templates](/docs/packages/connectors#workspace-templates)), and the
  scenarios in its `<file>.bpmn.tests.json` sidecar are run as `casen test` runs them. Changing a
  `.dmn` file re-runs the scenarios of the processes beside it. Results appear in the browser's
  Checks panel and in the terminal.
- **Tests you can edit.** The Tests tab of Play mode reads and writes the same
  `.bpmn.tests.json` sidecar, so scenarios written in the browser are the ones `casen test` runs
  in CI.

---
Source: https://bpmnkit.com/docs/cli/dev
