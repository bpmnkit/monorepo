# Context functions — get entries(context)

Returns the entries of the context as a list of key-value-pairs.

**Function signature**

```feel
get entries(context: context): list<context>
```

The return value is a list of contexts. Each context contains two entries for "key" and "value".

**Examples**

```feel
get entries({foo: 123})
// [{key: "foo", value: 123}]
```


## context put(context, key, value)

Adds a new entry with the given key and value to the context. Returns a new context that includes the entry.

If an entry for the same key already exists in the context, it overrides the value.

**Function signature**

```feel
context put(context: context, key: string, value: Any): context
```

**Examples**

```feel
context put({x:1}, "y", 2)
// {x:1, y:2}
```

**Info**
The function `context put()` replaced the previous function `put()` (Camunda Extension). The
previous function is deprecated and should not be used anymore.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-context
