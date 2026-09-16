# Escalation events — Throwing the escalation

An escalation can be thrown by an escalation end event, or by an intermediate escalation throw event. Escalation events
are non-critical. This means that if the throwing event has any outgoing sequence flows, they will be taken.


## Catching the escalation

An escalation can be caught using a boundary event, or using an event subprocess. It is caught by one catch event at most, and this will be the catch event in the nearest parent flow scope.

It is not possible to define multiple escalation catch events with the same `escalationCode` in a single scope. It is also not permitted to have multiple escalation catch-all events in a single scope. However, it is possible to define both an escalation catch event referencing an escalation with a particular `escalationCode` and an escalation catch-all event within the same scope. When this happens, the escalation catch event
that matches the `escalationCode` is prioritized.

If there are no escalation catch events that match the `escalationCode`, the escalation will not be caught. Unlike with
[error events](https://docs.camunda.io/docs/next/components/modeler/bpmn/error-events/error-events), no incident is raised. The process will continue without escalating.

Even though escalations are non-critical, it is still possible make escalation catch events interrupting. This will
behave the same as other interrupting events. The catch event will terminate the scope it is attached to. In this case,
the outgoing sequence flows of the throwing escalation event are not taken.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/escalation-events/escalation-events
