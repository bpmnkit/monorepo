# Progress

## 2026-06-26 — Builder: emit `<zeebe:userTask />` marker

Added `zeebeUserTask?: boolean` option to `UserTaskOptions`. When `true`, the builder emits `<zeebe:userTask />` inside `<bpmn:extensionElements>`, marking the task as a Camunda 8 native user task. Compatible with `formId`; `<zeebe:userTask />` appears before `<zeebe:formDefinition />`.
