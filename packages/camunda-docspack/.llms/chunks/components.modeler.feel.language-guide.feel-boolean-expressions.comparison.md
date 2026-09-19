# Boolean expressions — Comparison

Compares two values with one of the following operators.

Both values must be of the same type. Otherwise, the result is `null`.

  
    Operator
    Description
    Supported types
  

  
    =
    equal to
    any
  

  
    !=
    not equal to
    any
  

  
    &lt;
    less than
    number, string, date, time, date-time, duration
  

  
    &lt;=
    less than or equal to
    number, string, date, time, date-time, duration
  

  
    &gt;
    greater than
    number, string, date, time, date-time, duration
  

  
    &gt;=
    greater than or equal
    number, string, date, time, date-time, duration
  

  
    between [x] and [y]
    same as (_ &gt;= x and _ &lt;= y)
    number, string, date, time, date-time, duration
  

```feel
5 = 5
// true

5 != 5
// false

date("2020-04-05") < date("2020-04-06")
// true

time("08:00:00") <= time("08:00:00")
// true

duration("P1D") > duration("P5D")
// false

duration("P1Y") >= duration("P6M")
// true

5 between 3 and 7
// true

date("2020-04-06") between date("2020-04-05") and date("2020-04-09")
// true
```

**Caution: Be Careful!**
The equals operator has only **one** equals sign (e.g. `x = y`). In other languages, the operator has two equals signs (e.g. `x == y`).

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-boolean-expressions
