# Temporal expressions — Subtraction

Subtracts a value from another value. The operator is defined for the following types.

If a value has a different type, the result is `null`.

If one value has a timezone or time-offset, the other value must have a timezone or time-offset too. Otherwise, the result is `null`.

  
    First argument
    Second argument
    Result
  

  
    date
    date
    days-time-duration
  

  
    date
    duration
    date
  

  
    time
    time
    days-time-duration
  

  
    time
    days-time-duration
    time
  

  
    date-time
    date-time
    days-time-duration
  

  
    date-time
    duration
    date-time
  

  
    days-time-duration
    days-time-duration
    days-time-duration
  

  
    years-months-duration
    years-months-duration
    years-months-duration
  

```feel
date("2020-04-06") - date("2020-04-01")
// duration("P5D")

date("2020-04-06") - duration("P5D")
// date("2020-04-01")

time("08:00:00") - time("06:00:00")
// duration("PT2H")

time("08:00:00") - duration("PT2H")
// time("06:00:00")

duration("P7D") - duration("P2D")
// duration("P5D")

duration("P1Y") - duration("P3M")
// duration("P9M")
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-temporal-expressions
