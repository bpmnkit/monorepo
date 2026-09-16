# Identity and access management in Camunda 8 — Identity provider (IdP) integration

In production setups, both the Orchestration Cluster Admin and the Management Identity can integrate with an external OIDC IdP (such as Entra ID) for unified user management, single sign-on (SSO), and consistent security policies.

| Identity type               | Description                                                                                                                                          | Default IdP              | External IdP support                  |
| :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------- | :------------------------------------ |
| Orchestration Cluster Admin | Built-in user management with support for external IdP integration via OIDC. Connects to enterprise IdPs such as Microsoft Entra ID, Okta, and more. | Built-in user management | OIDC integration with enterprise IdPs |
| Management Identity         | Uses Keycloak by default, but can be configured with an external IdP via OIDC.                                                                       | Keycloak                 | OIDC integration with external IdPs   |

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/access-control-overview
