# Migrate from Camunda 7 — What is converted

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

---
Source: https://bpmnkit.com/docs/guides/migrate-from-camunda-7
