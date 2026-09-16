# Temporal functions — last day of month(date)

(Camunda extension)(Camunda extension)

Takes the month of the given date or date-time value and returns the last day of this month.

**Function signature**

```feel
last day of month(date: date): date
```

```feel
last day of month(date: date and time): date
```

**Examples**

```feel
last day of month(date("2022-10-01"))
// date("2022-10-31"))

last day of month(date and time("2022-10-16T12:00:00"))
// date("2022-10-31"))
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/builtin-functions/feel-built-in-functions-temporal
