# Routing events to processes — Choosing the right BPMN event — Intermediate events

Several BPMN intermediate events (and the receive task) can be used to make a process instance _wait_ for and _react_ to certain triggers.

|                         | Message Event                                                                | Receive Task                                                                                    | Timer Event                                                                    | Signal Event                                                              | Conditional Event                                                            |
| ----------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
|                         | ![message intermediate](/img/bpmn-elements/message-intermediate.svg)         | ![task receive](/img/bpmn-elements/task-receive.svg)                                            | ![timer intermediate](/img/bpmn-elements/timer-intermediate.svg)               | ![signal intermediate](/img/bpmn-elements/signal-intermediate.svg)        | ![conditional intermediate](/img/bpmn-elements/conditional-intermediate.svg) |
| Use when                | You route an incoming **message** to a specific and unique process instance. | As alternative to message events (to leverage BPMN boundary events, for example, for timeouts). | You want to make your process instance wait for a certain (point in) **time**. | You route an incoming **signal** to all process instances waiting for it. | When a specific **condition** is met, the waiting process instance moves on. |
| Supported for Execution | ✔                                                                            | ✔                                                                                               | ✔                                                                              | ✔                                                                         | Not yet supported in Camunda 8                                               |
|                         | [Learn more](https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events)      | [Learn more](https://docs.camunda.io/docs/next/components/modeler/bpmn/receive-tasks/receive-tasks)                           | [Learn more](https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events)            | [Learn more](https://docs.camunda.io/docs/next/components/modeler/bpmn/signal-events/signal-events)     |                                                                              |

Consider this example:

Diagram (BPMN):
  start "Order received" → "Send order confirmation" → intermediate catch event "Payment received" → call activity "Order fulfillment" → end "Order fulfilled"

**(1)**

This intermediate message event causes the process instance to wait unconditionally for a _specific_ event...

**(2)**

...whereas the intermediate message event attached to the boundary of an activity waits for an _optional_ event, potentially arriving while we are occupied with the activity.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/routing-events-to-processes
