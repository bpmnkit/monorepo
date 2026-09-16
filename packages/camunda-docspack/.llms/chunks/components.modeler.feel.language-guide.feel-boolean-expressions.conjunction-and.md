# Boolean expressions — Conjunction/and

Combines multiple boolean values following the ternary logic.

- The result is `true` if all values are `true`.
- The result is `false` if one value is `false`.
- Otherwise, the result is `null` (i.e. if a value is not a boolean.)

```feel
true and true
// true

true and false
// false

true and null
// null

true and "otherwise"
// null

false and null
// false

false and "otherwise"
// false
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-boolean-expressions
