# Workflow patterns — Reacting to events — External messages/events

You might also want to react to certain incoming messages or events in an existing process. A good example is a customer canceling the current order fulfillment process. This might be possible only in a certain process phase and lead to different actions. This is related to [Workflow Pattern 23: Transient Trigger](http://www.workflowpatterns.com/patterns/control/new/wcp23.php) and [Workflow Pattern 24: Persistent Trigger](http://www.workflowpatterns.com/patterns/control/new/wcp24.php).

As with timers, you can leverage [boundary events](https://docs.camunda.io/docs/next/components/modeler/bpmn/events#boundary-events) or [event subprocesses](https://docs.camunda.io/docs/next/components/modeler/bpmn/event-subprocesses/event-subprocesses).

Diagram (BPMN):
  start "Customer order received" → subprocess "Clearing" → subprocess "Preparation" → call activity "Delivery" → end "Order delivered"

Assume that an order cancelation message comes in for the current process instance using [message correlation](https://docs.camunda.io/docs/next/components/concepts/messages).

**(1)**

Subprocesses can be easily used to define phases of a process, as the cancelation is treated differently depending on the current process phase.

**(2)**

For example, a cancelation during the clearing phase has no consequences and can simply be executed.

**(3)**

But when the process is already in the preparation phase it might need to clean up certain things properly.

**(4)**

During delivery, it does not even allow cancelations anymore. This is also why this event is non-interrupting (dashed line), so we keep doing **Delivery**.

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns
