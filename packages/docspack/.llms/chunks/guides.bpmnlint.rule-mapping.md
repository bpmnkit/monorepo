# bpmnlint Compatibility — Rule mapping

These are the 28 rules bpmnlint 11.14 ships. **Exact** means the rule has the same semantics
as bpmnlint's, and BPMN Kit reports the same elements. We checked this with a test for each
rule, and by running both linters against every `.bpmn` file in the BPMN Kit repository under
`bpmnlint:all`. That corpus is small (16 files), so treat it as evidence, not proof.
**Approximate** means the finding covers the same
concern but not the same set of elements. The notes say how they differ. "Native" marks a
check BPMN Kit added for this compatibility layer. It runs only when your config enables the
rule.

| bpmnlint rule | recommended | BPMN Kit finding | Match | Notes |
|---|---|---|---|---|
| `ad-hoc-sub-process` | error | `flow/ad-hoc-start-end-event` (native) | Exact | |
| `conditional-event` | — | `flow/conditional-event-no-condition` (native) | Exact | |
| `conditional-flows` | error | `feel/empty-condition` | Approximate | Only flows leaving an exclusive or inclusive split gateway are checked. They are checked even when no sibling flow has a condition, which bpmnlint does not do. |
| `end-event-required` | error | `flow/no-end-event`, `flow/sub-process-no-end-event` (native) | Exact | |
| `event-based-gateway` | error | `flow/event-gateway-invalid` (native) | Exact | |
| `event-sub-process-typed-start-event` | error | `flow/event-sub-process-untyped-start` (native) | Exact | |
| `fake-join` | warn | `flow/multi-incoming-task` | Approximate | Top-level process scope only. |
| `global` | warn | `pattern/global-element` (native) | Exact | Also reports a global element with no `name` attribute. bpmnlint only reports an empty name. |
| `label-required` | error | `naming/unlabeled-task`, `naming/unlabeled-start-event`, `naming/unlabeled-end-event`, `naming/split-gateway-no-label`, `naming/missing-flow-condition` | Approximate | Covers tasks, call activities, start and end events, exclusive and inclusive split gateways and the flows leaving them, in the top-level scope. Does not check intermediate and boundary events, elements inside sub-processes, pools or lanes. |
| `link-event` | error | `flow/link-event-mismatch` (native) | Exact | |
| `no-bpmndi` | error | `pattern/missing-di` (native) | Exact | |
| `no-complex-gateway` | error | `pattern/complex-gateway` (native) | Exact | |
| `no-disconnected` | error | `flow/disconnected` (native) | Exact | |
| `no-duplicate-sequence-flows` | error | `flow/duplicate-sequence-flow` (native) | Exact | One finding for each duplicate flow, which names the flow, its source and its target. bpmnlint reports these three separately. |
| `no-gateway-join-fork` | error | `flow/mixed-gateway` | Approximate | Top-level process scope only. |
| `no-implicit-end` | error | `flow/dead-end` | Approximate | Top-level scope only. Does not exempt link throw events, compensation handlers or event sub-processes. Also reports data objects and data stores. |
| `no-implicit-split` | error | `flow/implicit-split` (native) | Approximate | Recognises default flows on gateways only, because the BPMN Kit model does not keep an activity's `default` attribute. |
| `no-implicit-start` | error | `flow/unreachable` | Approximate | Reports every element that cannot be reached from a start event: the element without incoming flows and everything after it. Top-level scope only. Also reports event sub-processes, data objects and data stores. |
| `no-inclusive-gateway` | warn | `pattern/inclusive-gateway` (native) | Exact | |
| `no-overlapping-elements` | warn | `pattern/overlapping-elements` (native) | Exact | |
| `single-blank-start-event` | error | `flow/multiple-blank-start-events` (native) | Exact | |
| `single-event-definition` | error | `flow/multiple-event-definitions` (native) | Exact | |
| `standard-size` | — | `pattern/non-standard-size` (native) | Exact | Accepts the same per-type options, for example `["warn", { "bpmn:Task": { "width": 120, "height": 80 } }]`. |
| `start-event-required` | error | `flow/no-start-event`, `flow/sub-process-no-start-event` (native) | Exact | |
| `sub-process-blank-start-event` | error | `flow/sub-process-typed-start` (native) | Exact | |
| `superfluous-gateway` | warn | `flow/redundant-gateway` | Approximate | Top-level process scope only. |
| `superfluous-label` | warn | `naming/superfluous-flow-label` (native) | Approximate | Recognises default flows on gateways only, as for `no-implicit-split`. |
| `superfluous-termination` | warn | `flow/superfluous-termination` (native) | Exact | |

---
Source: https://bpmnkit.com/docs/guides/bpmnlint
