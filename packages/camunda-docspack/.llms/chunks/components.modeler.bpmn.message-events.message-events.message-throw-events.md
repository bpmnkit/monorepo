# Message events — Message throw events

A process can contain intermediate message throw events or message end events to model the
publication of a message to an external system; for example, to a Kafka topic.

Currently, intermediate message throw events and message end events behave exactly
like [service tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks) or [send tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/send-tasks/send-tasks)
, and have the same job-related properties (e.g. job type, custom headers, etc.) The message throw
events and the tasks are based on jobs
and [job workers](https://docs.camunda.io/docs/next/components/concepts/job-workers). The differences between the message
throw events and the tasks are the visual representation and the semantics for the model. Read more
about the [job properties](https://docs.camunda.io/docs/next/components/concepts/job-workers).

When a process instance enters a message throw event, it creates a corresponding job and waits for
its completion. A job worker should request jobs of this job type and process them. When the job is
complete, the process instance continues or completes if it is a message end event.

**Note**
Message throw events are not processed by Zeebe itself (i.e. to correlate a message to a message
catch event). Instead, it creates jobs with the defined job type. To process them, provide a job
worker.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events
