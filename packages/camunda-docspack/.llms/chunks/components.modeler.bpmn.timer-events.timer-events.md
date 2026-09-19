# Timer events

Learn about events triggered by a timer, including timer start events, intermediate timer catch events, and interrupting/non-interrupting timer boundary events.

Timer events are events triggered by a defined timer.

![process](assets/timer-events.png)


## Timer start events

A process can have one or more timer start events (besides other types of start events). Each of the timer events must have either a time date or time cycle definition.

When a process is deployed, it schedules a timer for each timer start event. Scheduled timers of the previous version of the process (based on the BPMN process ID) are canceled.

When a timer is triggered, a new process instance is created and the corresponding timer start event is activated.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events
