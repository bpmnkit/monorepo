# Orchestration Cluster authorization — Security considerations — `CREATE`/`UPDATE` permissions for the User

The `CREATE` and `UPDATE` permissions for the **User** resource are highly sensitive. When a user's password is set or changed via Admin, there are no security controls enforced, such as password complexity policies.

This permission should only be assigned to trusted administrators.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations
