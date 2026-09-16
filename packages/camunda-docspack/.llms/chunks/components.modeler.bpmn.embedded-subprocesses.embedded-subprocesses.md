# Embedded subprocess

An embedded subprocess allows you to group elements of the process.

An embedded subprocess allows you to group elements of the process.

![embedded-subprocess](assets/embedded-subprocess.png)

An embedded subprocess must have exactly **one** none start event. Other start events are not allowed.

When an embedded subprocess is entered, the start event is activated. The subprocess stays active as long as one containing element is active. When the last element is completed, the subprocess is completed and the outgoing sequence flow is taken.

Embedded subprocesses are often used together with **boundary events**. One or more boundary events can be attached to a subprocess. When an interrupting boundary event is triggered, the entire subprocess (including all active elements) is terminated.

When adding an embedded subprocess to your model, you can either add a collapsed or expanded subprocess. You cannot collapse an existing expanded subprocess in your model.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/embedded-subprocesses/embedded-subprocesses
