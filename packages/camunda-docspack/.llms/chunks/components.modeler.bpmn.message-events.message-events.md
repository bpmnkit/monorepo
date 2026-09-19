# Message events

Message events are events which reference a message; they are used to wait until a proper message is received.

Message events are events which reference a message; they are used to wait until a proper message is received.

![process](assets/message-events.png)

Message events are used if a single process instance needs to wait for a message from a secondary process or an external system. This is a single sender to a single recipient relationship (1:1), as the message cannot have more than one recipient.

These differ from [signal events](https://docs.camunda.io/docs/next/components/modeler/bpmn/signal-events/signal-events), which are used if you want to communicate with multiple listeners. For intermediate events, a signal will trigger all process instances with a token waiting at a corresponding catch event, even across different processes. For start events, a signal will start one instance per process that has a corresponding signal start. Unlike message events, signal events form a single sender to several-recipient relationship (1:N).

Both event types are methods of collaboration within BPMN.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events
