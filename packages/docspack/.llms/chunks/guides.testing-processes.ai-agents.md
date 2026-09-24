# Testing Processes — AI agents

An [AI Agent sub-process](/docs/guides/ai-agents) runs as a job of type
`io.camunda.agenticai:aiagent-job-worker:1`. Mock it as a black box with the output you
want the agent to produce:

```typescript
t.mockJob("io.camunda.agenticai:aiagent-job-worker:1", {
  result: { agent: { responseText: "Refund approved" } },
})
```

**Gap:** the simulator does not run the tool elements inside an ad-hoc sub-process. For
that reason, you cannot mock which tools the agent selects, and coverage reports the tools
as not reached.


## Messages

```typescript
const run = await t.start("order-process")
await run.publishMessage("payment-confirmed") // the bpmn:message name, or its id
```

A message goes to the run you publish it on. If nothing in that run waits for the message,
`publishMessage` throws. **Gaps:** a message cannot carry variables, and correlation keys
are not evaluated. To set the variables a message would carry, complete an earlier job
with them.

---
Source: https://bpmnkit.com/docs/guides/testing-processes
