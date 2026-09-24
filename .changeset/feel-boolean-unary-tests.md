---
"@bpmnkit/feel": patch
---

A boolean literal in a unary test now compares with a boolean input, as Camunda documents ("the input value is equal to that value"): the input entry `true` no longer matches `false`, and `false` now matches `false`. Tests that read `?` are unchanged. A variable named like a built-in (`count`, `sum`) now resolves to the variable; calls such as `count(xs)` still reach the built-in.
