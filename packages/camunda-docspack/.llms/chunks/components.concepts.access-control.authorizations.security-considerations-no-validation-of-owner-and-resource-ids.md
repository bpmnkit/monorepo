# Orchestration Cluster authorization — Security considerations — No validation of owner and resource IDs

When you create an authorization, the Orchestration Cluster validates the owner depending on the `ownerType`. For `USER`, `ROLE`, `GROUP`, and `MAPPING_RULE`, the owner must exist in Admin. For `CLIENT`, the owner is not validated.

The Orchestration Cluster does not validate whether the resource exists when creating an authorization.

- This behavior lets you create authorizations for entities outside of the system (for example OIDC users) or for entities that will be created in the future (for example creating process definition authorizations before the process is deployed).

- However, you should keep this in mind when setting up new users, groups, roles, and so on, and verify that the ID of the new entity does not accidentally match an existing authorization.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations
