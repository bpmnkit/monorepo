# Try with Swagger — Managing Swagger UI availability

### SaaS

Control Swagger UI access through the Camunda Console:

1. Navigate to your cluster in the Camunda Console
2. Go to **Cluster Settings**
3. Toggle **Enable Swagger** on or off
4. Changes apply automatically to your orchestration cluster

### Self-Managed

Configure Swagger UI availability using environment variables:

**Enable Swagger UI (default):**

```bash
CAMUNDA_REST_SWAGGER_ENABLED=true
```

**Disable Swagger UI:**

```bash
CAMUNDA_REST_SWAGGER_ENABLED=false
```

**Alternative property format:**

```yaml
camunda:
  rest:
    swagger:
      enabled: true
```

**Security consideration:** In production environments, consider disabling Swagger UI and using it only in development environments.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-swagger
