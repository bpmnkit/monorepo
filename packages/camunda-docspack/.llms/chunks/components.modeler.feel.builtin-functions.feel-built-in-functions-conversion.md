# Conversion functions

This document outlines conversion functions and a few examples.

Convert a value into a different type.


## string(from)

Returns the given value as a string representation.

**Function signature**

```feel
string(from: Any): string
```

**Examples**

```feel
string(1.1)
// "1.1"

string(date("2012-12-25"))
// "2012-12-25"
```


## number(from)

Parses the given string to a number.

Returns `null` if the string is not a number.

**Function signature**

```feel
number(from: string): number
```

**Examples**

```feel
number("1500.5")
// 1500.5
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-conversion
