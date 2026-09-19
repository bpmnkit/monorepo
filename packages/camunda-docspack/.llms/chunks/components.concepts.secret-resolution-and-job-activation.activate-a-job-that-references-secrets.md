# Secret resolution and job activation — Activate a job that references secrets

At activation time, the broker looks up each job reference in the secret store's local cache. The broker does not read the store during activation, so store latency cannot block activation.

The broker hands a job to a worker only when every reference has a cached value. If a reference is not yet cached, the broker requests resolution instead of handing out the job. The broker does not fail the waiting job or raise an incident. Once the reference resolves, the job becomes available automatically.

While it waits, the job is parked internally and is not activatable, so no worker receives it on either delivery path. This parked state isn't exposed through the API, Operate, or exported records. Observe it instead through its effects: the job is missing from an activation response, no `ACTIVATED` event exists for its batch, a `RESOLUTION_REQUESTED` record exists for the pending reference, and the `zeebe_job_events_total` metric counts it under `action="skipped uncached secret"`.

The following sections describe this behavior for each delivery path. The broker injects the same resolved values on both paths.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation
