# Conversion functions — years and months duration(from, to)

Returns the years and months duration between `from` and `to`.

**Function signature**

```feel
years and months duration(from: date, to: date): years and months duration
```

**Examples**

```feel
years and months duration(date("2011-12-22"), date("2013-08-24"))
// duration("P1Y8M")
```


## from json(value)

Parses a JSON string into a FEEL value. The function converts JSON primitives, objects, and arrays into their corresponding FEEL types.

Returns `null` if the string is not a valid JSON value.

**Function signature**

```feel
from json(value: string): Any
```

**Examples**

```feel
from json("{\"a\": 1, \"b\": 2}")
// {a: 1, b: 2}

from json("true")
// true

from json("\"2023-06-14\"")
// "2023-06-14"
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-conversion
