# Testing AI Agents — Record and replay

A **cassette** is a JSON file that holds the model's turns for one agent:

```json
{
  "version": 1,
  "agent": "support-agent",
  "turns": [
    { "toolCalls": [{ "id": "toolu_01", "name": "lookup-order", "arguments": { "orderId": "1042" } }] },
    { "responseText": "It ships tomorrow.", "responseJson": { "answer": "It ships tomorrow.", "resolved": true } }
  ]
}
```

The TypeScript type is `AgentCassette`. `parseAgentCassette(value)` validates JSON text or
parsed JSON. On an error, it gives the path of the problem, for example
`turns[0] has unknown field "tool_calls"`. `readAgentCassette(path)` and
`writeAgentCassette(path, cassette)` read and write files, and both validate. A cassette with
an `agent` field refuses to replay for another element.

**To record**, give `mockAiAgent` a handler instead of a script. The handler is your own code:
an adapter that sends `request.tools` and `request.toolCallResults` to your model, or a
transcript that you captured from a Camunda run. The testing helpers never call a model or
the network. After the run, save the turns that the handler returned:

```typescript
import { readAgentCassette, writeAgentCassette } from "@bpmnkit/engine/testing"

const CASSETTE = new URL("./damaged-order.cassette.json", import.meta.url)

it("handles a damaged order", async () => {
  const agent = process.env.RECORD
    ? t.mockAiAgent("support-agent", (request) => myModelAdapter(request)) // your code
    : t.mockAiAgent("support-agent", await readAgentCassette(CASSETTE))

  const run = await t.start("ai-agent-tool-loop", { customerMessage: "My order 1042 arrived broken." })
  if (process.env.RECORD) await writeAgentCassette(CASSETTE, agent.cassette())

  expect(run).toHaveCompleted()
})
```

**To replay**, pass the cassette. Replay is deterministic: each model call takes the next
turn, and the tools get the same arguments. If the process changes so that it needs a turn
that the cassette does not have, the run fails and tells you to re-record.

---
Source: https://bpmnkit.com/docs/guides/testing-ai-agents
