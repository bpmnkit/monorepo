# Numeric functions — round down(n, scale)

Rounds the given value with the rounding mode round-down at the given scale.

**Function signature**

```feel
round down(n: number, scale: number): number
```

**Examples**

```feel
round down(5.5, 0)
// 5

round down (-5.5, 0)
// -5

round down (1.121, 2)
// 1.12

round down (-1.126, 2)
// -1.12
```


## round half up(n, scale)

Rounds the given value with the rounding mode round-half-up at the given scale.

**Function signature**

```feel
round half up(n: number, scale: number): number
```

**Examples**

```feel
round half up(5.5, 0)
// 6

round half up(-5.5, 0)
// -6

round half up(1.121, 2)
// 1.12

round half up(-1.126, 2)
// -1.13
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-numeric
