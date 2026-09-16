# Introduction

FEEL expressions are powerful and can be used for various cases.

FEEL expressions are powerful and can be used for various cases.

This section is split into expressions based on their operational data type:

- [Boolean](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-boolean-expressions)
- [String](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-string-expressions)
- [Numeric](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-numeric-expressions)
- [List](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-list-expressions)
- [Context](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-context-expressions)
- [Temporal](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-temporal-expressions)

The following sections cover more general areas that are not restricted to one data type:

- [Variables](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-variables)
- [Control flow](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-control-flow)
- [Functions](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-functions)
- [Error handling](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-error-handling)

### Comments

An expression can contain comments to explain it and give it more context. This can be done using
Java-style comments: `//` to the end of line, or `/*.... */` for blocks.

```feel
// returns the last item
[1,2,3,4][-1]

/* returns the last item */
[1,2,3,4][-1]

/*
 * returns the last item
 */
[1,2,3,4][-1]
```

### Parentheses

Parentheses `( .. )` can be used in expressions to separate different parts of an
expression or to influence the precedence of the operators.

```feel
(5 - 3) * (4 / 2)

x < 5 and (y > 10 or z > 20)

if (5 < 10) then "low" else "high"
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-expressions-introduction
