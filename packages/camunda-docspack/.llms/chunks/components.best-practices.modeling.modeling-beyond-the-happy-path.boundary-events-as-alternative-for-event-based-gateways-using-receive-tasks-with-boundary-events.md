# Modeling beyond the happy path — Boundary events as alternative for event based gateways — Using receive tasks with boundary events

The examples above leverage the _event based gateway_. BPMN also allows to model _receive tasks_ that wait for responses. This has the advantage that you now can leverage boundary events to deal with _missing results_ or other _events occuring while you are waiting_ for the response. This is an _alternative_ to the event-based gateways shown in the above models.

Diagram (BPMN):
  start "Order received" → "Check order completeness" → exclusive gateway "Order complete?"
    — [Yes: =complete] "Check customer's credit-worthiness" → exclusive gateway "Customer credit-worthy?"
      — [Yes: =creditWorthy] "Request delivery date" → "Receive delivery date" → "Mail order confirmation" → end "Order confirmed"
      — [No: =not(creditWorthy)] exclusive gateway → end "Order declined"
    — [No: =not(complete)] (back to exclusive gateway)

**(1)**

Instead of modeling an event for receiving a delivery date, we model a _task_ here.

**(2)**

The fact that we do not receive such an answer at all can now be modeled as an _interrupting boundary timer event_. We inform the customer about the status, but as the timer is interrupting, do not wait any longer for the delivery date.

**(3)**

It might turn out that the ordered good is not deliverable. This can be modeled as _boundary message event_. Upon that message we cancel any further waiting but inform the customer about the status instead.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-beyond-the-happy-path
