# Call activities

A call activity (or reusable subprocess) allows you to call and invoke another process as part of this process.

A call activity (or reusable subprocess) allows you to call and invoke another process as part of this process. It's similar to an [embedded subprocess](https://docs.camunda.io/docs/next/components/modeler/bpmn/embedded-subprocesses/embedded-subprocesses), but the process is externalized (i.e. stored as separated BPMN) and can be invoked by different processes.

![call-activity](assets/call-activities-example.png)

When a call activity is entered, a new process instance of the referenced process is created. The new process instance is activated at the **none start event**. The process can have start events of other types, but they are ignored.

When the created process instance is completed, the call activity is left and the outgoing sequence flow is taken.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities
