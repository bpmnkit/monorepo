# Conversion functions — time(from)

Returns a time from the given value.

**Function signature**

```feel
time(from: string): time
```

Parses the given string into a time.

```feel
time(from: date and time): time
```

Extracts the time component from the given date and time.

**Examples**

```feel
time("12:00:00")
// time("12:00:00")

time(date and time("2012-12-25T11:00:00"))
// time("11:00:00")
```


## time(hour, minute, second)

Returns a time from the given components.

**Function signature**

```feel
time(hour: number, minute: number, second: number): time
```

**Examples**

```feel
time(23, 59, 0)
// time("23:59:00")
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-conversion
