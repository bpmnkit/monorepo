# Temporal functions

This document outlines built-in temporal functions and examples.


## now()

Returns the current date and time including the timezone.

**Function signature**

```feel
now(): date and time
```

**Examples**

```feel
now()
// date and time("2020-07-31T14:27:30@Europe/Berlin")
```


## today()

Returns the current date.

**Function signature**

```feel
today(): date
```

**Examples**

```feel
today()
// date("2020-07-31")
```


## day of week(date)

Returns the day of the week according to the Gregorian calendar. Note that it always returns the English name of the day.

**Function signature**

```feel
day of week(date: date): string
```

```feel
day of week(date: date and time): string
```

**Examples**

```feel
day of week(date("2019-09-17"))
// "Tuesday"

day of week(date and time("2019-09-17T12:00:00"))
// "Tuesday"
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-temporal
