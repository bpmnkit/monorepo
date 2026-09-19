# Common use cases — Integration credentials and endpoints

Your processes integrate with multiple external services that have different configurations per environment.

**Setup:**

Global scope, e.g., production:

```json
{
  "INTEGRATIONS": {
    "crm": {
      "base_url": "https://crm.prod.example.com",
      "api_version": "v2",
      "timeout_ms": 10000
    },
    "erp": {
      "base_url": "https://erp.prod.example.com",
      "api_version": "v1",
      "timeout_ms": 15000
    },
    "notification": {
      "base_url": "https://notify.prod.example.com",
      "api_version": "v1",
      "timeout_ms": 5000
    }
  }
}
```

Tenant scope, e.g., `sandbox`:

```json
{
  "INTEGRATIONS": {
    "crm": {
      "base_url": "https://crm.sandbox.example.com",
      "api_version": "v2",
      "timeout_ms": 30000
    }
  }
}
```

**Usage in BPMN:**

For example, a service task for CRM integration:

```
URL: = camunda.vars.env.INTEGRATIONS.crm.base_url + "/" +
camunda.vars.env.INTEGRATIONS.crm.api_version + "/customers"
```

**Benefit:** Centralize integration configuration and easily switch between environments.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/examples
