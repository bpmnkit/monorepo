# Troubleshoot secret resolution failures — Resume a suspended job after secret resolution

A job waiting for an uncached secret is parked, as described in [activate a job that references secrets](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation#activate-a-job-that-references-secrets). If you suspend its process instance, the job enters `SUSPENDED` instead.

If the secret resolves while the process instance is suspended, the job remains suspended and does not become activatable automatically.

Resume the process instance to make the job available again. On the next activation attempt, Camunda injects the resolved value if it is still cached. If the value is no longer cached, Camunda parks the job again and requests secret resolution.

In either case, no additional operator action is required and no incident is raised.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents
