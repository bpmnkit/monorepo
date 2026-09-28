# VS Code Extension — What it does — Findings in the Problems panel

The same static analysis `casen lint` runs — flow reachability, naming, FEEL syntax, data
flow, Camunda 8 deployability — reported against the element that caused it, so clicking a
problem takes you to the tag rather than to line 1.

The analysis matches the file. A diagram that declares no `modeler:executionPlatform` is not
judged against Camunda 8 deployability, because "this service task has no
`zeebe:taskDefinition`" is not a defect in a diagram that was never going to be deployed to
Zeebe. Turn on `bpmnkit.lint.forceEngineRules` to apply those rules anyway.

A `.bpmnlintrc` in the diagram's folder or above is honoured the way `casen lint` honours it.
When the workspace has `bpmnlint` installed, bpmnlint's own findings, plugin rules included,
appear with source `bpmnlint`. See [bpmnlint Compatibility](/docs/guides/bpmnlint).

A connector task's required inputs are checked against the element templates **this file**
sees: `.camunda/element-templates/` in the diagram's folder and every folder above it up to the
workspace folder, the nearest winning on an id, then the bundled Camunda templates. A diagram in
`a/` is never checked against `b/`'s templates. The extension host reads them itself; no proxy
is needed. An unsaved file has no folder, so only the bundled templates apply. See
[workspace templates](/docs/packages/connectors#workspace-templates).

---
Source: https://bpmnkit.com/docs/guides/vscode
