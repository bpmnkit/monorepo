# Execution listeners

An execution listener allows users to react to various events in the workflow execution lifecycle by executing custom logic.

An execution listener (EL) allows users to react to various events in the workflow execution lifecycle by executing custom logic.


## About execution listeners

You can use execution listeners to provide flexibility and control over process execution, and handle complex data and external system interactions without cluttering the BPMN model with technical details.

### Use cases

Execution listeners are useful in the following typical cases:

- Pre- and post-processing actions for activities
- External calculations of variables for element expressions
- Decoupled processes and data synchronization

### Blocking behavior

An execution listener is a blocking operation, meaning that the workflow execution lifecycle only continues once the listener is completed. This ensures that all necessary pre- and post-processing actions defined by the listener are fully executed before the workflow proceeds to the next element.

---
Source: https://docs.camunda.io/docs/next/components/concepts/execution-listeners
