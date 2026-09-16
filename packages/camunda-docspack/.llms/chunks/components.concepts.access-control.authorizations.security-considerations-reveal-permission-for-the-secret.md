# Orchestration Cluster authorization — Security considerations — `REVEAL` permission for the Secret

`READ` and `REVEAL` on the `SECRET` resource are not interchangeable. `READ` lets a caller see that a secret reference exists, for example, in a `POST /v2/secrets/list` response. `REVEAL` lets a caller resolve a reference to its actual value.

`REVEAL` is never implied by `READ`, and it is never granted automatically alongside it. In particular, a blanket "`READ` for all resources" grant, like the built-in `readonly-admin` role uses, does not extend to `SECRET:REVEAL`. Of the built-in roles, only `admin` is granted `SECRET:REVEAL` by default; see [Default roles](#default-roles).

Because `REVEAL` exposes secret values, grant it only to trusted users and clients.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations
