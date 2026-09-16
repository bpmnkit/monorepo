# Dealing with problems and exceptions — Handling errors on the process level — Thinking about unhandled BPMN exceptions

It is crucial to understand that if a BPMN error is not handled anywhere in the process, Camunda 8 raises an [incident](https://docs.camunda.io/docs/next/components/concepts/incidents) (for example, `Unhandled error event`) instead of silently terminating the process instance. Therefore, you can and normally should always handle the BPMN error. You can, of course, also handle it in a parent process scope like in the example below:

Diagram (BPMN):
  start "Order received" → "Get good from stock" → exclusive gateway "Good in stock?"
    — [No: =not(inStock)] call activity "Purchase" → exclusive gateway → "Deliver good" → end "Order delivered"
    — [Yes: =inStock] (back to exclusive gateway)

**(1)**

The boundary error event deals with the case that the item is unavailable.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions
