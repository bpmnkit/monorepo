# Temporal expressions — Addition

Adds a value to another value. The operator is defined for the following types.

If a value has a different type, the result is `null`.

  
    First argument
    Second argument
    Result
  

  
    date
    duration
    date
  

  
    time
    days-time-duration
    time
  

  
    date-time
    duration
    date-time
  

  
    duration
    date
    date
  

  
    duration
    time
    time
  

  
    duration
    date-time
    date-time
  

  
    duration
    duration
    duration
  

```feel
date("2020-04-06") + duration("P1D")
// date("2020-04-07")

time("08:00:00") + duration("PT1H")
// time("09:00:00")

date and time("2020-04-06T08:00:00") + duration("P7D")
// date and time("2020-04-13T08:00:00")

duration("P2D") + duration("P5D")
// duration("P7D")
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-temporal-expressions
