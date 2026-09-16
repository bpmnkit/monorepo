# Compensation — Embedded subprocess as compensation handler

![Process with subprocess as compensation handler](assets/subprocess-compensation-handler.png)

The subprocess contains the steps to undo the actions of the compensation activity. Using a subprocess can be useful if
a sequence of steps is required to undo the actions of the activity.


## Call activity as compensation handler

![Process with call activity as compensation handler](assets/call-activity-compensation-handler.png)

The call activity contains the steps to undo the actions of the compensation activity. Using a call activity as the
compensation handler can be useful since the compensation handlers of a child process are not invoked.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-handler/compensation-handler
