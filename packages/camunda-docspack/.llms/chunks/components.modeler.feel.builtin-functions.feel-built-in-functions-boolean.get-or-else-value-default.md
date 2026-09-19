# Boolean functions — get or else(value, default)

(Camunda extension)(Camunda extension)

Return the provided value parameter if not `null`, otherwise return the default parameter

**Function signature**

```feel
get or else(value: Any, default: Any): Any
```

**Examples**

```feel
get or else("this", "default")
// "this"

get or else(null, "default")
// "default"

get or else(null, null)
// null
```


## assert(value, condition)

(Camunda extension)(Camunda extension)

Verify that the given condition is met. If the condition is `true`, the function returns the value.
Otherwise, the evaluation fails with an error.

**Function signature**

```feel
assert(value: Any, condition: Any)
```

**Examples**

```feel
assert(x, x != null)
// "value" - if x is "value"
// error - if x is null or doesn't exist

assert(x, x >= 0)
// 4 - if x is 4
// error - if x is less than zero
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-boolean
