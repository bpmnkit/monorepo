# Numeric functions — round half down(n, scale)

Rounds the given value with the rounding mode round-half-down at the given scale.

**Function signature**

```feel
round half down(n: number, scale: number): number
```

**Examples**

```feel
round half down (5.5, 0)
// 5

round half down (-5.5, 0)
// -5

round half down (1.121, 2)
// 1.12

round half down (-1.126, 2)
// -1.13
```


## abs(number)

Returns the absolute value of the given numeric value.

**Function signature**

```feel
abs(number: number): number
```

**Examples**

```feel
abs(10)
// 10

abs(-10)
// 10
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-numeric
