---
"@bpmnkit/core": patch
---

Keep foreign attributes (for example `camunda:collection`, `camunda:errorCodeVariable`, `camunda:type`) on event definitions and multi-instance loops. They were dropped on parse; they now travel in an optional `unknownAttributes` field and are written back.
