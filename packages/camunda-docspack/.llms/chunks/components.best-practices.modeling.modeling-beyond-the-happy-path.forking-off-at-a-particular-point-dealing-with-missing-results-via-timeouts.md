# Modeling beyond the happy path — Forking off at a particular point — Dealing with missing results via timeouts

By using event-based gateways, we can also deal with the situation that _nothing relevant_ for our process _happens_. We do this by defining a time period, after which we decide that we do not want to wait any longer:

Diagram (BPMN):
  start "Order received" → "Check order completeness" → exclusive gateway "Order complete?"
    — [Yes: =complete] "Check customer's credit-worthiness" → exclusive gateway "Customer credit-worthy?"
      — [Yes: =creditWorthy] "Request delivery date" → event-based gateway
        — intermediate catch event "Delivery date fixed" → "Mail order confirmation" → end "Order confirmed"
        — intermediate catch event "Ordered good not deliverable" → exclusive gateway → "Inform customer" → end "Order not deliverable"
        — intermediate catch event "Answer overdue" → (back to exclusive gateway)
      — [No: =not(creditWorthy)] exclusive gateway → end "Order declined"
    — [No: =not(complete)] (back to exclusive gateway)

**(1)**

The _intermediate timer event_ allows us to deal with the situation that nothing relevant for our process happened for a defined time period. In case we do not get an answer from wholesale, we inform the customer that the order is not deliverable at the moment.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-beyond-the-happy-path
