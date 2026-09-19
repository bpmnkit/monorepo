# Routing events to processes — Choosing the right BPMN event — Start events

Several BPMN start events can be used to start a new process instance.

|                         | None Event                                                                    | Message Event                                                           | Timer Event                                                            | Signal Event                                                          | Conditional Event                                                                |
| ----------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
|                         | ![none start](/img/bpmn-elements/none-start.svg)                              | ![message start](/img/bpmn-elements/message-start.svg)                  | ![timer start](/img/bpmn-elements/timer-start.svg)                     | ![signal start](/img/bpmn-elements/signal-start.svg)                  | ![conditional start](/img/bpmn-elements/conditional-start.svg)                   |
| Use when                | You have only **one start event** or a start event which is clearly standard. | You have to differentiate **several start events**.                     | You want to automatically start process instances **time controlled**. | You need to start **several process instances** at once. Rarely used. | When a specific **condition** is met, a process instance is created.             |
| Supported for Execution | ✔                                                                             | ✔                                                                       | ✔                                                                      | ✔                                                                     | Determine occurrence of condition externally yourself and use the message event. |
|                         | [Learn more](https://docs.camunda.io/docs/next/components/modeler/bpmn/none-events/none-events)             | [Learn more](https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events) | [Learn more](https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events)    | [Learn more](https://docs.camunda.io/docs/next/components/modeler/bpmn/signal-events/signal-events) |                                                                                  |

Diagram (BPMN): TwitterDemoProcess
  start "New Tweet written" → exclusive gateway → user task "Review tweet" → exclusive gateway "Tweet approved?"
    — [Yes: =approved] service task "Publish on Twitter" → end "Tweet published"
    — [No: =not(approved)] service task "Send rejection notification" → end "Tweet rejected"
  start "Tweet suggested by robot" → user task "Formulate tweet" → (back to exclusive gateway)
  start "Tweet received by legacy adapter" → service task "Transform tweet data" → (back to exclusive gateway)

**(1)**

This none start event indicates the typical starting point. Note that only _one_ such start event can exist in one process definition.

**(2)**

This message start event is defined to react to a specific message type...

**(3)**

...hence you can have _multiple_ message start events in a process definition. In this example, both message start events seems to be exceptional cases - for equivalent cases we recommend to just use message instead of none start events.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/routing-events-to-processes
