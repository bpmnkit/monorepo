# Terminate events

Terminate end events are the only kind of terminate events. When a process instance reaches a terminate end event, it
terminates all element instances in the same flow scope as the end event.

They are often used to terminate a concurrent flow that is not required anymore. Consider the following example.

![The process instance reached the terminate end event and canceled the concurrent flow.](assets/terminate-event-on-process-scope.png)

The process has two concurrent tasks `B` and `C`. In the process instance, both tasks are active. We complete the
task `C`. The process instance reaches the terminate end event and cancels the task `B`.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/terminate-events/terminate-events
