# Temporal functions — month of year(date)

Returns the month of the year according to the Gregorian calendar. Note that it always returns the English name of the month.

**Function signature**

```feel
month of year(date: date): string
```

```feel
month of year(date: date and time): string
```

**Examples**

```feel
month of year(date("2019-09-17"))
// "September"

month of year(date and time("2019-09-17T12:00:00"))
// "September"
```


## abs(n)

Returns the absolute value of a given duration.

**Function signature**

```feel
abs(n: days and time duration): days and time duration
```

```feel
abs(n: years and months duration): years and months duration
```

**Examples**

```feel
abs(duration("-PT5H"))
// "duration("PT5H")"

abs(duration("PT5H"))
// "duration("PT5H")"

abs(duration("-P2M"))
// duration("P2M")
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-temporal
