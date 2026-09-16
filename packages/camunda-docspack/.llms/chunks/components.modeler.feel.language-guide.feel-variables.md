# Variables

Learn how to access variables, follow valid variable naming rules, and safely use escaped names when working with FEEL expressions.

Learn how to access variables, follow valid variable naming rules, and safely use escaped names when working with FEEL expressions.


## Access variables

Access the value of a variable by its [variable name](#variable-names).

FEEL doesn't use a separate assignment operator to create or update process variables. Instead, FEEL evaluates variables that are already available in the current context, or you can define local values with [context entries](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-context-expressions).

```feel
a + b
```

If the value of the variable is a context, a [context entry can be accessed](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-context-expressions#get-entrypath) by its key.

```feel
a.b
```

For example, in an [AI agent](https://docs.camunda.io/docs/next/reference/glossary#ai-agent) tool definition, the `toolCall` variable is a context holding the parameters an LLM supplies at runtime. See [`fromAi()`](https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-ai-agent#fromaivalue) for how tool parameters are declared.

If no variable exists with the given name, the expression returns `null`.

**Tip**
Use a [null-check](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-boolean-expressions#null-check) if the variable can be `null` or is optional.

```feel
a != null and a.b > 10
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-variables
