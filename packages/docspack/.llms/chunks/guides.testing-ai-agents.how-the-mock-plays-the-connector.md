# Testing AI Agents — How the mock plays the connector

The simulator runs an ad-hoc sub-process that has a job worker in the same way as Zeebe:

1. The agent's job sees `adHocSubProcessElements`: the tools, with their documentation and
   `fromAi()` parameters, in Zeebe's shape. A parameter is named by the whole reference that
   `fromAi()` tags, so `fromAi(toolCall.orderId, "The order number")` gives
   `{ name: "toolCall.orderId", description: "The order number" }`. A field that is empty
   is left out, as Zeebe does: an element without `zeebe:properties` has no `properties`.
2. `mockAiAgent` takes the next **turn** of your script. A turn with `toolCalls` completes the
   job with an `adHocSubProcess` job result that activates those tools. Each tool gets a
   `toolCall` variable: `{ ...arguments, _meta: { id, name } }`. Its `fromAi(toolCall.x)`
   input mappings read the variable.

**Argument names.** Write `arguments` as the model sends them: `{ orderId: "1042" }`, not
`{ "toolCall.orderId": "1042" }`. The AI Agent connector offers the model each
`toolCall.<name>` parameter as `<name>`, and puts the model's arguments in the `toolCall`
variable, where `fromAi(toolCall.orderId)` reads them. A tool parameter outside the
`toolCall.` namespace, such as `fromAi(orderId)`, or a nested one, such as
`fromAi(toolCall.order.id)`, cannot be offered to the model. The connector fails for it, and
so does the mock when the tool is called.
3. The tools run as normal tasks, with mocks or with `run.completeJob`. When a tool ends,
   `outputElement` appends `{ id, name, content: toolCallResult }` to `toolCallResults`, and
   the agent gets a new job.
4. When every tool of the turn has a result, the mock takes the next turn. A turn with
   `responseText` or `responseJson` ends the agent. The mock sets
   `agent = { responseText, responseJson, context }`, and the output mapping of the ad-hoc
   sub-process takes the value from there.

---
Source: https://bpmnkit.com/docs/guides/testing-ai-agents
