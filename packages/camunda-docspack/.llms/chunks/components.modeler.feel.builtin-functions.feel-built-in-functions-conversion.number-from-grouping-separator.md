# Conversion functions — number(from, grouping separator)

Parses the given string to a number using the specified grouping separator.

Returns `null` if the string is not a number.

**Function signature**

```feel
number(from: string, grouping separator: string): number
```

**Examples**

```feel
number("1,500", ",")
// 1500
```


## number(from, grouping separator, decimal separator)

Parses the given string to a number using the specified grouping and decimal separators.

Returns `null` if the string is not a number.

**Function signature**

```feel
number(from: string, grouping separator: string, decimal separator: string): number
```

**Examples**

```feel
number("1 500.5", " ", ".")
// 1500.5
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-conversion
