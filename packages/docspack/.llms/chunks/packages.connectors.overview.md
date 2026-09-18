# @bpmnkit/connectors — Overview

`@bpmnkit/connectors` answers two questions about Camunda 8 connectors: **which ones exist**,
and **what happens to a task when you apply one**.

It bundles the 116 out-of-the-box Camunda connector templates as data, so a catalog, a search
box or an AI tool call can work offline. And it resolves a template plus a set of values into
the `zeebe:taskDefinition`, `zeebe:ioMapping` and `zeebe:modelerTemplate` bookkeeping the
Modeler would write — deterministically, so the same template and values always produce the
same XML.

The package root is browser-safe. Everything that touches the filesystem lives behind
`@bpmnkit/connectors/node`.

---
Source: https://bpmnkit.com/docs/packages/connectors
