# Orchestration Cluster authorization — Security considerations — Authorization disabled and secret resolution

When authorization is disabled (see [Behavior when authorization is disabled](#behavior-when-authorization-is-disabled)), `POST /v2/secrets/resolve` does not enforce `SECRET:REVEAL`, and `POST /v2/secrets/list` does not enforce `SECRET:READ`. Resolve returns values for references the store resolves; list returns the matching references.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations
