# Event subprocess

An event subprocess is a subprocess triggered by an event.

An event subprocess is a subprocess triggered by an event. This can be added globally to the process, or locally inside an embedded subprocess.

![event-subprocess](assets/event-subprocess.png)

An event subprocess must have exactly **one** start event of one of the following types:

- [Timer](https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events)
- [Message](https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events)
- [Error](https://docs.camunda.io/docs/next/components/modeler/bpmn/error-events/error-events)
- [Signal](https://docs.camunda.io/docs/next/components/modeler/bpmn/signal-events/signal-events)
- [Escalation](https://docs.camunda.io/docs/next/components/modeler/bpmn/escalation-events/escalation-events)

An event subprocess behaves like a boundary event, but is inside the scope instead of attached to the scope. Like a boundary event, the event subprocess can be interrupting or non-interrupting (indicated in BPMN by a solid or dashed border of the start event). The start event of the event subprocess can be triggered when its containing scope is activated.

A non-interrupting event subprocess can be triggered multiple times. An interrupting event subprocess can be triggered only once.

When an interrupting event subprocess is triggered, all active instances of its containing scope are terminated, including instances of other non-interrupting event subprocesses.

If an event subprocess is triggered, its containing scope is not completed until the triggered instance is completed.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/event-subprocesses/event-subprocesses
