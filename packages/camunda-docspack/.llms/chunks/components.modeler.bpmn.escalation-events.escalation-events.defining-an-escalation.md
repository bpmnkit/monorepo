# Escalation events — Defining an escalation

In BPMN, an `escalation event` references an `escalation`. Escalations can be referenced by one or more escalation events.

An escalation must define an `escalationCode`. The value of this `escalationCode` is used to determine which catch event can catch the thrown escalation.

For escalation throw events, it is possible to define the `escalationCode` as [an `expression` or a static value](https://docs.camunda.io/docs/next/components/concepts/expressions#expressions-vs-static-values). If an `escalationCode` expression is configured then it will be evaluated once the event is reached, and used to throw the escalation.

For escalation catch events `escalationCode` must be [a static value](https://docs.camunda.io/docs/next/components/concepts/expressions#expressions-vs-static-values).
Alternatively an escalation catch event may omit the escalation reference all together. In this case it catches **all** thrown escalations.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/escalation-events/escalation-events
