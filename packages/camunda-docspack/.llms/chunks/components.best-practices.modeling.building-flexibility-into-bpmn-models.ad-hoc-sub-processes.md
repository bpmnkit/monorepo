# Building flexibility into BPMN models — Ad-hoc sub-processes

The techniques above keep the sequence of activities fixed and use events to deviate from it. An [ad-hoc sub-process](https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses) instead leaves the sequence open: its activities carry no sequence flow between them, and which of them run, in which order, and how often is decided at runtime instead of at design time.
The decision can be made either by the engine, based on an expression in the model, or by a job worker. For example, if the subprocess hosts an AI agent, the AI Agent connector can make the decision.

The symbols above still apply around and within an ad-hoc subprocess. You can use boundary events and [event subprocesses](https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses#event-sub-processes) to interrupt or redirect it while it is running. Therefore, leaving the sequence open-ended does not mean giving up control over it.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/building-flexibility-into-bpmn-models
