# Context functions

This document outlines context functions and a few examples.


## get value(context, key)

Returns the value of the context entry with the given key.

**Function signature**

```feel
get value(context: context, key: string): Any
```

**Examples**

```feel
get value({foo: 123}, "foo")
// 123

get value({a: 1}, "b")
// null
```


## get value(context, keys)

(Camunda extension)(Camunda extension)

Returns the value of the context entry for a context path defined by the given keys.

If `keys` contains the keys `[k1, k2]` then it returns the value at the nested entry `k1.k2` of the context.

If `keys` are empty or the nested entry defined by the keys doesn't exist in the context, it returns `null`.

**Function signature**

```feel
get value(context: context, keys: list<string>): Any
```

**Examples**

```feel
get value({x:1, y: {z:0}}, ["y", "z"])
// 0

get value({x: {y: {z:0}}}, ["x", "y"])
// {z:0}

get value({a: {b: 3}}, ["b"])
// null
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-context
