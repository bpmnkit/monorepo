# Authentication

Step through authentication options for accessing the Orchestration Cluster REST API.

This page explains how to authenticate requests to the Orchestration Cluster REST API across different deployment environments.


## Authentication support matrix

| Distribution                                                                      | Default Authentication | No auth support         | Basic auth support | OIDC-based auth support |
| --------------------------------------------------------------------------------- | ---------------------- | ----------------------- | ------------------ | ----------------------- |
| [Camunda 8 Run](https://docs.camunda.io/docs/next/self-managed/quickstart/developer-quickstart/c8run)           | None                   | ✅ (default)            | ✅ (when enabled)  | ✅ (when configured)    |
| [Docker Compose](https://docs.camunda.io/docs/next/self-managed/quickstart/developer-quickstart/docker-compose) | None                   | ✅ (default)            | ✅ (when enabled)  | ✅ (when configured)    |
| [Helm](https://docs.camunda.io/docs/next/self-managed/deployment/helm/install/quick-install)                    | Basic Auth             | ✅ (when auth disabled) | ✅ (default)       | ✅ (when configured)    |
| SaaS                                                                              | OIDC-based Auth        | ❌                      | ❌                 | ✅ (required)           |

**Info: Authentication vs. authorization**
Authentication establishes who is calling the Orchestration Cluster REST API (for example, using basic authentication or an OIDC access token). Authorization determines what that caller can do, based on authorizations configured in Admin.

To learn more about authorization resources, permissions, and precedence (including user task permissions), see [Orchestration Cluster authorization](https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations).

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-authentication
