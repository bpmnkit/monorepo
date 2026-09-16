# Boolean functions — assert(value, condition, cause)

(Camunda extension)(Camunda extension)

Verify that the given condition is met. If the condition is `true`, the function returns the value.
Otherwise, the evaluation fails with an error containing the given message.

**Function signature**

```feel
assert(value: Any, condition: Any, cause: String)
```

**Examples**

```feel
assert(x, x != null, "'x' should not be null")
// "value" - if x is "value"
// error('x' should not be null) - if x is null or doesn't exist

assert(x, x >= 0, "'x' should be positive")
// 4 - if x is 4
// error('x' should be positive) - if x is less than zero
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-boolean
