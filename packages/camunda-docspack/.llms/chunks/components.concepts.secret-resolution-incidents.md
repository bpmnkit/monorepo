# Troubleshoot secret resolution failures

Diagnose the incidents raised when a job's secret references cannot be resolved or their values cannot be injected, fix the cause, and understand what happens next.


## About

When a job's [secret references](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation) cannot be delivered, the cluster responds in one of three ways:

- Raises a `SECRET_RESOLUTION_ERROR` incident,
- Raises a `MESSAGE_SIZE_EXCEEDED` incident,
- Defers the job and retries it without raising an incident.

Only the two incident cases require operator action.

Use this troubleshooting guide to diagnose an existing secret resolution or activation problem.

**Tip**
To understand how secret resolution and job activation work, see [Secret resolution and job activation](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation).

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents
