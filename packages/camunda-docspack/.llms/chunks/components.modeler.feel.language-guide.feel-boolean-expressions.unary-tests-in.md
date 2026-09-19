# Boolean expressions — Unary-tests/in

Evaluates a [unary-tests](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-unary-tests) with the given value. The keyword `in` separates the value from the unary-tests.

```feel
5 in (3..7)
// true

date("2021-06-04") in [date("2021-05-01")..date("2021-05-31")]
// false

5 in (3,5,7)
// true

5 in [2,4,6,8]
// false
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-boolean-expressions
