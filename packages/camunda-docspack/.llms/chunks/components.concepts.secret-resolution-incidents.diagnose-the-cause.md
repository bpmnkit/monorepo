# Troubleshoot secret resolution failures — Diagnose the cause

Start with the incident error type and message, then confirm the underlying cause in the broker log. Incident messages don't include the store's error category, so use the log to distinguish conditions such as a missing secret, denied access, or an unavailable store.

1. Read the incident in Operate or search for incidents filtered by `errorType`. Note the secret reference, variable path, and job key from the message.
2. For incidents whose message starts with `Failed to resolve secret`, search the broker log for the affected partition and reference name. Match the log entry to the table below.
3. For injection failures, inspect the job variables at the reported path in Operate or through the element instance variables.

| Broker log line                                                                                    | Cause                                                                                                | Fix                                                                                                     |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Secret '<ref>' in secret store '<id>' failed permanently: NOT_FOUND — No secret store configured` | No secret store is configured for this physical tenant, so every reference fails as not found.       | Configure a secret store.                                                                               |
| `Secret '<ref>' in secret store '<id>' failed permanently: NOT_FOUND — <message>`                  | The store does not contain a secret with that name.                                                  | Create the secret or correct the reference name in the process.                                         |
| `Secret '<ref>' in secret store '<id>' failed permanently: ACCESS_DENIED — <message>`              | The credentials used by the broker don't have permission to read the secret.                         | Grant read access in the secret store. This is store-level access control, not a Camunda authorization. |
| `Secret '<ref>' in secret store '<id>' failed permanently: INVALID_REF — <message>`                | The store rejects the reference name as invalid.                                                     | Rename the secret so the store and Camunda reference syntax both accept it.                             |
| `Secret '<ref>' in secret store '<id>' failed permanently: UNREADABLE — <message>`                 | The store contains the secret, but its value cannot be read or decoded.                              | Repair the stored value.                                                                                |
| `Secret store '<id>' unavailable (attempt <n>/<m>), retrying in <backoff>: <message>`              | The failure is transient. The broker is retrying the store with backoff, and no incident exists yet. | If the failure persists, restore the store's availability.                                              |
| `Secret store '<id>' unavailable after <n>/<m> attempts — failing <n> pending refs: <message>`     | The store remained unavailable through `retry-max-attempts`, so its pending references failed.       | Restore the store's availability, then resolve the incidents.                                           |

The separator in these log lines is an em dash, and `<message>` contains the store's own error text. Search for a distinctive fragment such as `failed permanently` rather than the entire line.

Then verify the reference itself:

- **Reference name**: Confirm the reference resolves to the intended secret name. In an input mapping, Camunda detects references from the parsed FEEL expression, so FEEL syntax determines where the name ends. For example, FEEL interprets `=camunda.secrets.db-password` as the reference `db` minus the variable `password`. Escape names that aren't valid bare FEEL identifiers with backticks, for example ``=camunda.secrets.`db-password` ``. If the incident names a shorter secret than expected, check whether FEEL interpreted part of the name as an operator.

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents
