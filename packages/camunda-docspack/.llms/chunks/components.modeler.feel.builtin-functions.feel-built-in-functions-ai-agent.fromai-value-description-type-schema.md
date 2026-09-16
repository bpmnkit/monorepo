# AI agent functions — fromAi(value, description, type, schema)

(Camunda extension)(Camunda extension)

Returns the unmodified `value` parameter, which must be a FEEL variable reference in the form `toolCall.<parameterName>` (for example, `toolCall.userId`).

In addition to the previous overload, it also accepts an optional `schema` parameter to provide a (partial) [JSON schema](https://json-schema.org/) for the value.

- The schema must be `null` or a context (map) containing only constant values. For example, function calls within the schema are not supported.
- The schema is not validated by the FEEL engine but might be by a custom integration consuming the information.
- From the engine side it is possible to specify both a `type` and a `schema`, and it depends on the integration as to which value takes precedence. The [AI Agent connector](https://docs.camunda.io/docs/next/components/connectors/out-of-the-box-connectors/agentic-ai-aiagent) will override any type specified in the schema if the `type` parameter is also provided.

**Function signature**

```feel
fromAi(value: Any, description: string, type: string, schema: context): Any
```

**Examples**

```feel
fromAi(toolCall.documentType, "The document type to provide", "string", {
  enum: ["invoice", "receipt", "contract"]
})
// toolCall.documentType contents

fromAi(value: toolCall.documentType, description: "The document type to provide", schema: {
  type: "string",
  enum: ["invoice", "receipt", "contract"]
})
// toolCall.documentType contents

fromAi(toolCall.tags, "Tags to apply to the blog post", "array", {
  items: {
    type: "string"
  }
})
// toolCall.tags contents
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-ai-agent
