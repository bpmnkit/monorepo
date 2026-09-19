# Boolean functions

This document outlines current boolean functions and a few examples.


## not(negand)

Returns the logical negation of the given value.

**Function signature**

```feel
not(negand: boolean): boolean
```

**Examples**

```feel
not(true)
// false

not(null)
// null
```


## is defined(value)

(Camunda extension)(Camunda extension)

Checks if a given value is not `null`. If the value is `null` then the function returns `false`.
Otherwise, the function returns `true`.

The function requires one argument. Calling `is defined()` without an argument is invalid.

**Function signature**

```feel
is defined(value: Any): boolean
```

**Examples**

```feel
is defined(1)
// true

is defined(null)
// false

is defined(x)
// false - if no variable "x" exists

is defined(x.y)
// false - if no variable "x" exists or it doesn't have a property "y"

is defined()
// error - expected one argument
```

**Caution: Breaking change**

This function worked differently in previous versions. It returned `true` if the value was `null`.
Since this version, the function returns `false` if the value is `null`.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-boolean
