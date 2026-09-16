# Troubleshoot secret resolution failures — Retry after fixing the cause

Resolve the incident after correcting the underlying problem. Resolving the incident retries the failed operation and makes the job activatable again.

| You fixed                                     | After you resolve the incident                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| The secret in the store or store access       | The broker requests resolution again, and the job activates once the value is cached. |
| The variable or input mapping                 | Camunda retries injection against the current job variables.                          |
| The size of the secret value or job variables | The job activates once the resolved values fit within the message-size limit.         |

You don't need to redeploy or make changes to workers, clients, or job worker libraries. Jobs blocked on a reference become activatable automatically once the reference resolves, whether resolution follows an incident or store recovery.

<!-- The secret resolution and secret cache meters that show a store failing before it produces incidents are owned by camunda/camunda#60963. Link them here once they are in the metrics reference. -->

<!-- The camunda.secrets.* secret store configuration is owned by camunda/camunda#60331. Link the store configuration reference from the diagnosis steps once it lands. -->

---
Source: https://docs.camunda.io/docs/next/components/concepts/secret-resolution-incidents
