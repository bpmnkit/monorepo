# Job workers — Job leasing — How job leasing works

To use leasing, request a lease by setting `withLease` to `true` when you activate jobs. Zeebe then returns a `leaseToken` on each activated job. This token identifies that specific activation, not the job itself.

Pass the matching lease token back when you complete, fail, or throw an error on the job. You can also include it when you update the job timeout, retries, or priority, to verify the activation is still current before the update applies.

---
Source: https://docs.camunda.io/docs/next/components/concepts/job-workers
