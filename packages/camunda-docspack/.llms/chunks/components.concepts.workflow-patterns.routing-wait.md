# Workflow patterns — Routing — Wait

A typical situation is that a process needs to wait for some event to happen, e.g. some time to pass or some external message to arrive. This is related to [Workflow Pattern 23: Transient Trigger](http://www.workflowpatterns.com/patterns/control/new/wcp23.php).

In BPMN, this is implemented using [events](https://docs.camunda.io/docs/next/components/modeler/bpmn/events) (or [receive tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/receive-tasks/receive-tasks)):

Diagram (BPMN):
  start → "Schedule delivery" → intermediate catch event "Wait for two business days before the delivery date" → "Prepare shipment" → intermediate catch event "Wait for delivery confirmation" → "Wrap up delivery process" → end

**(1)**

The timer event causes the process to wait, in this case until a specific point in time is due or some duration has elapsed. Refer to [timer events](https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events) for more details.

**(2)**

The process will wait for a message to arrive. The message is an external trigger provided by API and can technically be anything, from a callback (e.g. via REST), over real messaging (like AMQP), or to notifications within your system. Refer to [message events](https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events) for more details.

You can read more about events in [our BPMN primer: events - waiting for something to happen](https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-primer#events-waiting-for-something-to-happen).

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns
