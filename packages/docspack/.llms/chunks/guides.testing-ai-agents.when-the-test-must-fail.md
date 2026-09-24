# Testing AI Agents — When the test must fail

The mock fails the run, and does not guess, when the script and the model disagree. The
message goes to `run.error`, and `toHaveCompleted()` prints it:

- **Unknown tool.** `unknown tool "issue-refund". Tools of "support-agent": search-kb,
  lookup-order, create-ticket`. This happens when a tool was renamed or removed after a
  transcript was recorded.
- **Wrong arguments.** An argument that no `fromAi()` parameter declares, or a missing required
  parameter (`fromAi` without `{ required: false }`).
- **Script too short.** `the script has no turn 3 — it has 2, all played. The agent asked the
  model again with results from lookup-order`. The process needed a model call that the
  script does not have.
- **Model-call limit.** More model calls than the connector's `data.limits.maxModelCalls`.

A tool without a mock waits, as in any other test. Complete it with
`run.completeJob("create-ticket", { ticketId: "T-9" })`. The agent then continues.

---
Source: https://bpmnkit.com/docs/guides/testing-ai-agents
