# Signal events — Signal throw events

A process can contain signal intermediate throw events or signal end events to model the broadcasting of a signal.

When a signal throw events is entered, it broadcasts a signal that can trigger signal subscriptions.


## Signals

In BPMN, a signal event references a `signal`.
Signals can be referenced by one or more signal events.

A signal must define a `name`. The value is used to determine:

- The name of the signal to broadcast for a signal throw event.
- The name of the signal to subscribe to for a signal catch event.

Usually, the name of the signal is defined as a [static value](https://docs.camunda.io/docs/next/components/modeler/concepts/expressions#expressions-vs-static-values)
(e.g. `order canceled`), but it can also be defined as an [expression](https://docs.camunda.io/docs/next/components/modeler/concepts/expressions)
(e.g. `= "order " + awaitingAction`). If the expression belongs to a signal start event of the process, it is evaluated
on deploying the process. Otherwise, it is evaluated on activating the signal event. The evaluation must result in a
`string`.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/signal-events/signal-events
