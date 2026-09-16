# Context functions — context merge(contexts)

Union the given contexts. Returns a new context that includes all entries of the given contexts.

If an entry for the same key already exists in a context, it overrides the value. The entries are overridden in the same order as in the list of contexts.

**Function signature**

```feel
context merge(contexts: list<context>): context
```

**Examples**

```feel
context merge([{x:1}, {y:2}])
// {x:1, y:2}

context merge([{x:1, y: 0}, {y:2}])
// {x:1, y:2}
```

**Info**
The function `context merge()` replaced the previous function `put all()` (Camunda Extension). The
previous function is deprecated and should not be used anymore.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-context
