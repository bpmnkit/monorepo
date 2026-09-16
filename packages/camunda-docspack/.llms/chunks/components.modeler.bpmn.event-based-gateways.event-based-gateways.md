# Event-based gateway

An event-based gateway allows you to make a decision based on events.

An event-based gateway allows you to make a decision based on events.

![process](assets/event-based-gateway.png)

An event-based gateway must have at least **two** outgoing sequence flows. Each sequence flow must be connected to
an intermediate catch event of type [timer](https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events),
[message](https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events) or [signal](https://docs.camunda.io/docs/next/components/modeler/bpmn/signal-events/signal-events).

When an event-based gateway is entered, the process instance waits at the gateway until one of the events is triggered. When the first event is triggered, the outgoing sequence flow of this event is taken. No other events of the gateway can be triggered afterward.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/event-based-gateways/event-based-gateways
