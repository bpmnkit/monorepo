# Timer events — Timers

Timers must be defined by providing either a date, a duration, or a cycle.

A timer can be defined either as a [static value](https://docs.camunda.io/docs/next/components/concepts/expressions#expressions-vs-static-values) (e.g. `P3D`) or as an [expression](https://docs.camunda.io/docs/next/components/concepts/expressions). There are two common ways to use an expression:

- [Access a variable](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-variables#access-variable) (e.g. `= remainingTime`).
- [Use temporal values](https://docs.camunda.io/docs/next/components/concepts/expressions#temporal-expressions) (e.g. `= date and time(expirationDate) - date and time(creationDate)`).

If the expression belongs to a timer start event of the process, it is evaluated on deploying the process. Otherwise, it is evaluated on activating the timer catch event. The evaluation must result in either a `string` that has the same ISO 8601 format as the static value, or an equivalent temporal value (i.e. a date-time, a duration, or a cycle).

**Note**
Zeebe is an asynchronous system. As a result, there is no guarantee a timer triggers exactly at the configured time.

Depending on how much load the system is under, timers could trigger later than their due date. However, timers will never trigger earlier than the due date.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events
