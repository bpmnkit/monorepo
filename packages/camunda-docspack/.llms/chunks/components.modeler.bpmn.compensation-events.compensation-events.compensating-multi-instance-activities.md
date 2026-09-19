# Compensation events — Compensating multi-instance activities

The compensation handler of a multi-instance activity is invoked only once, rather than for each item in the input
collection. The compensation handler is responsible for reverting the effects of all instances of the multi-instance
activity.

![Process with multi instance activity](assets/compensation-multi-instance-activity.png)

To revert the effects of each instance separately, the compensation handler could be marked as multi-instance as well.
Read more about this in [multi-instance activities as compensation handlers](https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-handler/compensation-handler#multi-instance-activity-as-compensation-handler).

**Note**
The process instance invokes the compensation handler only if all instances of the multi-instance activity are
completed.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-events/compensation-events
