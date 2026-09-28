# Conformance — Linting — bpmnlint compatibility

`casen lint` and the VS Code extension read a project's `.bpmnlintrc`. All 28 of bpmnlint's
built-in rules map onto BPMN Kit findings exactly, in the top-level process and inside every
kind of sub-process. When the project has bpmnlint installed, that bpmnlint runs the
configuration itself, so `bpmnlint-plugin-*` rules work too.
[bpmnlint Compatibility](/docs/guides/bpmnlint) has the rule-by-rule table. On the 43 `.bpmn`
files in this repository under `bpmnlint:all`, the MIWG models included, every rule reports the
same elements as bpmnlint. A test checks this on every run.

---
Source: https://bpmnkit.com/docs/getting-started/conformance
