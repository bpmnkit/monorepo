# Conformance — Linting — bpmnlint compatibility

`casen lint` and the VS Code extension read a project's `.bpmnlintrc`. All 28 of bpmnlint's
built-in rules map onto BPMN Kit findings: 21 exactly and 7 approximately. Six of the seven
differ mainly because BPMN Kit's flow and naming checks look only at the top level, not
inside sub-processes. When the project has bpmnlint installed, that bpmnlint runs the
configuration itself, so `bpmnlint-plugin-*` rules work too.
[bpmnlint Compatibility](/docs/guides/bpmnlint) has the rule-by-rule table. On the 16 `.bpmn`
files in this repository under `bpmnlint:all`, every rule marked exact reports the same
elements as bpmnlint.

---
Source: https://bpmnkit.com/docs/getting-started/conformance
