---
"@bpmnkit/engine": patch
---

`adHocSubProcessElements` now has Zeebe's shape, as Zeebe's `AdHocSubProcessElementsVariableTest` defines it. A `fromAi()` parameter is named by its whole reference: `toolCall.orderId`, not `orderId`. A `fromAi()` call on any reference is listed (`fromAi(b)` gives `b`), and the arguments of a `fromAi()` call are not searched for more calls. A description or type must be a string literal, and a schema or options must be a context of literals. A field that is null or empty is left out, so an element without `zeebe:properties` has no `properties` key. An empty property value is `null`. `AdHocSubProcessElement`'s `elementName`, `documentation`, `properties` and `parameters` are optional, and `properties` values are `string | null`.

`mockAiAgent` arguments keep the names a model sends: `{ orderId: "1042" }` for a `fromAi(toolCall.orderId)` parameter, as the AI Agent connector offers `toolCall.<name>` to the model as `<name>`. A tool call to a tool with a parameter the connector cannot offer (outside the `toolCall.` namespace, or nested) fails with the connector's message.

This is a patch. `AdHocSubProcessElement`, `AdHocToolParameter`, `mockAiAgent` and the job worker's `adHocSubProcessElements` were added after 1.0.0, in the unreleased minor change "AI agents can be put under deterministic tests". No released version has the old shape. The fix makes the new API match its documentation, which describes the variable Zeebe creates. The release that ships both is a minor.
