# Context functions — context put(context, keys, value)

Adds a new entry with the given value to the context. The path of the entry is defined by the keys. Returns a new context that includes the entry.

If `keys` contains the keys `[k1, k2]` then it adds the nested entry `k1.k2 = value` to the context.

If an entry for the same keys already exists in the context, it overrides the value.

If `keys` are empty, it returns `null`.

**Function signature**

```feel
context put(context: context, keys: list<string>, value: Any): context
```

**Examples**

```feel
context put({x:1}, ["y"], 2)
// {x:1, y:2}

context put({x:1, y: {z:0}}, ["y", "z"], 2)
// {x:1, y: {z:2}}

context put({x:1}, ["y", "z"], 2)
// {x:1, y: {z:2}}
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-context
