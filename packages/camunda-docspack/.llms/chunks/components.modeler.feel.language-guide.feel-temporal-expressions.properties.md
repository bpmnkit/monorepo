# Temporal expressions — Properties

A temporal value has multiple properties for its components. The following properties are available
for the given types:

  
    Property
    Available for
    Description

  
    year
    date, date-time
    the year as number
  

  
    month
    date, date-time
    the month as number [1..12], where 1 is January
  

  
    day
    date, date-time
    the day of the month as number [1..31]
  

  
    weekday
    date, date-time
    the day of the week as number [1..7], where 1 is Monday
  

  
    hour
    time, date-time
    the hour of the day as number [0..23]
  

  
    minute
    time, date-time
    the minute of the hour as number [0..59]
  

  
    second
    time, date-time
    the second of the minute as number [0..59]
  

  
    time offset
    time, date-time
    the duration offset corresponding to the timezone or null
  

  
    timezone
    time, date-time
    the timezone identifier or null
  

  
    days
    days-time-duration
    the normalized days component as number
  

  
    hours
    days-time-duration
    the normalized hours component as number [0..23]
  

  
    minutes
    days-time-duration
    the normalized minutes component as number [0..59]
  

  
    seconds
    days-time-duration
    the normalized seconds component as number [0..59]
  

  
    years
    years-months-duration
    the normalized years component as number
  

  
    months
    years-months-duration
    the normalized months component as number [0..11]
  

```feel
date("2020-04-06").year
// 2020

date("2020-04-06").month
// 4

date("2020-04-06").weekday
// 1

time("08:00:00").hour
// 8

date and time("2020-04-06T08:00:00+02:00").time offset
// duration("PT2H")

date and time("2020-04-06T08:00:00@Europe/Berlin").timezone
// "Europe/Berlin"

duration("PT2H30M").hours
// 2

duration("PT2H30M").minutes
// 30

duration("P6M").months
// 6
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-temporal-expressions
