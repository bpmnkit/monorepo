---
title: Testing AI Agents
description: Put an AI Agent Sub-process under deterministic tests — script or replay the tools the model calls, check the arguments it passes and the path the process takes, and measure which tools your tests exercise. No LLM, no network.
sidebar:
  order: 16
---

An [AI Agent Sub-process](/docs/guides/ai-agents) lets a model choose which tools to call.
That choice changes from run to run, so a process with an agent is hard to test. Camunda
reports that only 11% of agentic projects reach production. `@bpmnkit/engine/testing`
makes the agent step deterministic: you write down, or record once, what the model decides.
The test then runs the real tools of the ad-hoc sub-process, the real `fromAi()` mappings and
the real process around them.

This guide extends [Testing Processes](/docs/guides/testing-processes). Read that first for
`createProcessTest`, job mocks and the matchers.

## How the mock plays the connector

The simulator runs an ad-hoc sub-process that has a job worker in the same way as Zeebe:

1. The agent's job sees `adHocSubProcessElements`: the tools, with their documentation and
   `fromAi()` parameters.
2. `mockAiAgent` takes the next **turn** of your script. A turn with `toolCalls` completes the
   job with an `adHocSubProcess` job result that activates those tools. Each tool gets a
   `toolCall` variable: `{ ...arguments, _meta: { id, name } }`. Its `fromAi(toolCall.x)`
   input mappings read the variable.
3. The tools run as normal tasks, with mocks or with `run.completeJob`. When a tool ends,
   `outputElement` appends `{ id, name, content: toolCallResult }` to `toolCallResults`, and
   the agent gets a new job.
4. When every tool of the turn has a result, the mock takes the next turn. A turn with
   `responseText` or `responseJson` ends the agent. The mock sets
   `agent = { responseText, responseJson, context }`, and the output mapping of the ad-hoc
   sub-process takes the value from there.

## A worked example

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

## When the test must fail

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

## Record and replay

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

## Tool coverage

The tools are elements, so `coverage().elements` counts them. `coverage().tools` counts only
the tools, which are the elements that an AI agent can activate:

```typescript
t.coverage().tools   // { total: 3, covered: 2, percent: 66.7, uncovered: ["create-ticket"] }

console.log(formatCoverage(t.coverage()))
// BPMN coverage
//   ai-agent-tool-loop  elements 7/13 (53.8%)  flows 4/8 (50.0%)  tools 2/3 (66.7%)
//     elements not reached: create-ticket, agent-failed, queue-for-human, ...
//     flows not taken: ...
//     tools never called: create-ticket
```

A tool that no test calls is a path that no test covers.

## Limits

- The mock plays the AI Agent **Sub-process** connector
  (`io.camunda.agenticai:aiagent-job-worker:1`, which `buildAiAgentSubProcess` builds).
  For the AI Agent **Task** with a separate ad-hoc sub-process, the simulator does not
  evaluate `activeElementsCollection`. Mock that task with `mockJob`.
- The connector's `errorExpression` is not evaluated. Thus a failed tool or a model-call limit
  fails the run instead of throwing `AGENT_FAILED`.
- Two runs of the same agent element at the same time in one run, for example inside a
  parallel multi-instance, share the turn state.
- `agent.context` holds only `state` and `metrics.modelCalls`, not the conversation.
