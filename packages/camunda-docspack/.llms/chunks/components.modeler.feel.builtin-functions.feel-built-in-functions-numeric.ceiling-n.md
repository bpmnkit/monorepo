# Numeric functions — ceiling(n)

Rounds the given value with rounding mode ceiling.

**Function signature**

```feel
ceiling(n: number): number
```

**Examples**

```feel
ceiling(1.5)
// 2

ceiling(-1.5)
// -1
```


## ceiling(n, scale)

Rounds the given value with rounding mode ceiling at the given scale.

**Function signature**

```feel
ceiling(n: number, scale: number): number
```

**Examples**

```feel
ceiling(-1.56, 1)
// -1.5
```


## round up(n, scale)

Rounds the given value with the rounding mode round-up at the given scale.

**Function signature**

```feel
round up(n: number, scale: number): number
```

**Examples**

```feel
round up(5.5)
// 6

round up(-5.5)
// -6

round up(1.121, 2)
// 1.13

round up(-1.126, 2)
// -1.13
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-numeric
