# AI agent functions — fromAi(value, description)

(Camunda extension)(Camunda extension)

Returns the unmodified `value` parameter, which must be a FEEL variable reference in the form `toolCall.<parameterName>` (for example, `toolCall.userId`).

In addition to the previous overload, it also accepts an optional `description` parameter to provide a textual description of the value. The description must be `null` or a string constant.

**Function signature**

```feel
fromAi(value: Any, description: string): Any
```

**Examples**

```feel
fromAi(toolCall.searchQuery, "The search query used to find the best match.")
// toolCall.searchQuery contents

fromAi(toolCall.searchQuery, null)
// toolCall.searchQuery contents
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-ai-agent
