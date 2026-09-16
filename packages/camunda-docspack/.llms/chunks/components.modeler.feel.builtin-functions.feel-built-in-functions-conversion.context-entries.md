# Conversion functions — context(entries)

Constructs a context of the given list of key-value pairs. It is the reverse function to [get entries()](https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-context#get-entriescontext).

Each key-value pair must be a context with two entries: `key` and `value`. The entry with name `key` must have a value of the type `string`.

It might override context entries if the keys are equal. The entries are overridden in the same order as the contexts in the given list.

Returns `null` if one of the entries is not a context or if a context doesn't contain the required entries.

**Function signature**

```feel
context(entries: list<context>): context
```

**Examples**

```feel
context([{"key":"a", "value":1}, {"key":"b", "value":2}])
// {a:1, b:2}
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-conversion
