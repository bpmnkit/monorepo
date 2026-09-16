# Try with Swagger — Authentication in Swagger UI

Swagger UI supports the same authentication methods as the REST API. Choose the method that matches your deployment:

### Automatic authentication

- **Session-based authentication**: If you're already logged into Camunda (for example, through Operate), Swagger UI automatically authenticates you using your session cookie

### Manual authentication

Click the **Authorize** button in Swagger UI to manually configure authentication:

#### Bearer Token (Recommended for production)

1. Click **Authorize** in Swagger UI
2. In the **Bearer** section, enter your JWT access token
3. Click **Authorize** to apply

**To obtain a Bearer token:**

- **SaaS**: Follow the [OIDC-based Authentication guide](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-authentication#oidc-access-token-authentication-using-client-credentials) for SaaS
- **Self-Managed**: Follow the [OIDC-based Authentication guide](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-authentication#oidc-access-token-authentication-using-client-credentials) for Self-Managed

#### Basic Authentication

1. Click **Authorize** in Swagger UI
2. In the **Basic** section, enter your username and password
3. Click **Authorize** to apply

**Note:** Basic Authentication is only available for Self-Managed deployments.

For detailed authentication setup instructions, see the [Authentication guide](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-authentication).

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-swagger
