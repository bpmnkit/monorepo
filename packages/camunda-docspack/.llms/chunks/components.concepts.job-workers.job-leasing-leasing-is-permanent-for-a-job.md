# Job workers — Job leasing — Leasing is permanent for a job

Once a job has been leased by any worker, Zeebe never again serves that job to a non-leasing worker of the same type. A non-leasing poll or stream silently skips the job.

The affected process instances may appear stuck with no incident indicating the problem if all leasing workers are stopped. Zeebe exposes a `skipped` action on the `zeebe.job.events.total` metric as the operator signal that a non-leasing worker attempted to activate the leased job.

**Note**
There is currently no operation to remove a lease from a job. To recover, you have two options:

- Redeploy any worker for the job type with `withLease` set to `true`, to drain the leased jobs.
- Use process instance modification to terminate and reactivate the element, which produces a fresh, unleased job.

This also affects rollbacks. If you roll back a leasing worker deployment to a non-leasing version, any jobs leased in the interim stay permanently unavailable to the rolled-back version. Before rolling back, drain in-flight leased jobs of that type first, so the rolled-back version doesn't start out starved of jobs it can never activate.

**Tip**
Run a homogeneous fleet per job type: either all workers for a type request a lease, or none do. Mixed fleets work, but treat them as a transitional state, such as during a rollout. Keep an eye on the `skipped` jobs metric mentioned above to ensure the fleet is homogeneous.

---
Source: https://docs.camunda.io/docs/next/components/concepts/job-workers
