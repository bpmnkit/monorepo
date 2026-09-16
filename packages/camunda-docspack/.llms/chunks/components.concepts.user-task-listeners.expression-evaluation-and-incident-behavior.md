# User task listeners — Expression evaluation and incident behavior

### Expression evaluation

User task listener properties, such as job `type` or `retries`, are evaluated right before the job creation for the listener.

### Incident recovery

If a user task listener job fails or its expression evaluation raises an [incident](https://docs.camunda.io/docs/next/components/concepts/incidents), the lifecycle transition is paused until the incident is resolved.

There are two types of incidents for task listeners:

- **Expression evaluation failure**: Raised when a listener property expression fails to evaluate. After the incident is resolved, the entire lifecycle transition is retried, re-executing all listeners configured for the transition, including those that previously completed successfully.
- **Job failure**: If a listener job fails, it is retried according to the `retries` property. If all retries are exhausted and the job still fails, an incident is raised. Once resolved, only the failed listener job is retried, allowing the lifecycle transition to resume without re-executing successfully completed listeners.

---
Source: https://docs.camunda.io/docs/next/components/concepts/user-task-listeners
