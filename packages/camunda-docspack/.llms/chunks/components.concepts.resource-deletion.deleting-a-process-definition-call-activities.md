# Resource deletion — Deleting a process definition — Call activities

A [call activity](https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities) references a process by ID. If all process definitions for that process ID are deleted, Zeebe creates an [incident](https://docs.camunda.io/docs/next/components/concepts/incidents) on the call activity indicating that the referenced process cannot be found.

---
Source: https://docs.camunda.io/docs/next/components/concepts/resource-deletion
