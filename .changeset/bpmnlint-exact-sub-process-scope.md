---
"@bpmnkit/core": patch
---

All 28 bpmnlint built-in rules now report exactly the elements bpmnlint reports. The seven
that were approximate (`conditional-flows`, `fake-join`, `label-required`,
`no-gateway-join-fork`, `no-implicit-end`, `no-implicit-start` and `superfluous-gateway`)
now check inside embedded, event and ad-hoc sub-processes and transactions, and apply
bpmnlint's exemptions: link events, compensation handlers and boundary events, event
sub-processes, the contents of ad-hoc sub-processes, data objects and data stores.

A patch, because it fixes the compatibility layer to do what its documentation promises. The
default `casen lint` report does not change: the new native checks
(`feel/missing-condition`, `naming/missing-label`, `flow/implicit-end`, `flow/implicit-start`,
and `flow/multi-incoming-task`, `flow/mixed-gateway` and `flow/redundant-gateway` inside
sub-processes) run only when a `.bpmnlintrc` enables their rule. While a config sets
`conditional-flows`, `label-required`, `no-implicit-end` or `no-implicit-start`, the native
check replaces BPMN Kit's own finding for that concern (`feel/empty-condition`, the
`naming/unlabeled-*`, `naming/split-gateway-no-label` and `naming/missing-flow-condition`
findings, `flow/dead-end`, `flow/unreachable`), which looks at a different set of elements.
`BpmnlintRuleMapping` gains an optional `replaces` field that lists them.

A test now runs real bpmnlint beside BPMN Kit under `bpmnlint:all` on every `.bpmn` file in
the repository (43, the MIWG models included) and requires the same elements for every rule.
