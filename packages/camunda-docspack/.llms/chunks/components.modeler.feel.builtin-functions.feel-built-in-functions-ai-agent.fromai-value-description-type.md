# AI agent functions — fromAi(value, description, type)

(Camunda extension)(Camunda extension)

Returns the unmodified `value` parameter, which must be a FEEL variable reference in the form `toolCall.<parameterName>` (for example, `toolCall.userId`).

In addition to the previous overload, it also accepts an optional `type` parameter to provide type information about the value. The type must be `null` or a string constant.

**Function signature**

```feel
fromAi(value: Any, description: string, type: string): Any
```

**Examples**

```feel
fromAi(toolCall.searchQuery, "The search query used to find the best match.", "string")
// toolCall.searchQuery contents

fromAi(toolCall.userId, "The user's ID", "number")
// toolCall.userId contents

fromAi(toolCall.userId, null, "number")
// toolCall.userId contents

fromAi(value: toolCall.userId, type: "number")
// toolCall.userId contents
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-ai-agent
