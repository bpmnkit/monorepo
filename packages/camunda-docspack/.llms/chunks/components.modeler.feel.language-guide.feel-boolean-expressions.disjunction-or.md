# Boolean expressions — Disjunction/or

Combines multiple boolean values following the ternary logic.

- The result is `true` if at least one value is `true`.
- The result is `false` if all values are `false`.
- Otherwise, the result is `null` (i.e. if a value is not a boolean.)

```feel
true or false
// true

false or false
// false

true or null
// true

true or "otherwise"
// true

false or null
// null

false or "otherwise"
// null
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-boolean-expressions
