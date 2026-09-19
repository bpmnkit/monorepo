# Compensation

A compensation handler is an activity used to undo tasks that have already been executed.

Activities that are associated to a compensation boundary event have a compensation marker. These activities are called
**compensation handlers** and are in charge of reverting the effects of the activity with the compensation boundary
event, the compensation activity.

![Compensation marker example](assets/compensation-marker-example.png)

When a process instance reaches a compensation throw event, it invokes the compensation handlers for all completed
activities. If an activity has been completed more than once, the compensation handler is invoked for the
same amount.

Read more about triggering the compensation in the [compensation events documentation](https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-events/compensation-events).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-handler/compensation-handler
