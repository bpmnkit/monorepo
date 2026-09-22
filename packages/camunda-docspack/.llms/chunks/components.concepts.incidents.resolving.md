# Incidents — Resolving

To resolve an incident, complete the following steps:

1. Identify and resolve the problem.
2. Mark the incident as resolved, triggering retry process execution.
3. If the problem still exists, a new incident is created.

For a job incident, marking the incident as resolved does not immediately re-check the underlying problem. Camunda checks it again only when a worker next activates the job. If no worker is connected for the job type, the job is not activated. As a result, Camunda does not raise a new incident even if the problem still exists, and the process instance can appear healthy in Operate. Keep a worker connected for the affected job type so Camunda can raise the incident again promptly if the cause is not fixed.

### Resolving a job-related incident

If a job fails and has no retries remaining, an incident is created. There are many different reasons why the job may have failed. For example, the variables may not be in the expected format, or a service is not available (e.g. a database).

If the variables are causing the incident, complete the following steps:

1. Update the variables of the process instance.
2. Increase the remaining retries of the job.
3. Mark the incident as resolved.

**Note**
It's recommended you complete these operations in [Operate](https://docs.camunda.io/docs/next/components/operate/operate-introduction).

It is also possible to complete these steps via the [client API](https://docs.camunda.io/docs/next/apis-tools/working-with-apis-tools). Using the Java client, this could look like the following:

```java
client.newSetVariablesCommand(incident.getElementInstanceKey())
    .variables(NEW_PAYLOAD)
    .send()
    .join();

client.newUpdateRetriesCommand(incident.getJobKey())
    .retries(3)
    .send()
    .join();

client.newResolveIncidentCommand(incident.getKey())
    .send()
    .join();
```

When the incident is resolved, the job can be activated by a worker again.

### Resolving secret resolution incidents

A job that references secrets can raise one of the following incidents:

- `SECRET_RESOLUTION_ERROR` when the secret store cannot return a value or Camunda cannot inject the resolved value into the job.
- `MESSAGE_SIZE_EXCEEDED` when the resolved values make the job too large to activate.

For diagnosis steps and details about how each incident affects the job, see [Troubleshoot secret resolution failures](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents).

### Resolving a process instance-related incident

If an incident is created during process execution and it's not related to a job, the incident is usually related to the variables of the process instance. For example, a condition expression doesn't return a boolean value.

To resolve the incident, update the variables and mark the incident as resolved.

**Note**
It's recommended you complete these operations in [Operate](https://docs.camunda.io/docs/next/components/operate/operate-introduction).

Using the Java client, this could look like the following:

```java
client.newSetVariablesCommand(incident.getElementInstanceKey())
    .variables(NEW_VARIABLES)
    .send()
    .join();

client.newResolveIncidentCommand(incident.getKey())
    .send()
    .join();
```

When the incident is resolved, the process instance continues.

---
Source: https://docs.camunda.io/docs/next/components/concepts/incidents
