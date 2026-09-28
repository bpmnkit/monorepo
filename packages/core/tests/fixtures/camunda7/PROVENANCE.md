# Camunda 7 fixtures — provenance

Consumed by `tests/camunda7-migrate.test.ts` (end-to-end conversions) and by the
`casen migrate c7` tests in `apps/cli`.

| File | Source | Terms | Added |
|---|---|---|---|
| `invoice-approval.bpmn` | Written for this repository | MIT, with the repository | 2026-09-24 |
| `order-fulfillment.bpmn` | Written for this repository | MIT, with the repository | 2026-09-24 |
| `claim-handling.bpmn` | Written for this repository | MIT, with the repository | 2026-09-24 |

They are written in the shape Camunda Modeler 5.x exports for the "Camunda Platform 7"
execution platform — namespaces, `exporter` attributes, `camunda:` attribute placement,
`bpmn:tFormalExpression` conditions and diagram interchange — from the public
`camunda-bpmn-moddle` descriptor (MIT). They are not copied from Camunda's examples or
from any other project's test suite. The processes are invented; the Java class names
(`com.acme.*`) do not exist.

Each file isolates a kind of result, so a failure names its own cause:

| File | Covers |
|---|---|
| `invoice-approval.bpmn` | only constructs that convert completely — external tasks, IO mappings, static assignment, Camunda Form links, a decision with `singleEntry`, a call activity with `camunda:in`/`camunda:out`, a FEEL script, JUEL conditions, a zero-interval retry cycle. Converted, it must deploy-lint clean. |
| `order-fulfillment.bpmn` | the common mix — Java delegates (`class`, `delegateExpression`, `expression`), listeners, `initiator`, `historyTimeToLive`, a receive task with no correlation key, a Groovy script, timer expressions, a retry back-off |
| `claim-handling.bpmn` | `camunda:` attributes on nested elements: `camunda:collection` on a multi-instance loop and an external-task implementation on a message end event's event definition; plus field injection, `camunda:list`/`camunda:map`, templated and scripted parameters, a Camunda 7 connector and an embedded form key |
