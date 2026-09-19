# Overview — Events in general

Events in BPMN can be **thrown** (i.e. sent) or **caught** (i.e. received), respectively referred to as **throw** or **catch** events (e.g. `message throw event`, `timer catch event`). The distinction is about which side of the event the process is on: a throw event is something the process itself actively does as part of its own execution (for example, sending a message or raising an escalation); a catch event is something the process passively waits for, coming from outside the process (for example, a message arriving, or a timer elapsing).

Additionally, a distinction is made between start, intermediate, and end events:

- **Start events** (always catch events) react to something external to begin the process or subprocess — a process can't start itself.
- **End events** (always throw events) are the process's own final action, such as sending a message or signaling that an error occurred, and denote the end of a particular sequence flow.
- **Intermediate events** can go either way: an intermediate throw event performs an action as part of the process's execution, while an intermediate catch event pauses the process and waits to react to something external.

Intermediate catch events can be inserted into your process in two different contexts: normal flow, or attached to an activity, and are called boundary events.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/events
