# Range functions

This document outlines range functions and examples.

A set of functions establish relationships between single scalar values and ranges of such values.
All functions take two arguments and return `true` if the relationship between the argument holds,
or `false` otherwise.

A scalar value must be of the following type:

- number
- date
- time
- date-time
- days-time-duration
- years-months-duration

![range functions overview](../assets/feel-built-in-functions-range-overview.png)


## before(point1, point2)

**Function signature**

```feel
before(point1: Any, point2: Any): boolean
```

**Examples**

```feel
before(1, 10)
// true

before(10, 1)
// false
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-range
