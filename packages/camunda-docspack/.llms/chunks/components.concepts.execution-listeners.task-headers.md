# Execution listeners — Task headers

An execution listener can define an arbitrary number of `taskHeaders`; they are static metadata handed to workers along with the job. The headers can be used as configuration parameters for the worker.

The job worker receives the listener headers, as well as the custom headers defined for the BPMN element on which the listener is configured. If the BPMN element and the listener both define the same header key, the listener value is used.


## Implement an execution listener

Execution listeners are processed by [job workers](https://docs.camunda.io/docs/next/components/concepts/job-workers).

- Listeners are based on the same concept of jobs and use the same protocol.
- You can implement a handler for an execution listener just as you would for a regular job.

See the [job worker documentation](https://docs.camunda.io/docs/next/apis-tools/java-client/job-worker) for examples of how to create a job worker and handler that can also process execution listener jobs.

**Note**
[Throwing a BPMN error](https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions#throwing-and-handling-bpmn-errors) for an execution listener's job is not supported.

---
Source: https://docs.camunda.io/docs/next/components/concepts/execution-listeners
