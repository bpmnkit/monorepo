# Introduction

FEEL includes many built-in functions. These functions can be invoked in expressions and unary-tests.

FEEL includes many built-in functions. These functions can be invoked
in [expressions](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-expressions-introduction)
and [unary-tests](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-unary-tests).

```feel
contains("me@camunda.com", ".com")
// invoke function with positional arguments

contains(string: "me@camunda.com", match: ".de")
// invoke function with named arguments
```

Read more about functions [here](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-functions#invocation).

This section is split into functions based on their primary operational data type:

- [Boolean](https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-boolean)
- [String](https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-string)
- [Numeric](https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-numeric)
- [List](https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-list)
- [Context](https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-context)
- [Temporal](https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-temporal)
- [Range](https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-range)

Additionally, there are [conversion](https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-conversion) functions that allow
you to construct new values of a data type (factory functions), and [AI agent functions](https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-ai-agent)
used to declare LLM-provided tool parameters (see the [AI agent functions glossary entry](https://docs.camunda.io/docs/next/reference/glossary#ai-agent-function)).

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-introduction
