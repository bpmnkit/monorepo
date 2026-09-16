# Conversion functions — date(from)

Returns a date from the given value.

Returns `null` if the string is not a valid calendar date. For example, `"2024-06-31"` is invalid because June has
only 30 days.

**Function signature**

```feel
date(from: string): date
```

Parses the given string into a date.

```feel
date(from: date and time): date
```

Extracts the date component from the given date and time.

**Examples**

```feel
date("2018-04-29")
// date("2018-04-29")

date(date and time("2012-12-25T11:00:00"))
// date("2012-12-25")
```


## date(year, month, day)

Returns a date from the given components.

Returns `null` if the components don't represent a valid calendar date. For example, `2024,6,31` is invalid because
June has only 30 days.

**Function signature**

```feel
date(year: number, month: number, day: number): date
```

**Examples**

```feel
date(2012, 12, 25)
// date("2012-12-25")
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-conversion
