# Testing AI Agents — A worked example

The `ai-agent-tool-loop` template (`casen template use ai-agent-tool-loop`) is a support agent
with three tools: `search-kb`, `lookup-order` and `create-ticket`. After the agent, a gateway
reads `agent.responseJson.resolved`.

```typescript
// support.test.ts
import { afterEach, beforeEach, expect, it } from "vitest"
import "@bpmnkit/engine/testing/vitest"
import { createProcessTest } from "@bpmnkit/engine/testing"
import type { ProcessTest } from "@bpmnkit/engine/testing"

let t: ProcessTest

beforeEach(async () => {
  t = await createProcessTest({ bpmn: new URL("./ai-agent-tool-loop.bpmn", import.meta.url) })
  t.mockJob("order-lookup", (job) => ({
    order: { id: job.variables.orderId, status: "delivered", damaged: true },
  }))
  t.mockJob("kb-search", { result: { articles: ["Returns and damaged items"] } })
  t.mockJob("ticket-create", { result: { ticketId: "T-77" } })
  t.mockJob("email-send", { result: {} })
})

afterEach(() => t.dispose())

it("opens a ticket for a damaged order and answers the customer", async () => {
  const agent = t.mockAiAgent("support-agent", [
    {
      toolCalls: [
        { name: "lookup-order", arguments: { orderId: "1042" } },
        { name: "search-kb", arguments: { query: "damaged item return" } },
      ],
    },
    { toolCalls: [{ name: "create-ticket", arguments: { summary: "Order 1042 arrived damaged" } }] },
    { responseJson: { answer: "Ticket T-77 is open.", resolved: true } },
  ])

  const run = await t.start("ai-agent-tool-loop", { customerMessage: "My order 1042 arrived broken." })

  expect(run).toHaveCompleted()
  expect(run).toHavePassedInOrder(["support-agent", "send-answer", "answered"])
  expect(agent).toHaveCalledTools([
    { name: "lookup-order", arguments: { orderId: "1042" } },
    { name: "search-kb", arguments: { query: expect.stringContaining("damaged") } },
    "create-ticket",
  ])
  // What the model saw on its second call:
  expect(agent.requests[1].toolCallResults).toEqual([
    { id: "call_1_1", name: "lookup-order", content: { id: "1042", status: "delivered", damaged: true } },
    { id: "call_1_2", name: "search-kb", content: ["Returns and damaged items"] },
  ])
})
```

`toHaveCalledTools` compares the whole sequence. Give a tool id, or `{ name, arguments }`
when the arguments matter. Asymmetric matchers work in `arguments`. Tool elements are
ordinary elements, so `toHavePassed(["create-ticket"])` and the other run matchers also work.

### The handle

| Member | What it holds |
|---|---|
| `toolCalls` | Every tool call the agent issued: `{ modelCall, id, name, arguments }` |
| `requests` | Every model call: `{ modelCall, toolCallResults, tools, variables }` |
| `remainingTurns` | Script turns that were not played |
| `cassette()` | The turns played so far, as a cassette |
| `restore()` | Removes the mock |

Turns are used in order across every run of the element. Thus a process that enters the agent
twice, or two runs in one test, read one script from start to end. A call without an `id`
gets `call_<modelCall>_<n>`.

---
Source: https://bpmnkit.com/docs/guides/testing-ai-agents
