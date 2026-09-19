# Identity and access management in Camunda 8 — Authentication methods

Camunda 8 supports multiple authentication methods depending on the environment:

| Environment                                                                       | Authentication method              | Notes                                                                                    |
| --------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| [Camunda 8 Run](https://docs.camunda.io/docs/next/self-managed/quickstart/developer-quickstart/c8run)           | None / Basic authentication / OIDC | No auth or Basic authentication only for local development. OIDC optional if configured. |
| [Docker Compose](https://docs.camunda.io/docs/next/self-managed/quickstart/developer-quickstart/docker-compose) | None / Basic authentication / OIDC | No auth or Basic authentication only for local development. OIDC optional if configured. |
| [Helm Self-Managed](https://docs.camunda.io/docs/next/self-managed/deployment/helm/install/index)               | Basic authentication / OIDC        | Basic authentication default, OIDC optional if configured.                               |
| SaaS                                                                              | OIDC                               | OIDC required for all requests.                                                          |

- No authentication: only for local development (Run, Docker Compose).
- Basic authentication: simple to set up; not recommended for production.
- OIDC-based authentication: recommended for production Self-Managed and required for SaaS.

For API documentation, link to the centralized authentication overview instead of repeating environment defaults.

**Warning**
The Operate, Tasklist, and Zeebe REST APIs are deprecated and should not be used for new development. While they continue to function, new development should use the Orchestration Cluster REST API by referencing the [Orchestration Cluster REST API migration documentation](https://docs.camunda.io/docs/next/apis-tools/migration-manuals/migrate-to-camunda-api).

Authentication for these APIs works the same way. See [Orchestration Cluster REST API authentication](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-authentication) for details.

### Users and clients

Actions in an orchestration cluster can be executed by two kinds of authenticated entities (also known as principals): users and clients. [Users](https://docs.camunda.io/docs/next/components/admin/user) typically interact with the cluster through a browser, while [clients](https://docs.camunda.io/docs/next/components/admin/client) interact programmatically through the APIs.

Although both principal types can use web UIs and APIs, the distinction still matters. Users represent individuals who are granted access to an orchestration cluster, whereas clients represent systems or applications.

**Note**
If you're using Basic authentication to secure your cluster, both users and clients are treated as users. There is no dedicated client concept in this configuration.

Distinguishing between users and clients aligns your access management with how identities are modeled in your identity provider. They are usually authenticated differently (for example, username and password for users versus a client certificate for applications), have different authorization requirements (such as administrator access versus deployment permissions). Separating them simplifies auditing and operational clarity.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/access-control-overview
