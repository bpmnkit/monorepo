# Signal events

Signal events are events which reference a signal; they are used to wait until a matching signal is received.

Signal events are events which reference a [signal](https://docs.camunda.io/docs/next/components/concepts/signals).
Broadcasting a signal will trigger _all_ signal events matching the name of the broadcasted signal.

![Process with multiple different signal events](assets/signal-events.png)

Signal events are typically used if you want to communicate with multiple listeners. For intermediate events, a signal will trigger all process instances with a token waiting at a corresponding catch event, even across different processes. For start events, a signal will start one instance per process that has a corresponding signal start. Thus, signals form a single sender to several-recipient relationship.

These differ from [message events](https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events), which are used if a single process instance needs to wait for a message from a secondary process or an external system. This is a single sender to a single recipient relationship (1:1), as the message cannot have more than one recipient.

Both event types are methods of collaboration within BPMN.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/signal-events/signal-events
