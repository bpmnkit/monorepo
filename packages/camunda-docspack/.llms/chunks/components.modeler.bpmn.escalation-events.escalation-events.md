# Escalation events

Escalation events are used to escalate part of process execution to a higher flow scope.

Escalation events are events which reference a named escalation, and are used to communicate to a higher flow scope.
Unlike an error, an escalation event is non-critical and execution continues at the location of throwing.

![The process reached an escalation event. The escalation gets caught in a higher flow scope. As the escalation throw event is non-critical, the outgoing sequence flow of this event is taken.](assets/escalation-events.png)

The example above shows the execution of an escalation event:

1. The process reaches the `Throw` event.
2. This throws an escalation to a higher flow scope.
3. The escalation is caught by the `Catch` event.
4. As escalation events are non-critical, the outgoing sequence flows of `Throw` and `Catch` are both taken.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/escalation-events/escalation-events
