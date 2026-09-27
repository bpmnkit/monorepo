# Try with Swagger — Managing Swagger UI availability

### SaaS

Control Swagger UI access in [Camunda Hub](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/settings):

1. Open Camunda Hub.
1. In the left navigation under **Clusters**, select a cluster.
1. Click the **Settings** tab.
1. Toggle **Enable Swagger** on or off.
1. Changes apply automatically to your orchestration cluster.

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
