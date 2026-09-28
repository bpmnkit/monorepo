# Migrate from Camunda 7 — Sources

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

---
Source: https://bpmnkit.com/docs/guides/migrate-from-camunda-7
