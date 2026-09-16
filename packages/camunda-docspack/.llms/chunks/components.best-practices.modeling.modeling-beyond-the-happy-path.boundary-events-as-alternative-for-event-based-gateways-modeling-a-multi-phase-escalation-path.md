# Modeling beyond the happy path — Boundary events as alternative for event based gateways — Modeling a multi phase escalation path

Boundary events are particularly useful when you consider that you might want to remind your dealer that the answer is overdue and give them another chance for transmitting the delivery date before you give up waiting. First, consider how this could be achieved by using event-based gateways:

Diagram (BPMN):
  start "Order received" → "Check order completeness" → exclusive gateway "Order complete?"
    — [Yes: =complete] "Check customer's credit-worthiness" → exclusive gateway "Customer credit-worthy?"
      — [Yes: =creditWorthy] "Request delivery date" → event-based gateway
        — intermediate catch event "Delivery date fixed" → "Mail order confirmation" → end "Order confirmed"
        — intermediate catch event "Ordered good not deliverable" → exclusive gateway → "Inform customer" → end "Order not deliverable"
        — intermediate catch event "Answer overdue" → exclusive gateway "Dealer already reminded?"
          — [Yes: =reminded] (back to exclusive gateway)
          — [No: =not(reminded)] "Remind dealer" → (back to event-based gateway)
      — [No: =not(creditWorthy)] exclusive gateway → end "Order declined"
    — [No: =not(complete)] (back to exclusive gateway)

**(1)**

After having realized that the dealer's answer is late, we decide whether we want to remind the dealer and continue to wait - or not. We modeled here that we want to remind the dealer just once.

**(2)**

However, note that while we are reminding the dealer, we are strictly speaking not in a state "ready-to-receive" the dealer's answer! According to BPMN execution semantics, the dealer's message might get lost until we are back at the event-based gateway. While you might want to choose to ignore that when modeling for communication purposes only, you will need to get it right for executable models.

To get the BPMN execution semantics above fully right, we would now need to attach the two possible answers of the dealer ("Delivery data fixed", "Ordered good not available") as boundary events to the task "Remind dealer", too! Quite a modeling construct, just to properly wait for the dealer's response, right? Therefore, consider the following alternative to this modeling issue using boundary events only:

Diagram (BPMN):
  start "Order received" → "Check order completeness" → exclusive gateway "Order complete?"
    — [Yes: =complete] "Check customer's credit-worthiness" → exclusive gateway "Customer credit-worthy?"
      — [Yes: =creditWorthy] "Request delivery date" → "Receive delivery date" → "Mail order confirmation" → end "Order confirmed"
      — [No: =not(creditWorthy)] exclusive gateway → end "Order declined"
    — [No: =not(complete)] (back to exclusive gateway)

**(1)**

Modeling a _non-interrupting boundary timer event_ directly at a task which waits for the response has the advantage that we never leave the "ready-to-receive" state and therefore avoid troubles with the strict interpretation of BPMN execution semantics.

The second alternative is _very compact_ and avoids issues with _not being ready-to-receive_, but typically needs a _deeper understanding_ of BPMN symbols and their consequences for the token flow. Therefore, we sometimes also prefer event-based gateways for showing human flows, and ignore sophisticated token flow issues as discussed here.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-beyond-the-happy-path
