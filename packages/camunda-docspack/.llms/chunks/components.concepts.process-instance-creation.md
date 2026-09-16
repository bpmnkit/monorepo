# Process instance creation

Depending on the process definition, an instance of it can be created in several ways.

Depending on the process definition, an instance of it can be created in several ways.

Camunda 8 supports the following ways to create a process instance:

- [`CreateProcessInstance` commands](#commands)
- [Message event](#message-event)
- [Timer event](#timer-event)


## Commands

A process instance is created by sending a command specifying the BPMN process ID, or the unique key of the process.

There are two commands to create a process instance, outlined in the sections below.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-creation
