# Incidents

A process instance is stuck at a particular point, and requires user interaction to resolve the problem.

In Camunda 8, an [incident](https://docs.camunda.io/docs/next/reference/glossary#incident) represents a problem in process execution. This means a [process instance](https://docs.camunda.io/docs/next/reference/glossary#process-instance) is stuck at a particular point and requires user interaction to resolve the problem.

Incidents are created in different situations, including the following:

- A job is failed and it has no retries left.
- A condition doesn't return `true` or `false`.
- A timer expression doesn't return the expected type.
- A decision can't be evaluated.
- A BPMN error is thrown and not caught by an error boundary event or error event subprocess.
- A job's secret references cannot be resolved, or their resolved values cannot be injected into the job.

**Note**
Not all errors necessarily lead to incidents. For example, unexpected errors in Zeebe do not always result in incidents.

---
Source: https://docs.camunda.io/docs/next/components/concepts/incidents
