# Modeling beyond the happy path — Forking off at a particular point — Dealing with results

By using data-based gateways, we _actively decide_ "now and here" on the basis of our own _process data_ which path our process must move along. For example, we can therefore use an XOR gateway to fork off a "problem path," dealing with a problematic result of _our own activities_:

Diagram (BPMN):
  start "Order received" → "Check order completeness" → exclusive gateway "Order complete?"
    — [Yes: =complete] "Check customer's credit-worthiness" → exclusive gateway "Customer credit-worthy?"
      — [Yes: =creditWorthy] "Request delivery date" → intermediate catch event "Delivery date fixed" → "Mail order confirmation" → end "Order confirmed"
      — [No: =not(creditWorthy)] exclusive gateway → end "Order declined"
    — [No: =not(complete)] (back to exclusive gateway)

**(1)**

The _exclusive gateway_ deals with the potentially problematic result of incomplete order data. Note that we deal here with the procedural consequences of work which already took place in the preceding task, where we actually checked the order for completeness.

**(2)**

Again, the preceding task already dealt with the actual work of checking the customer's creditworthiness. The _result_ of the task is a "yes" or "no" (true or false). We can deal with data by means of a data-based gateway, which immediately redirects to the path our process must move along.

**(3)**

The _end event_ characterizes the undesired end result "order declined," which we now reach because of having modeled two problems. In the example, both of them lead to one and the same business outcome.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-beyond-the-happy-path
