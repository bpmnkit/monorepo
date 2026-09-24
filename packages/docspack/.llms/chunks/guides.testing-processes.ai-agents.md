# Testing Processes — AI agents

An [AI Agent sub-process](/docs/guides/ai-agents) runs as a job of type
`io.camunda.agenticai:aiagent-job-worker:1`. `mockAiAgent` scripts the model's turns: which
tools it calls, with which arguments, and its final answer. The tools inside the ad-hoc
sub-process then run like any other task:

```typescript
const agent = t.mockAiAgent("support-agent", [
  { toolCalls: [{ name: "lookup-order", arguments: { orderId: "1042" } }] },
  { responseJson: { answer: "It ships tomorrow.", resolved: true } },
])
const run = await t.start("support", { customerMessage: "Where is order 1042?" })
expect(agent).toHaveCalledTools([{ name: "lookup-order", arguments: { orderId: "1042" } }])
```

A script can also be a recorded cassette file, and coverage counts the tools that ran. See
[Testing AI Agents](/docs/guides/testing-ai-agents). To mock the agent as a black box, use
`mockJob` with the output you want: `{ result: { agent: { responseText: "Refund approved" } } }`.

---
Source: https://bpmnkit.com/docs/guides/testing-processes
