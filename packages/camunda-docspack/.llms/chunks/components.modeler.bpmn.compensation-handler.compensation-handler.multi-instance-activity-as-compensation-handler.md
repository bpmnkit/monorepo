# Compensation — Multi-instance activity as compensation handler

![Process with multi instance activity as compensation handler](assets/multi-instance-compensation-handler.png)

The compensation handler for a [multi-instance activity](https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance) is invoked only once,
rather than for each item in the input collection. To invoke the compensation handler more than once, the handler can be
marked as multi-instance too.

If the compensation handler should revert the effects of each item in the input collection, it could use the same input
collection as the multi-instance activity.


## Interrupting compensation handlers

Compensation handlers can be interrupted. If the process instance is canceled, it terminates all compensation
handlers.

Within a process, the process instance terminates a compensation handler if the compensation throw event that invoked
the compensation handler is interrupted. This can happen in the following cases:

- If a terminate end event is entered.
- If an interrupting event subprocess is triggered.
- If the compensation throw event is inside an embedded subprocess and the subprocess is interrupted.

![A compensation handler is interrupted by an event subprocess](assets/interrupt-compensation-handler.png)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-handler/compensation-handler
