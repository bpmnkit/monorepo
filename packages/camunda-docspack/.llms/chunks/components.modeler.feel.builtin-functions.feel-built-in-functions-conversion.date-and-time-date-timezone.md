# Conversion functions — date and time(date, timezone)

(Camunda extension)(Camunda extension)

Returns the given date and time value at the given timezone.

If `date` has a different timezone than `timezone` then it adjusts the time to match the local time of `timezone`.

**Function signature**

```feel
date and time(date: date and time, timezone: string): date and time
```

**Examples**

```feel
date and time(@"2020-07-31T14:27:30@Europe/Berlin", "America/Los_Angeles")
// date and time("2020-07-31T05:27:30@America/Los_Angeles")

date and time(@"2020-07-31T14:27:30", "Z")
// date and time("2020-07-31T12:27:30Z")
```


## duration(from)

Parses the given string into a duration. The duration is either a days and time duration or a years and months duration.

**Function signature**

```feel
duration(from: string): days and time duration
```

```feel
duration(from: string): years and months duration
```

**Examples**

```feel
duration("P5D")
// duration("P5D")

duration("P32Y")
// duration("P32Y")
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-conversion
