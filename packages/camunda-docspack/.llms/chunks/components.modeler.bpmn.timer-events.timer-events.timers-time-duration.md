# Timer events — Timers — Time duration

A duration is defined as a ISO 8601 durations format, which defines the amount of intervening time in a time interval and are represented by the format `P(n)Y(n)M(n)DT(n)H(n)M(n)S`. Note that the `n` is replaced by the value for each of the date and time elements that follow the `n`.

The capital letters _P_, _Y_, _M_, _W_, _D_, _T_, _H_, _M_, and _S_ are designators for each of the date and time elements and are not replaced, but can be omitted.

- _P_ is the duration designator (for period) placed at the start of the duration representation.
- _Y_ is the year designator that follows the value for the number of years.
- _M_ is the month designator that follows the value for the number of months.
- _W_ is the week designator that follows the value for the number of weeks.
- _D_ is the day designator that follows the value for the number of days.
- _T_ is the time designator that precedes the time components of the representation.
- _H_ is the hour designator that follows the value for the number of hours.
- _M_ is the minute designator that follows the value for the number of minutes.
- _S_ is the second designator that follows the value for the number of seconds.

Examples:

- `PT15S` - 15 seconds
- `PT1H30M` - 1 hour and 30 minutes
- `P14D` - 14 days
- `P14DT1H30M` - 14 days, 1 hour and 30 minutes
- `P3Y6M4DT12H30M5S` - 3 years, 6 months, 4 days, 12 hours, 30 minutes and 5 seconds

If the duration is zero or negative, the timer fires immediately.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events
