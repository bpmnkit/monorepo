# Conversion functions — date and time(date, time)

Returns a date and time from the given components.

**Function signature**

```feel
date and time(date: date, time: time): date and time
```

```feel
date and time(date: date and time, time: time): date and time
```

Returns a date and time value that consists of the date component of `date` combined with `time`.

**Examples**

```feel
date and time(date("2012-12-24"),time("T23:59:00"))
// date and time("2012-12-24T23:59:00")

date and time(date and time("2012-12-25T11:00:00"),time("T23:59:00"))
// date and time("2012-12-25T23:59:00")
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-conversion
