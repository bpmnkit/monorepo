# Temporal expressions — Literal

Creates a new temporal value. A value can be written in one of the following ways:

- using a temporal function (for example, `date("2020-04-06")`)
- using the `@` - notation (for example, `@"2020-04-06"`)

```feel
date("2020-04-06")
@"2020-04-06"

time("08:00:00")
time("08:00:00+02:00")
time("08:00:00@Europe/Berlin")
@"08:00:00"
@"08:00:00+02:00"
@"08:00:00@Europe/Berlin"

date and time("2020-04-06T08:00:00")
date and time("2020-04-06T08:00:00+02:00")
date and time("2020-04-06T08:00:00@Europe/Berlin")
@"2020-04-06T08:00:00"
@"2020-04-06T08:00:00+02:00"
@"2020-04-06T08:00:00@Europe/Berlin"

duration("P5D")
duration("PT6H")
@"P5D"
@"PT6H"

duration("P1Y6M")
duration("P3M")
@"P1Y6M"
@"P3M"
```

The value is `null` if a date or date-time literal doesn't represent a valid calendar date. For example, `@"2024-06-31"` is invalid because June has only 30 days.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-temporal-expressions
