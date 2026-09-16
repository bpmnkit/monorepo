# Troubleshoot secret resolution failures — Find your symptom

| Symptom                                                                          | What happened                                                                                                | Section                                                                                           |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| An incident message starts with `Failed to resolve secret`                       | The secret store could not return the value, either permanently or after exhausting all retries.             | [Resolve secret lookup failures](#resolve-secret-lookup-failures)                                 |
| An incident message names a job key and variable path                            | The secret value was available, but Camunda could not inject it into the job variables.                      | [Resolve secret injection failures](#resolve-secret-injection-failures)                           |
| An incident message reports growth in bytes and the configured message size      | The resolved values are too large to fit in an activation batch.                                             | [Reduce oversized secret values](#reduce-oversized-secret-values)                                 |
| A job that references secrets is not activated, and no incident is raised        | The references have not resolved yet, or the store is in retry backoff.                                      | [Identify failures that raise no incident](#identify-failures-that-raise-no-incident)             |
| Jobs activate later and in smaller batches than usual, and no incident is raised | The injected values did not fit in the current batch, so the broker deferred the jobs to a later activation. | [Identify failures that raise no incident](#identify-failures-that-raise-no-incident)             |
| A job in a suspended process instance is not activated after its secret resolves | The process instance remains suspended, so secret resolution does not make the job activatable.              | [Resume a suspended job after secret resolution](#resume-a-suspended-job-after-secret-resolution) |

These incidents are job incidents. You can view them in [Operate](https://docs.camunda.io/docs/next/components/operate/userguide/resolve-incidents-update-variables) or retrieve them through the [search incidents](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-incidents.api) endpoint. Filter by `errorType` for `SECRET_RESOLUTION_ERROR` or `MESSAGE_SIZE_EXCEEDED`.

Incident messages never contain secret values. They may include the secret reference, variable path, job key, or message size, but not the resolved value.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents
