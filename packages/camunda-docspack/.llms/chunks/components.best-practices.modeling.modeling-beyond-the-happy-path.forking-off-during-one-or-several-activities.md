# Modeling beyond the happy path — Forking off during (one or several) activities

With BPMN boundary events, we can deal with problems arising _while we are actively occupied_ to carry out work in our process.

### Dealing with errors

A typical case is that it turns out to be _impossible to achieve the result_ of an activity while working on it. We can then choose to interrupt our work and fork off a "problem path" to deal with the issue:

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

The _interrupting boundary error event_ allows us to deal with the fact that the order is not readable. As this prevents us from properly judging the completeness of the order, we cannot reach one of the expected results of our activity ("complete" or "not complete"), but instead deal with the problem by interrupting the activity and assuming the order to be declined.

When modeling for business process automation, "dealing with errors" might be a highly technical concern. As a rule of thumb, we just want to show the _"business related" problems_ in a process model: those problems and errors which cause that our business process must move along a different path, because different work must be carried out as a reaction.

An example for a typical technical concern would be that we currently cannot reach a system, which is why, for example, we want to re-attempt it another time later on. We do not show such purely technical problems in a business process diagram, not even in an executable one: (1) It would clutter the diagram, and (2) There are more suitable ways to deal with technical issues potentially occuring almost anywhere. Read our Best Practice about [dealing-with-problems-and-exceptions](https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions) from a more technical point of view to learn more about the border between business related shown in a process diagram and purely technical concerns not shown in a process diagram.

### Dealing with work on top of usual work

Another typical use case for reacting to situations while we are actively occupied is that it sometimes turns out we need to do stuff _in addition to what we already do_:

Diagram (BPMN):
  start "Order received" → subprocess → event-based gateway
    — intermediate catch event "Delivery date fixed" → "Mail order confirmation" → end "Order confirmed"
    — intermediate catch event "Ordered good not deliverable" → exclusive gateway → "Inform customer" → end "Order not deliverable"
    — intermediate catch event "Answer overdue" → (back to exclusive gateway)

**(1)**

We encapsulate part of our process into a subprocess to enable us to express that while we are occupied with that part of the process, additional work might pop up.

**(2)**

The _non-interrupting boundary timer event_ allows us to speed up order preparation in case it takes longer than two days; for example, by informing a responsible manager.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-beyond-the-happy-path
