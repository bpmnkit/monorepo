---
"@bpmnkit/engine": minor
---

AI agents can be put under deterministic tests.

- The simulator runs an ad-hoc sub-process that has a job worker, such as Camunda's AI Agent
  Sub-process connector, when a worker is registered for its job type. The job carries
  `adHocSubProcessElements` (the tools, their documentation and their `fromAi()` parameters).
  The worker completes it with an `adHocSubProcess` job result:
  `job.complete(variables, { type: "adHocSubProcess", activateElements, isCompletionConditionFulfilled, isCancelRemainingInstances })`.
  Each activated element runs in its own scope with its variables. When it ends,
  `outputElement` is appended to `outputCollection` and the worker gets a new job. A
  completion without a job result completes the sub-process as before, so existing mocks
  keep working. New types: `JobResult`, `AdHocSubProcessJobResult`, `AdHocActivateElement`,
  `AdHocSubProcessElement` and `AdHocToolParameter`. The `job:created` event now names its
  `elementId`.
- `ProcessTest.mockAiAgent(elementId, turns | cassette | handler)` plays the connector. Each
  model call takes the next turn: `{ toolCalls: [{ name, arguments }] }` activates those tools
  with a `toolCall` variable, and `{ responseText, responseJson }` ends the agent with its
  `agent` response. An unknown tool, arguments that do not match the tool's `fromAi()`
  parameters, a script that runs out and the connector's `maxModelCalls` each fail the run
  with a message that says so. The handle records `toolCalls` and `requests`, and the
  `toHaveCalledTools([...])` matcher checks the calls in order, arguments included.
- Record and replay: `AgentCassette` is a versioned JSON format for an agent transcript.
  `parseAgentCassette`, `readAgentCassette` and `writeAgentCassette` validate it, and
  `handle.cassette()` records the turns that a handler of your own returned. No model or
  network is called.
- `coverage().tools` and `formatCoverage` report which tools of AI agents the runs called.
