# Service tasks — Task headers

A service task can define an arbitrary number of `taskHeaders`; they are static metadata handed to workers along with the job. The headers can be used as configuration parameters for the worker.


## Variable mappings

By default, all job variables merge into the process instance. This behavior can be customized by defining an output mapping at the service task.

Input mappings can be used to transform the variables into a format accepted by the job worker.

For more information about this topic visit the documentation about [Input/output variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks
