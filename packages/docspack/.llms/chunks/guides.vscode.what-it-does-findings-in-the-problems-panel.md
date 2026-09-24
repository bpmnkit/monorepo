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

---
Source: https://bpmnkit.com/docs/guides/vscode
