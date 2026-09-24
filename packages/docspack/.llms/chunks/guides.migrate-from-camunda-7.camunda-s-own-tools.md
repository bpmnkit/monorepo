# Migrate from Camunda 7 — Camunda's own tools

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

---
Source: https://bpmnkit.com/docs/guides/migrate-from-camunda-7
