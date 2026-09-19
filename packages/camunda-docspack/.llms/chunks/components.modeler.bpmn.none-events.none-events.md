# None events

None events are unspecified events, also called blank events.

None events are unspecified events, also called "blank" events.

![process](assets/none-events.png)


## None start events

At most, a process can have **one** none start event (besides other types of start events).

A none start event is where the process instance or a subprocess starts when the process or the subprocess is activated.

A none start event is required if you want to [trigger a process via a form](https://docs.camunda.io/docs/next/components/hub/workspace/modeler/run-or-publish-your-process#publish-via-a-public-form).


## None end events

A process or subprocess can have multiple none end events. When a none end event is entered, the current execution path ends. If the process instance or subprocess has no more active execution paths, it is completed.

If an activity has no outgoing sequence flow, it behaves the same as it would be connected to a none end event. When the activity is completed, the current execution path ends.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/none-events/none-events
