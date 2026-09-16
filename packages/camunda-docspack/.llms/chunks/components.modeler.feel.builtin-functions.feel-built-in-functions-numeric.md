# Numeric functions

This document outlines built-in numeric functions and examples.


## decimal(n, scale)

Rounds the given value at the given scale.

**Function signature**

```feel
decimal(n: number, scale: number): number
```

**Examples**

```feel
decimal(1/3, 2)
// .33

decimal(1.5, 0)
// 2
```


## floor(n)

Rounds the given value with rounding mode flooring.

**Function signature**

```feel
floor(n: number): number
```

**Examples**

```feel
floor(1.5)
// 1

floor(-1.5)
// -2
```


## floor(n, scale)

Rounds the given value with rounding mode flooring at the given scale.

**Function signature**

```feel
floor(n: number, scale: number): number
```

**Examples**

```feel
floor(-1.56, 1)
// -1.6
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-numeric
