# Conversion functions — time(hour, minute, second, offset)

Returns a time from the given components, including a timezone offset.

**Function signature**

```feel
time(hour: number, minute: number, second: number, offset: days and time duration): time
```

**Examples**

```feel
time(14, 30, 0, duration("PT1H"))
// time("14:30:00+01:00")
```


## date and time(from)

Parses the given string into a date and time. The function supports strings in the format `YYYY-MM-DDThh:mm:ss` with
optional timezone information either as offset (e.g., `+01:00` or `Z`), as IANA timezone ID (e.g., `@Europe/Berlin`), or
as a combination of both (e.g., `+01:00[Europe/Berlin]`).

Returns `null` if the string is not a valid calendar date. For example, `"2024-06-31T10:00:00"` is invalid because
June has only 30 days.

**Function signature**

```feel
date and time(from: string): date and time
```

**Examples**

```feel
date and time("2018-04-29T09:30:00")
// date and time("2018-04-29T09:30:00")

date and time("2018-04-29T09:30:00+02:00")
// date and time("2018-04-29T09:30:00+02:00")

date and time("2018-04-29T09:30:00@Europe/Berlin")
// date and time("2018-04-29T09:30:00@Europe/Berlin")

date and time("2018-04-29T09:30:00+02:00[Europe/Berlin]")
// date and time("2018-04-29T09:30:00@Europe/Berlin")
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-conversion
