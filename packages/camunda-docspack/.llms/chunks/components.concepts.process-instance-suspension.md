# Process instance suspension

Temporarily pause a running process instance and resume it later without losing state.

Process instance suspension lets you temporarily freeze a running process instance without canceling it. The instance retains all its state during suspension, and execution continues from the same point when you resume it.

Suspension is not a substitute for cancellation or deletion. The instance continues to occupy cluster resources during suspension, including storage for any commands that accumulate while suspended.

Common use cases include:

- Pausing execution while an upstream or downstream system is unavailable or misconfigured.
- Preventing new jobs from being handed out to workers during a planned maintenance window.
- Temporarily halting a batch of instances while an investigation is in progress.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-suspension
