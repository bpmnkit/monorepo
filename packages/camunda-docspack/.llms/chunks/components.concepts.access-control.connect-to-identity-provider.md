# Connect to an Identity Provider

Learn how to connect Camunda 8 components to an external Identity Provider (IdP) for authentication and user management.

Integrate with an external identity provider (IdP) for single sign-on (SSO), centralized user management, and secure authentication.


## About IdP integration

Connecting Camunda 8 to an external IdP allows you to:

- Use enterprise authentication (for example, Microsoft EntraID, Okta, Keycloak, Auth0).
- Centrally manage users in your IdP.
- Enable SSO for Camunda components.
- Enforce organization-wide security policies.


## Self-Managed

Self-Managed deployments only support external IdP integration using **OpenID Connect (OIDC)** (for example, Keycloak, Auth0, Okta, EntraID via OIDC).

You can integrate an IdP with both Admin (for the Orchestration Cluster) and Management Identity (for Camunda Hub and Optimize).

- [Connect Orchestration Cluster Admin to an identity provider](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/admin/connect-external-identity-provider)
- [Connect Management Identity to an identity provider](https://docs.camunda.io/docs/next/self-managed/components/management-identity/configuration/connect-to-an-oidc-provider)

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/connect-to-identity-provider
