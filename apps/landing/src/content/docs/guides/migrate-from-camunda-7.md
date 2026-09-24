---
title: Migrate from Camunda 7
description: Convert Camunda 7 BPMN models to Camunda 8 with casen migrate c7 or convertCamunda7() — what is converted, what needs a person and why, how JUEL becomes FEEL, and how this relates to Camunda's own migration tools.
sidebar:
  order: 15
---

Camunda 7 Community Edition reached end of life with 7.24 in October 2025. Enterprise support
continues to 2030, and the community forks [Operaton](https://operaton.org) and
[CIB seven](https://www.cibseven.org) carry the Camunda 7 engine forward. If you move to
Camunda 8, your models must change: Camunda 8 reads `zeebe:` extensions and FEEL, and it
ignores `camunda:` extensions and JUEL.

BPMN Kit converts the model. It rewrites what can be rewritten mechanically, and it reports
every Camunda 7 construct it finds, with a severity and a Camunda 8 suggestion:

- **convertible** — rewritten. The Camunda 8 model does the same thing.
- **manual** — Camunda 8 has an equivalent, but a person must write or check it. Examples are a
  job worker for a Java delegate, or a correlation key for a message.
- **unsupported** — Camunda 8 has no equivalent. The model, or the system around it, must change.

## Who this is for

- Teams that have a folder of Camunda 7 `.bpmn` files and want to know how much work the
  models are, before they plan the migration.
- Teams that work in TypeScript or JavaScript and do not want a Java toolchain to convert
  models.
- CI pipelines: `casen migrate c7 --check` fails while manual work remains.

## Run it

```sh
casen migrate c7 models/*.bpmn            # writes models/*.c8.bpmn
casen migrate c7 models/*.bpmn --out c8   # writes c8/*.bpmn
casen migrate c7 models/*.bpmn --check    # report only, exit 1 on manual work
```

[`casen migrate`](/docs/cli/migrate) has the flags and the JSON format. From code:

```typescript
import { Bpmn, convertCamunda7 } from "@bpmnkit/core"

const { definitions, report } = convertCamunda7(Bpmn.parse(xml), { sourceXml: xml })
for (const f of report.findings) console.log(f.severity, f.elementId, f.construct, f.message)
const c8Xml = Bpmn.export(definitions)
```

`analyzeCamunda7(definitions)` returns the same report and does not change the model. Pass
`sourceXml` in both cases. The BPMN Kit parser does not keep foreign attributes on
multi-instance loops and on event definitions, and Camunda 7 stores `camunda:collection` and
the implementation of message throw events there. With the source, these are read from the
XML. Without the source, they are reported as `manual`.

## What is converted

| Camunda 7 | Camunda 8 | Severity |
| --- | --- | --- |
| `camunda:type="external"` + `camunda:topic` | `zeebe:taskDefinition type` = the topic | convertible |
| `camunda:class` | `zeebe:taskDefinition type` = the class's Spring bean name (`com.acme.ShipOrderDelegate` → `shipOrderDelegate`), plus a `class` task header with the original | manual — write a job worker |
| `camunda:delegateExpression="${bean}"` | type `bean` (the element id if the expression is not a single bean), plus a `delegateExpression` header | manual |
| `camunda:expression` | type = element id, plus `expression` and `resultVariable` headers | manual |
| `camunda:field` with a string value | a task header with the same name | convertible |
| `camunda:inputOutput` | `zeebe:ioMapping`: `${…}` translated, text becomes a FEEL string, `camunda:list` / `camunda:map` become FEEL lists and contexts, an empty parameter becomes `null` | convertible, per parameter |
| `conditionExpression` `${…}` | `=…` FEEL | convertible when provable |
| `camunda:asyncBefore` / `asyncAfter` / `exclusive` / `jobPriority` | removed | convertible — see below |
| `camunda:failedJobRetryTimeCycle` `R5/PT5M` | `zeebe:taskDefinition retries="5"` | convertible; the interval is manual |
| user task | `zeebe:userTask` (a Camunda user task) | convertible |
| `camunda:assignee`, `candidateUsers`, `candidateGroups` | `zeebe:assignmentDefinition` | convertible; a candidate *expression* is manual, because Camunda 8 needs a list of strings |
| `camunda:dueDate`, `followUpDate` | `zeebe:taskSchedule` | convertible for expressions and ISO 8601 date-times with a zone |
| `camunda:priority` 0–100 | `zeebe:priorityDefinition` | convertible |
| `camunda:formRef` + `formRefBinding` | `zeebe:formDefinition formId` + `bindingType` | convertible; a `version` binding is manual |
| `camunda:formKey` | `zeebe:formDefinition externalReference` | convertible; `embedded:` and `camunda-forms:` keys are manual |
| `camunda:decisionRef` + `resultVariable` | `zeebe:calledDecision` | convertible with `mapDecisionResult="singleEntry"`; other result mappers are manual |
| `calledElement` + `camunda:calledElementBinding` | `zeebe:calledElement processId` + `bindingType` | convertible |
| `camunda:in` / `camunda:out` | `zeebe:input` / `zeebe:output`, and `propagateAllParentVariables` / `propagateAllChildVariables="false"` unless `variables="all"` | convertible |
| `camunda:in businessKey="#{execution.processBusinessKey}"` | removed: a child inherits the parent's business ID (Camunda 8.9+) | convertible |
| `camunda:collection` / `elementVariable` | `zeebe:loopCharacteristics inputCollection` / `inputElement` | convertible |
| completion condition with `nrOf…Instances` | FEEL with `numberOf…Instances` | convertible |
| timer `${…}` | `=…` FEEL | convertible when provable |
| script task, `scriptFormat="feel"` (or `juel`) | `zeebe:script expression` + `resultVariable` | convertible |
| `camunda:versionTag` | `zeebe:versionTag` | convertible |
| `camunda:properties` | `zeebe:properties` | convertible |

The file is marked `modeler:executionPlatform="Camunda Cloud"` (version `8.8.0` by default),
and the `zeebe` namespace is declared. If the converter writes a Camunda 8 equivalent, it
removes the Camunda 7 original. If it does not, it keeps the original in the file. Camunda 8
ignores `camunda:` content, so nothing is lost, and the next person can see what the model
used to do.

## What is not converted, and why

- **Java delegates, listeners and scripts.** Camunda 8 runs no user code in the engine. Every
  delegate becomes a job worker. The converter chooses the job type and keeps the original
  class or expression as a task header, so that one generic worker can dispatch on it while
  you port the code. Execution and task listeners become job-worker listeners in Camunda 8
  (`zeebe:executionListeners`, `zeebe:taskListeners`). The converter names the matching event
  type, but it does not write the listener. Groovy and JavaScript scripts must be rewritten
  as FEEL or as a worker.
- **Message correlation.** Camunda 7 correlates a message by an API call (business key,
  variables or instance id). The model does not name a key. Camunda 8 requires a
  `correlationKey` for every message catch, and only you know which variable it is.
- **Asynchronous continuations.** Camunda 8 has none. The engine commits after every step,
  and every job-based task is already a wait state, so there is no transaction boundary to
  place. A failure does not roll back to the last async boundary. A job failure retries the
  job, and an expression failure raises an incident on the element.
- **Retry intervals.** The retry count goes to the task definition. The back-off is not part
  of the Camunda 8 model: the worker gives it when it fails the job. A zero interval needs
  nothing.
- **Decision result mappers.** Camunda 8 stores the decision's own result: a value for one
  output, a context for several outputs, and a list for collect hit policies. This matches
  Camunda 7's `singleEntry`. For other mappers, check what downstream elements read.
- **No equivalent (unsupported):** `camunda:historyTimeToLive` (retention is configured for
  the cluster), `candidateStarterGroups` / `candidateStarterUsers` (use authorizations),
  `camunda:initiator`, `take` listeners on sequence flows, `timeout` task listeners, retry
  cycles on elements that have no job, standard loops, CMMN case calls, tenant ids on calls
  and decisions.
- **Anything else with the `camunda:` prefix** is reported as `manual` and kept. The report
  never omits a construct.

## JUEL to FEEL

The converter translates a JUEL expression only when the result is provably the same. This
means a single `${…}` or `#{…}` that contains only:

- variable paths (`order.customer.vip`),
- string, number, boolean and `null` literals,
- comparisons (`==`, `eq`, `!=`, `ne`, `<`, `lt`, `<=`, `le`, `>`, `gt`, `>=`, `ge`),
- `&&` / `and`, `||` / `or`, `!` / `not`,
- `+`, `-`, `*`, `/`, `div`, and parentheses.

| JUEL | FEEL |
| --- | --- |
| `${approved && order.total <= 1000}` | `=approved and order.total <= 1000` |
| `${status eq 'open'}` | `=status = "open"` |
| `${!approved}` | `=not(approved)` |
| `${nrOfCompletedInstances / nrOfInstances >= 0.6}` (completion condition) | `=numberOfCompletedInstances / numberOfInstances >= 0.6` |

Everything else is kept and reported as `manual`, with the reason. This includes method calls,
`empty`, the `?:` operator, indexing (zero-based in JUEL, one-based in FEEL), `%` (FEEL's
`modulo` uses a different sign rule), the engine objects `execution`, `task` and
`authenticatedUserId`, and text mixed with `${…}`.

"Provable" assumes that the operands are not null. JUEL changes `null` to `false` in boolean
operations, but FEEL keeps it as `null`. For example, `${!approved}` is `true` in Camunda 7
when `approved` is not set. In Camunda 8, `not(approved)` is `null`, so the flow is not taken.
If a variable can be missing, give it a default before the gateway.

## Before and after

A Camunda 7 service task, as Camunda Modeler writes it:

```xml
<bpmn:serviceTask id="Task_charge" name="Charge payment" camunda:asyncBefore="true"
    camunda:type="external" camunda:topic="charge-payment">
  <bpmn:extensionElements>
    <camunda:inputOutput>
      <camunda:inputParameter name="amount">${order.total}</camunda:inputParameter>
      <camunda:inputParameter name="currency">EUR</camunda:inputParameter>
      <camunda:outputParameter name="paymentId">${transactionId}</camunda:outputParameter>
    </camunda:inputOutput>
    <camunda:failedJobRetryTimeCycle>R5/PT5M</camunda:failedJobRetryTimeCycle>
  </bpmn:extensionElements>
</bpmn:serviceTask>
```

After `casen migrate c7`:

```xml
<bpmn:serviceTask id="Task_charge" name="Charge payment">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="charge-payment" retries="5"/>
    <zeebe:ioMapping>
      <zeebe:input source="=order.total" target="amount"/>
      <zeebe:input source="=&quot;EUR&quot;" target="currency"/>
      <zeebe:output source="=transactionId" target="paymentId"/>
    </zeebe:ioMapping>
  </bpmn:extensionElements>
</bpmn:serviceTask>
```

The report for this element has four convertible findings (async, topic, mappings, retry
count). It also has one manual finding: the worker must supply the five-minute back-off when
it fails the job.

The converted output is checked against BPMN Kit's Camunda 8 deploy lint. Everything reported
as convertible lints clean. The remaining deploy errors belong to elements with a manual
finding. An example is a receive task that has no correlation key yet.

## Camunda's own tools

This converter does not replace Camunda's migration tooling. The two work well together:

- Camunda's **Migration Analyzer and Diagram Converter** do the same job as this converter, as
  a web app and a Java CLI. Use whichever fits your toolchain, or run both and compare the
  reports.
- Camunda's **code conversion** (OpenRewrite recipes) and the **Camunda 7 adapter** port the
  Java side: delegates to job workers. BPMN Kit converts only models. Its `class` /
  `delegateExpression` task headers are intended for an adapter-style worker.
- Camunda's **Data Migrator** moves running and historic process instances. BPMN Kit does not
  move data.

If you do not want to migrate yet, [Operaton](https://operaton.org) and
[CIB seven](https://www.cibseven.org) are drop-in continuations of the Camunda 7 engine. Your
models stay as they are. BPMN Kit keeps `camunda:` content on a round trip, so you can edit
those models with BPMN Kit tools in the meantime.

## Sources

The Camunda 8 semantics above come from the Camunda documentation that ships with this
repository as `@bpmnkit/camunda-docspack`:

- *Service tasks* — task definition, retries and job priority (`zeebe:jobPriorityDefinition`).
- *User tasks* — assignments (static values and expressions, list types), forms (`formId`,
  `bindingType`, `externalReference`).
- *Call activities* — binding types and business ID propagation (8.9 default, 8.10
  `businessId`). *Variables* — propagation by BPMN element, including
  `propagateAllChildVariables`.
- *Business rule tasks* — called decision and a required `resultVariable`. *Script tasks* —
  `zeebe:script`.
- *Expressions* — FEEL, the `=` prefix, expressions versus static values.
- *Message events* — a correlation key is required, except for message start events.
- *Execution listeners* and *user task listeners* — job-based listeners and their event types.
- *Process instance migration: migrating from Camunda 7* — points to the Data Migrator for
  instance data.

The pack does not contain the "Migrating from Camunda 7" guide itself. The descriptions of
Camunda's Migration Analyzer, Diagram Converter, code conversion and Camunda 7 adapter come
from Camunda's public migration documentation, not from the pack.
