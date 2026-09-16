# Data flow

Every BPMN process instance can have one or more variables.

Variables are key-value-pairs and hold the contextual data of the process instance required by job workers to do their work, or to decide which sequence flows to take. They can be provided when a process instance is created, when a job is completed, and when a message is correlated.

![data-flow](assets/data-flow.png)


## Job workers

By default, a job worker gets all variables of a process instance; it can limit the data by
providing a list of required variables as **fetchVariables**.

The worker uses the variables to do its work. When the work is done, it completes the job. If the
result of the work is needed by follow-up tasks, the worker sets the variables while completing
the job. These variables [merge](https://docs.camunda.io/docs/next/components/concepts/variables#variable-propagation) into the
process instance.

![job-worker](assets/data-flow-job-worker.png)

If the job worker expects the variables in a different format or under different names, the variables can be transformed by defining **input mappings** in the process. **Output mappings** can be used to transform the job variables before merging them into the process instance.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/data-flow
