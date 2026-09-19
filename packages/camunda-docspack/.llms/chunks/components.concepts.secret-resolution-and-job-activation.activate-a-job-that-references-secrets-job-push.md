# Secret resolution and job activation — Activate a job that references secrets — Job push

On the push path, the broker performs the same check before pushing a job to a matching job stream. If a reference is not yet cached, the broker requests resolution and parks the job as it does on the polling path.

When the reference resolves, the broker pushes the parked job to a matching stream. Because a worker using job push never polls, the broker must push the reactivated job.

The resolved values are injected into the pushed job only. On this path the activation event carries no variables at all, so neither a value nor a placeholder reaches the log.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation
