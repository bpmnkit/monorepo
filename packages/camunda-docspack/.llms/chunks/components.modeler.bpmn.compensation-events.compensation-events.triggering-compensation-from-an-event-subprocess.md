# Compensation events — Triggering compensation from an event subprocess

An interrupting or non-interrupting event subprocess can contain compensation intermediate throw events or a
compensation end event. These compensation events can specify an activity or broadcast the compensation within the outer
scope of the event subprocess.

![Trigger compensation from an event subprocess](assets/compensation-event-subprocess.png)

A common pattern is to use this in combination with an error event subprocess to revert the effects of compensation
activities if a failure occurs that can't be recovered from.


## Additional resources

### XML representation

An intermediate compensation throw event with a referenced activity:

```xml
<intermediateThrowEvent id="CompensationThrowEvent">
    <incoming>Flow_0b2blc2</incoming>
    <outgoing>Flow_1goayj7</outgoing>
    <compensateEventDefinition id="CompensateEventDefinition_1afu1vn" activityRef="Task_A" />
</intermediateThrowEvent>
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/compensation-events/compensation-events
