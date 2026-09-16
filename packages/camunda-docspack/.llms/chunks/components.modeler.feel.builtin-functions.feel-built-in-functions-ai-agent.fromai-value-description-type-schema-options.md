# AI agent functions — fromAi(value, description, type, schema, options)

(Camunda extension)(Camunda extension)

Returns the unmodified `value` parameter, which must be a FEEL variable reference in the form `toolCall.<parameterName>` (for example, `toolCall.userId`).

In addition to the previous overload, it also accepts an optional `options` parameter to provide additional options for the integration handling the value definition.

- The options parameter must be `null` or a context (map) containing only constant values. For example, function calls within options are not supported.

**Function signature**

```feel
fromAi(value: Any, description: string, type: string, schema: context, options: context): Any
```

**Examples**

```feel
fromAi(toolCall.documentType, "The document type to provide", "string", null, {
  required: false
})
// toolCall.documentType contents

fromAi(value: toolCall.documentType, options: {
  required: false
})
// toolCall.documentType contents
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-ai-agent
