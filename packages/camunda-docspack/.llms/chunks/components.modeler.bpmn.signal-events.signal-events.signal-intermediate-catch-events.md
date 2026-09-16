# Signal events — Signal intermediate catch events

When a signal intermediate catch event is entered, a signal subscription is created.
The process instance stops at this point and waits until it is triggered by a broadcasted signal with the same name.

Broadcasting a signal will iterate over the available subscriptions. If the name of the broadcasted signal matches the
name of the signal subscription, it triggers the signal subscription.

When the subscription is triggered, the corresponding signal catch event is completed and the process instance continues.


## Signal boundary events

An activity can have one or more signal boundary events.
Each of the signal events must have a unique signal name.

When the activity is entered, it creates a signal subscription for each boundary signal event.
If a non-interrupting boundary event is triggered, the activity is not terminated and multiple broadcasted signals can
trigger the boundary events.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/signal-events/signal-events
