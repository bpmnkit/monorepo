# Troubleshoot secret resolution failures

Diagnose the incidents raised when a job's secret references cannot be resolved or their values cannot be injected, fix the cause, and know what happens next.

When a job's [secret references](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation) cannot be delivered, the cluster responds in one of three ways: it raises a `SECRET_RESOLUTION_ERROR` incident, raises a `MESSAGE_SIZE_EXCEEDED` incident, or defers the job and retries it without raising an incident.

This page describes an alpha feature and may change in future releases. See [alpha features](https://docs.camunda.io/docs/next/components/early-access/alpha/alpha-features).

Only the two incident cases require operator action.

Use this page to diagnose an existing secret resolution or activation problem. To understand how secret resolution and job activation work, see [Secret resolution and job activation](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation).

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents
