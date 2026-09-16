# Modeling beyond the happy path — Forking off at a particular point — Dealing with events

By using event-based gateways, we _passively wait_ for _future events_ deciding about which path our process will have to move along. For example, we can therefore use use it to fork off a "problem path" dealing with an undesired event _outside of our own control_:

Diagram (BPMN):
  start "Order received" → "Check order completeness" → exclusive gateway "Order complete?"
    — [Yes: =complete] "Check customer's credit-worthiness" → exclusive gateway "Customer credit-worthy?"
      — [Yes: =creditWorthy] "Request delivery date" → event-based gateway
        — intermediate catch event "Delivery date fixed" → "Mail order confirmation" → end "Order confirmed"
        — intermediate catch event "Ordered good not deliverable" → "Inform customer" → end "Order not deliverable"
      — [No: =not(creditWorthy)] exclusive gateway → end "Order declined"
    — [No: =not(complete)] (back to exclusive gateway)

**(1)**

After having requested a delivery date (e.g. from wholesale), we use an _event-based gateway_ to passively wait for what happens next. We can not know "now and here", because it's outside of our own control.

**(2)**

The _intermediate message event_ allows us to deal with the undesired event that the ordered good is not deliverable.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-beyond-the-happy-path
