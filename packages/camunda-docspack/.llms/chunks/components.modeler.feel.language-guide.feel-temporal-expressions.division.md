# Temporal expressions — Division

Divides a value by another value. The operator is defined for the following types.

If a value has a different type, the result is `null`.

  
    First argument
    Second argument
    Result
  

  
    days-time-duration
    days-time-duration
    number
  

  
    days-time-duration
    number
    days-time-duration
  

  
    years-months-duration
    years-months-duration
    number
  

  
    years-months-duration
    number
    years-months-duration
  

```feel
duration("P5D") / duration("P1D")
// 5

duration("P5D") / 5
// duration("P1D")

duration("P1Y") / duration("P1M")
// 12

duration("P1Y") / 12
// duration("P1M")
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-temporal-expressions
