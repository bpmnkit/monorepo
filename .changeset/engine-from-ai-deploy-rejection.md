---
"@bpmnkit/engine": patch
"@bpmnkit/core": patch
---

A `fromAi()` call that Zeebe rejects at deployment now fails `Engine.deploy` with Zeebe's message, and nothing is deployed. Before, the call or its argument was left out of `adHocSubProcessElements`. The rules are those of Zeebe's `FromAiTaggedParameterExtractor`: the value must be a reference, the description and type must be string literals (`null` too is rejected), and the schema and options must be contexts of literals. The message is `Failed to extract ad-hoc activity parameters for element '<id>'. Expected fromAi() parameter 'description' to be a string, but received '10'.`, as Zeebe's `AdHocSubProcessTransformer` builds it. Reebe rejects the same calls with the same message.

`buildAiAgentSubProcess` wrote `null` as the schema of an optional tool parameter without a schema (`fromAi(toolCall.urgent, "…", "boolean", null, { required: false })`). Zeebe rejects that deployment. It now writes an empty context, `{}`, which Zeebe accepts and leaves out of the tool's parameters.

Both are patches: they fix output that Zeebe does not accept. `Engine.deploy` throws only for models that Zeebe would not deploy.
