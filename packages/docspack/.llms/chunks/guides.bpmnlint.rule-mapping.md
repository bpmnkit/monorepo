# bpmnlint Compatibility — Rule mapping

These are the 28 rules bpmnlint 11.14 ships. All 28 are **exact**: the rule has the same
semantics as bpmnlint's, and BPMN Kit reports the same elements, in the top-level process and
inside embedded, event and ad-hoc sub-processes and transactions. We check this with a test for
each rule, and with a test that runs both linters under `bpmnlint:all` against every `.bpmn`
file in the BPMN Kit repository. That corpus has 43 files: BPMN Kit's own samples and
fixtures, the OMG MIWG test models, and a fixture that puts each rule's violations and
exemptions inside every kind of sub-process. It is still a corpus, so treat it as evidence,
not proof. "Native" marks a check BPMN Kit added for this compatibility layer. It runs only
when your config enables the rule.

For four rules, BPMN Kit's own check looks at a different set of elements, so the native check
**replaces** it while your config sets the rule, at any level. For example, `flow/unreachable`
reports everything that cannot be reached from a start event, and bpmnlint's
`no-implicit-start` reports only elements without an incoming flow. Without a `.bpmnlintrc`,
`casen lint` reports BPMN Kit's own checks as before.

| bpmnlint rule | recommended | BPMN Kit finding | Match | Notes |
|---|---|---|---|---|
| `ad-hoc-sub-process` | error | `flow/ad-hoc-start-end-event` (native) | Exact | |
| `conditional-event` | — | `flow/conditional-event-no-condition` (native) | Exact | |
| `conditional-flows` | error | `feel/missing-condition` (native) | Exact | Replaces `feel/empty-condition`. |
| `end-event-required` | error | `flow/no-end-event`, `flow/sub-process-no-end-event` (native) | Exact | |
| `event-based-gateway` | error | `flow/event-gateway-invalid` (native) | Exact | |
| `event-sub-process-typed-start-event` | error | `flow/event-sub-process-untyped-start` (native) | Exact | |
| `fake-join` | warn | `flow/multi-incoming-task` (native inside sub-processes and for start events) | Exact | |
| `global` | warn | `pattern/global-element` (native) | Exact | Also reports a global element with no `name` attribute. bpmnlint only reports an empty name. |
| `label-required` | error | `naming/missing-label` (native) | Exact | Replaces `naming/unlabeled-task`, `naming/unlabeled-start-event`, `naming/unlabeled-end-event`, `naming/split-gateway-no-label` and `naming/missing-flow-condition`. Lanes are read from the process's first lane set, the one BPMN Kit models. |
| `link-event` | error | `flow/link-event-mismatch` (native) | Exact | |
| `no-bpmndi` | error | `pattern/missing-di` (native) | Exact | |
| `no-complex-gateway` | error | `pattern/complex-gateway` (native) | Exact | |
| `no-disconnected` | error | `flow/disconnected` (native) | Exact | |
| `no-duplicate-sequence-flows` | error | `flow/duplicate-sequence-flow` (native) | Exact | One finding for each duplicate flow, which names the flow, its source and its target. bpmnlint reports these three separately. |
| `no-gateway-join-fork` | error | `flow/mixed-gateway` (native inside sub-processes) | Exact | |
| `no-implicit-end` | error | `flow/implicit-end` (native) | Exact | Replaces `flow/dead-end`. |
| `no-implicit-split` | error | `flow/implicit-split` (native) | Exact | |
| `no-implicit-start` | error | `flow/implicit-start` (native) | Exact | Replaces `flow/unreachable`. |
| `no-inclusive-gateway` | warn | `pattern/inclusive-gateway` (native) | Exact | |
| `no-overlapping-elements` | warn | `pattern/overlapping-elements` (native) | Exact | |
| `single-blank-start-event` | error | `flow/multiple-blank-start-events` (native) | Exact | |
| `single-event-definition` | error | `flow/multiple-event-definitions` (native) | Exact | |
| `standard-size` | — | `pattern/non-standard-size` (native) | Exact | Accepts the same per-type options, for example `["warn", { "bpmn:Task": { "width": 120, "height": 80 } }]`. |
| `start-event-required` | error | `flow/no-start-event`, `flow/sub-process-no-start-event` (native) | Exact | |
| `sub-process-blank-start-event` | error | `flow/sub-process-typed-start` (native) | Exact | |
| `superfluous-gateway` | warn | `flow/redundant-gateway` (native inside sub-processes) | Exact | |
| `superfluous-label` | warn | `naming/superfluous-flow-label` (native) | Exact | |
| `superfluous-termination` | warn | `flow/superfluous-termination` (native) | Exact | |

---
Source: https://bpmnkit.com/docs/guides/bpmnlint
