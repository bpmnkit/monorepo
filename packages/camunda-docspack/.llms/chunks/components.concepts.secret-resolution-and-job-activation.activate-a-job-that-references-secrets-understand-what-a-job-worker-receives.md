# Secret resolution and job activation — Activate a job that references secrets — Understand what a job worker receives

A job worker does not need to handle secret resolution. While a job waits for a reference to resolve, the broker does not include it in an activation response or push it to a worker.

A worker receives the job with the placeholders replaced by the resolved values. If your worker logs its input variables, the resolved secret values appear in plaintext.

**Warning**
The guarantees below describe what Camunda stores, not what a worker does with the value it received. A worker can still write the resolved value back into process variables, for example through a completed job's variables, an output mapping, a connector result, or an error message. Doing so writes it to process variables and exposes it in runtime state and every exported record as plaintext, the same as any other variable value. Write resolved secret values into a worker's own request to the credential's consumer, not back into process variables.

You don't need to make client-side changes. Existing workers, clients, and job worker libraries continue to work with a cluster that resolves secrets.

One exception: a worker's `CompleteJob`, `FailJob`, or `ThrowError` command is rejected with `INVALID_STATE` if the job is parked for secret resolution when the command arrives; the rejection names the state. This can surface as a race: if a worker's activation times out and it completes, fails, or throws an error late, and by then the job's cached secret value has expired and the broker parked it again, that late command is rejected instead of accepted. The work of that activation is lost, and the job is resolved and handed out again once its references are cached, the same outcome as any other lost race between a timed-out worker and a new activation.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation
