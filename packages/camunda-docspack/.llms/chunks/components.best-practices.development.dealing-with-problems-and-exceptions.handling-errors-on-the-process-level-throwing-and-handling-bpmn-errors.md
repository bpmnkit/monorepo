# Dealing with problems and exceptions — Handling errors on the process level — Throwing and handling BPMN errors

In BPMN process definitions, we can explicitly model an end event as an error.

Diagram (BPMN):
  start "Good to be purchased" → "Order good" → exclusive gateway "Good available?"
    — [Yes: =available] intermediate catch event "Good received" → end "Good purchased"
    — [No: =not(available)] end "Good unavailable"

**(1)**

In case the item is not available, we finish the process with an **error end event**.

**Note**
You can mimic a BPMN error in your glue code by using the [`ThrowError`](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#throwerror-rpc) API. The consequences for the process are the same as if it were an explicit error end event. So, in case your 'purchase' activity is not a subprocess, but a service task, it could throw a BPMN Error informing the process that the good is unavailable.

Example in Java:

```java
jobClient.newThrowErrorCommand(job)
   .errorCode("GOOD_UNAVAILABLE")
   .errorMessage()
   .send()
   .exceptionally(t -> {throw new RuntimeException("Could not throw BPMN error: " + t.getMessage(), t);});
```

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions
