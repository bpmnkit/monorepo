# Temporal functions — day of year(date)

Returns the Gregorian number of the day within the year.

**Function signature**

```feel
day of year(date: date): number
```

```feel
day of year(date: date and time): number
```

**Examples**

```feel
day of year(date("2019-09-17"))
// 260

day of year(date and time("2019-09-17T12:00:00"))
// 260
```


## week of year(date)

Returns the Gregorian number of the week within the year, according to ISO 8601.

**Function signature**

```feel
week of year(date: date): number
```

```feel
week of year(date: date and time): number
```

**Examples**

```feel
week of year(date("2019-09-17"))
// 38

week of year(date and time("2019-09-17T12:00:00"))
// 38
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-temporal
