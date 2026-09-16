# Job workers — Job leasing — Enforcement and rejections

Complete, fail, and throw-error commands on a leased job require the matching lease token. If the token is missing or doesn't match, Zeebe rejects the command with `INVALID_STATE`.

Updating a job's timeout, retries, or priority never requires a lease token, but Zeebe validates one if you supply it. This keeps operator and bulk updates of leased jobs possible without requiring a lease.

A lease-mismatch rejection means another activation of the same job has already superseded yours, for example after the job timed out and was reassigned. Treat this as expected, not as an error: don't retry the command, and log it at debug level rather than as an error.

---
Source: https://docs.camunda.io/docs/next/components/concepts/job-workers
