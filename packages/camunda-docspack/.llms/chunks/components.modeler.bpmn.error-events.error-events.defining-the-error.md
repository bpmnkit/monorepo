# Error events — Defining the error

In BPMN, **errors** define possible errors that can occur. **Error events** are elements in the process referring to
defined errors. An error can be referenced by one or more error events.

An error must define an `errorCode`. The value of this `errorCode` is used to determine which catch event can catch the thrown error.

For error throw events, it is possible to define the `errorCode` as [an `expression` or a static value](https://docs.camunda.io/docs/next/components/concepts/expressions#expressions-vs-static-values). If an `errorCode` expression is configured then it will be evaluated once the event is reached, and used to throw error.

For error catch events `errorCode` must be [a static value](https://docs.camunda.io/docs/next/components/concepts/expressions#expressions-vs-static-values).
Alternatively an error catch event may omit the error reference all together. In this case it catches **all** thrown errors.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/error-events/error-events
