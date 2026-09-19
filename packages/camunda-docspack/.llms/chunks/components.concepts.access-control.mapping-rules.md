# Mapping rules

Map authentication entities from your Identity Provider (IdP) to Camunda-specific entities using mapping rules.

Mapping rules are used to dynamically manage access control by [connecting your Identity Provider](https://docs.camunda.io/docs/next/components/concepts/access-control/connect-to-identity-provider) and mapping claims from a JWT access token to [Admin](https://docs.camunda.io/docs/next/components/admin/admin-introduction) entities in Camunda 8.


## Mapping rules in SaaS and Self-Managed

In Camunda 8 SaaS, mapping rules are not supported.

In Camunda 8 Self-Managed, configure mapping rules in the following components:

- Orchestration Cluster Admin: Manage permissions within an [orchestration cluster](https://docs.camunda.io/docs/next/components/orchestration-cluster). Use mapping rules to assign users to [user groups](https://docs.camunda.io/docs/next/components/admin/group) and [roles](https://docs.camunda.io/docs/next/components/admin/role), grant [authorizations](https://docs.camunda.io/docs/next/components/admin/authorization), and associate them with specific [tenants](https://docs.camunda.io/docs/next/components/admin/tenant).
- Mapping rules are available for Orchestration Cluster Admin only when using [OIDC-based authentication](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/admin/connect-external-identity-provider). They do not apply to other authentication methods, such as Basic authentication.

- Management Identity: Manage access to components like [Camunda Hub](https://docs.camunda.io/docs/next/self-managed/components/hub/index) and [Optimize](https://docs.camunda.io/docs/next/self-managed/components/optimize/overview). Mapping rules in [Management Identity](https://docs.camunda.io/docs/next/self-managed/components/management-identity/overview) assign users to roles and tenants, granting access to those components. To learn more, see the [guide on managing mapping rules in Management Identity](https://docs.camunda.io/docs/next/self-managed/components/management-identity/mapping-rules).

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/mapping-rules
