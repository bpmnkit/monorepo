---
"@bpmnkit/engine": minor
---

New `@bpmnkit/engine/testing` entry point for unit-testing BPMN processes in Vitest or Jest,
with no Docker and no cluster:

- `createProcessTest({ bpmn, dmn?, forms?, startTime? })` deploys models (parsed, XML, a path
  or a `file:` URL) into an in-process engine.
- `mockJob(type, …)` completes, fails or throws a BPMN error for a job type, or computes the
  result in a handler; `calls` records what it handled. Job types without a mock wait, and
  `run.completeJob / failJob / throwError(elementIdOrType, …)` drive them — Camunda user
  tasks included.
- `mockConnector(type, { response })` maps a fake connector response through the task's
  `resultVariable` and `resultExpression`.
- `run.publishMessage(name)` correlates a message and throws when nothing waits for it.
- A virtual clock: `advanceTime("P1D")` fires due timers in order without real waiting.
- Matchers — `toHaveCompleted`, `toHaveFailed`, `toBeWaitingAt`, `toHavePassed`,
  `toHavePassedInOrder`, `toHaveNotPassed`, `toHaveVariables` — registered by importing
  `@bpmnkit/engine/testing/vitest` (typed for Vitest's `Assertion`), or with
  `expect.extend(bpmnMatchers)` in Jest.
- `coverage()` and `formatCoverage()` report the flow nodes and sequence flows the runs
  reached.

`vitest` is an optional peer dependency, needed only for `@bpmnkit/engine/testing/vitest`.
