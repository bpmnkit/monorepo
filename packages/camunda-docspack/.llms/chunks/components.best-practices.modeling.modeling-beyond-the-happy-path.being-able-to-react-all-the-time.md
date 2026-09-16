# Modeling beyond the happy path — Being able to react all the time

A bit similar to boundary events, with BPMN event subprocesses we can deal with problems arising while we are actively occupied to carry out work. The main advantage when being compared with boundary events is that some issues can _occur almost anywhere_ on our way through the happy path.

### Dealing with issues occurring almost anywhere

Some issues can occur almost anywhere on the way through our process. The event subprocess allows us to fork off a _problem path_ modeled separately from our main process to deal with such issues:

Diagram (BPMN):
  start "Order received" → subprocess → event-based gateway
    — intermediate catch event "Delivery date fixed" → "Mail order confirmation" → end "Order confirmed"
    — intermediate catch event "Ordered good not deliverable" → exclusive gateway → "Inform customer" → end "Order not deliverable"
    — intermediate catch event "Answer overdue" → (back to exclusive gateway)

**(1)**

The _non-interrupting start message event_ of the event subprocess allows us to express that wherever we currently are on our way through order confirmation, it can happen that the customer requests information about the status of that process.

**(2)**

We should then provide the requested information without interferring with the order confirmation process itself.

### Dealing with canceling the process

Another typical use case for event-based subprocesses is a cancellation requested by the customer:

Diagram (BPMN):
  start "Order received" → subprocess → event-based gateway
    — intermediate catch event "Delivery date fixed" → "Mail order confirmation" → end "Order confirmed"
    — intermediate catch event "Ordered good not deliverable" → exclusive gateway → "Inform customer" → end "Order not deliverable"
    — intermediate catch event "Answer overdue" → (back to exclusive gateway)

**(1)**

The _interrupting start message event_ of the event subprocess allows us to express that wherever we currently are on our way through order confirmation, it can happen that the customer requests cancellation.

**(2)**

We should then interrupt the main process (which is already expressed by the nature of the start event) and inform an involved dealer.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-beyond-the-happy-path
