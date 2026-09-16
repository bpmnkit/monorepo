# Troubleshoot secret resolution failures — Identify failures that raise no incident

Some secret resolution outcomes do not raise incidents and do not require operator action. Their symptoms can still resemble incident conditions.

### Job does not fit in the current batch

If injecting a job's resolved values would exceed the remaining message size in the current activation batch, Camunda removes that job and every subsequent job from the batch and marks the batch as truncated.

The removed jobs remain activatable and can be included in a later activation. The visible effect is smaller batches and slightly delayed activation rather than a stuck job.

### Reference no longer has a placeholder

Camunda activates the job without changing the value when there is no placeholder left to replace.

This can happen in either of the following cases:

- The recorded pointer no longer addresses a value, for example because the worker's `fetchVariables` list excludes that variable.
- The value at the pointer no longer contains `camunda.secrets.<name>`, for example because a variable update replaced the placeholder with a literal value.

In the second case, the worker receives the current literal value instead of the secret. Camunda raises an [injection incident](#resolve-secret-injection-failures) only when a secret placeholder is still present but cannot be replaced.

### Job push does not check injected value size

Long polling checks the growth caused by injected secret values against the remaining message size in the activation batch. If the job does not fit, Camunda removes it from the batch.

Job push does not perform the same size check on the pushed job because the activation event contains no variables. As a result, the push path does not raise a `MESSAGE_SIZE_EXCEEDED` incident for oversized injected values.

Job push does not bypass the transport message-size limit. If the pushed job exceeds the configured transport limit between the broker, gateway, and worker, delivery can fail without raising a `MESSAGE_SIZE_EXCEEDED` incident.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents
