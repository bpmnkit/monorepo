---
"@bpmnkit/patterns": minor
"@bpmnkit/cli": minor
"@bpmnkit/core": patch
---

- `@bpmnkit/patterns/templates` (new export): 25 runnable Camunda 8 process templates — order
  to cash, approvals, onboarding, incidents, documents, SLAs, sagas, human-in-the-loop and seven
  AI agent patterns — each with DMN/forms where used and a `.bpmn.tests.json` scenario set that
  passes on `@bpmnkit/engine`'s `runScenario`. `ALL_TEMPLATES`, `TEMPLATE_CATEGORIES`,
  `getTemplate`, `templatesInCategory`, `templateFiles`, `listJobTypes`. The package now
  depends on `@bpmnkit/core`.
- `casen template list [--category]` and `casen template use <id> [dir] [--force]` write a
  template's files into a project.
- Core: `receiveTask(..., { correlationKey })` now writes the `zeebe:subscription` it
  documented; it was silently dropped, so the task failed `deploy/message-catch-no-correlation`.
