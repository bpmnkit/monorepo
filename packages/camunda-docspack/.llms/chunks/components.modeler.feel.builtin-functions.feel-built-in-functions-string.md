# String functions

This document outlines built-in string functions and examples.


## substring(string, start position)

Returns a substring of the given value starting at `start position`.

**Function signature**

```feel
substring(string: string, start position: number): string
```

The `start position` starts at the index `1`. The last position is `-1`.

**Examples**

```feel
substring("foobar", 3)
// "obar"

substring("foobar", -2)
// "ar"
```


## substring(string, start position, length)

Returns a substring of the given value, starting at `start position` with the given `length`. If `length` is greater than
the remaining characters of the value, it returns all characters from `start position` until the end.

**Function signature**

```feel
substring(string: string, start position: number, length: number): string
```

The `start position` starts at the index `1`. The last position is `-1`.

**Examples**

```feel
substring("foobar", 3, 3)
// "oba"

substring("foobar", -3, 2)
// "ba"

substring("foobar", 3, 10)
// "obar"
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-string
