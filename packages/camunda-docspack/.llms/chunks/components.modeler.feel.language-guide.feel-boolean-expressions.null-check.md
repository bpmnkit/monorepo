# Boolean expressions — Null check

Any value or variable can be compared with `null` to check if it is equal to `null`, or if it exists.

Comparing `null` to a value different from `null` results in `false`. It returns `true` if the
value is `null` or the variable doesn't exist.

Comparing a context entry with `null` results in `true` if the value of the entry is `null` or if
the context doesn't contain an entry with this key.

```feel
null = null
// true

"foo" = null
// false

{x: null}.x = null
// true

{}.y = null
// true
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-boolean-expressions
