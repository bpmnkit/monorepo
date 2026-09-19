# Timer events — Timers — Time cycle

A cycle defined as ISO 8601 repeating intervals format; it contains the duration and the number of repetitions. If the repetitions are not defined, the timer repeats infinitely until it is canceled.

- `R5/PT10S`: Every 10 seconds, up to five times
- `R/P1D`: Every day, infinitely

It's possible to define a start time. By doing this, the timer triggers for the first time on the given start time. Afterwards, it will follow the interval as usual.

- `R3/2022-04-27T17:20:00Z/P1D`: Every day up to three times, starting from April 27, 2022 at 5:20 p.m. UTC
- `R/2022-01-01T10:00:00+02:00[Europe/Berlin]/P1D`: Every day infinitely, starting from January 1, 2022 at 10 a.m. UTC plus 2 hours

If the start time is in the past at the time of deployment, the timer fires immediately upon deployment, and then continues with the regular interval from that point on.

Additionally, you can specify a time cycle using cron expressions. Refer to the [CronExpression Tutorial](https://spring.io/blog/2020/11/10/new-in-spring-5-3-improved-cron-expressions) for additional information about using cron expressions.

- `0 0 9-17 * * MON-FRI`: Every hour on the hour from 9-5 p.m. UTC Monday-Friday

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events
