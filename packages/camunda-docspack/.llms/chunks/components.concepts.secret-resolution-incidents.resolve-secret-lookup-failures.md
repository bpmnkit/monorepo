# Troubleshoot secret resolution failures — Resolve secret lookup failures

A secret lookup failure raises a `SECRET_RESOLUTION_ERROR` incident. This happens when the secret store returns a permanent failure or remains unavailable until all retry attempts are exhausted.

The broker raises one incident per affected job. If a job already has an incident for another failed secret reference, the broker does not raise a second incident. As a result, a job waiting on multiple failed secrets shows only the first incident.

```text
Failed to resolve secret 'API_TOKEN' from the configured secret store. Ensure the secret exists and the store is available, then resolve the incident to retry.
```

For the default store, the incident message uses `the configured secret store`. For any other store, it uses `secret store '<storeId>'`.

The `camunda.secrets.<name>` syntax does not currently identify a store, so every reference addresses the default store. As a result, incident messages currently use the default-store wording.

The incident message does not identify the underlying store failure. Check the broker log and follow [Diagnose the cause](#diagnose-the-cause) to determine whether the secret is missing, access is denied, the store is unavailable, or another failure occurred.

While the incident is active, the job is not activatable and no worker receives it. The broker does not raise another incident for the same failed reference.

### Retry after resolving the incident

Resolve the incident only after fixing the underlying cause. Resolving the incident makes the job activatable again. On the next activation attempt, the broker requests resolution again because the reference is still uncached.

You don't need to redeploy or make client-side changes. Once the reference resolves successfully, the process instance continues from where it stopped.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents
