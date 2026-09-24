# bpmnlint Compatibility — Rule mapping (2)

`bpmnlint:recommended`, `bpmnlint:all` and `bpmnlint:correctness` expand to bpmnlint 11.14's
presets. Rule names are normalised the way bpmnlint normalises them, so
`bpmnlint/label-required` and `label-required` are the same rule.

Rules that have no equivalent without bpmnlint installed:

- **Plugin rules and configs.** Everything from `bpmnlint-plugin-*`, including
  `bpmnlint-plugin-camunda-compat`. Install bpmnlint in the project and they run.
- **Unknown rule names.** These are reported as unknown, the same as bpmnlint would report
  them.

Where the native equivalents check connections, they read the sequence flows, not the
`<bpmn:incoming>`/`<bpmn:outgoing>` children. Real bpmnlint reads the children. For files a
modeler wrote, the two are the same. For hand-written XML that leaves the children out,
bpmnlint sees no connections at all, and BPMN Kit sees the flows.

---
Source: https://bpmnkit.com/docs/guides/bpmnlint
