# Compensation events — Triggering compensation for a specific activity

By default, a compensation throw event invokes all compensation handlers in its scope. However, it is also possible to
trigger the compensation for a specific activity. This can be used to enforce that compensation handlers are invoked
synchronously in a given order.

![Trigger compensation for a give activity](assets/compensation-activity-ref.png)

On a compensation intermediate throw or end event, it is possible to specify the activity to compensate by using the
property `activityRef`. The referenced activity must have a compensation boundary event and must be in the same scope of
the compensation throw event.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-events/compensation-events
