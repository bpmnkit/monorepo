# Workflow patterns — Routing — Invoke subworkflows

You need to invoke another process as part of your process.

This is implemented by a [call activity](https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities):

Diagram (BPMN):
  start → call activity "Subprocess A" → end

**(1)**

When the call activity is entered, a new process instance of the referenced process is created. Only when the created process instance is completed is the call activity left and the outgoing sequence flow taken.

You can reference any other BPMN process, for example:

Diagram (BPMN):
  start → "Task B" → "Task C" → end

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns
