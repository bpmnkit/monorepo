# Dealing with problems and exceptions — Handling errors on the process level — Distinguishing between exceptions and results

As an alternative to throwing a Java exception, you can also write a problematic result into a process variable and model an XOR-Gateway later in the process flow to take a different path if that problem occurs.

From a business perspective, the underlying problem then looks less like an error and more like a result of an activity, so as a rule of thumb we deal with _expected results_ of activities by means of gateways, but model exceptional errors, which _hinder us in reaching the expected result_ as boundary error events.

Diagram (BPMN):
  start "Order received" → "Check order completeness" → exclusive gateway "Order complete?"
    — [Yes: =complete] "Check customer's credit-worthiness" → exclusive gateway "Customer credit-worthy?"
      — [Yes: =creditWorthy] "Determine delivery date" → exclusive gateway → "Fax order confirmation" → end "Order confirmed"
      — [No: =not(creditWorthy)] exclusive gateway → end "Order declined"
    — [No: =not(complete)] (back to exclusive gateway)

**(1)**

The task is to "check the customer's credit-worthiness", so we can reason that we _expect as a result_ to know whether the customer is credit-worthy or not.

**(2)**

We can therefore model an _exclusive gateway_ working on that result and decide via the subsequent process flow what to do with a customer who is not credit-worthy. Here, we just consider the order to be declined.

**(3)**

However, it could be that we _cannot reach a result_, because while we are trying to obtain knowledge about the customer's creditworthiness, we discover that the ID we have is not associated with any known real person. We can't obtain the expected result and therefore model a _boundary error event_. In the example, the consequence is just the same and we consider the order to be declined.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions
