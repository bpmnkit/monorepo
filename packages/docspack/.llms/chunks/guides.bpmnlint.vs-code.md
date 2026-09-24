# bpmnlint Compatibility — VS Code

The Problems panel honours the same file, found the same way. A finding from real bpmnlint
shows `bpmnlint` as its source and the rule as its code. A finding BPMN Kit reports under a
bpmnlint rule has the rule name at the end of its message. If some configured rules could not
be applied, one information-level problem at the top of the file lists them. A broken
`.bpmnlintrc` shows as an error there too.

Editing a `.bpmnlintrc` re-analyses the open diagrams. Set `bpmnkit.lint.bpmnlintrc` to
`false` to ignore the file. Only diagrams saved on disk are checked against a `.bpmnlintrc`,
because an untitled buffer has no folder.

---
Source: https://bpmnkit.com/docs/guides/bpmnlint
