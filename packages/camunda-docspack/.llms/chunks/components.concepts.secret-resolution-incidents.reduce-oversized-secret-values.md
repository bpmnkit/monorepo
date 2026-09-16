# Troubleshoot secret resolution failures — Reduce oversized secret values

A `MESSAGE_SIZE_EXCEEDED` incident is raised when the resolved secret values make the job too large to fit within the configured activation message size.

```text
The job with key '2251799813685260' can not be activated, because injecting its secret values would grow the activation batch by 5.2MiB, more than any batch can grow without exceeding the configured message size (per default is 4 MB). Try to reduce the size of the secret values or of the job variables.
```

The applicable limit is `camunda.cluster.network.max-message-size`, which defaults to `4MB`. Secret values do not have a separate size limit.

Camunda raises this incident only when the oversized job is first in the activation batch and still cannot fit within the available message size. If a job does not fit only because of other jobs already included in the batch, Camunda removes it from that batch without raising an incident and activates it later. See [Identify failures that raise no incident](#identify-failures-that-raise-no-incident).

### Retry after reducing the size

Resolve the incident only after reducing the size of the secret value or the job variables. Otherwise, the next activation attempt fails in the same way.

To reduce the job variables included in activation, adjust the worker's `fetchVariables` list. Variables the worker does not fetch are excluded from the activation and do not count toward the message-size limit.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents
