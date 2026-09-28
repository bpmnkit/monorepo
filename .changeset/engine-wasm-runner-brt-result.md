---
"@bpmnkit/engine": patch
---

`runScenarioWasm` fills in a business rule task's result variable from its own DMN evaluation also when Reebe left the variable `null`, not only when Reebe left it out. Reebe now applies a business rule task's output mappings, including the one the runner adds for the result variable, so a decision Reebe could not evaluate gives `null` instead of no variable. This is a patch: scenario results stay as they were.
