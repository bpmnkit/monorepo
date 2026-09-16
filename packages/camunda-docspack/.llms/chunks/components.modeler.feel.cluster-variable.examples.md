# Common use cases

Explore practical ways to use cluster variables with real-world examples.

Explore practical ways to use cluster variables with real-world examples, including environment-specific configurations, SLA rules, and integration endpoints.


## Environment-specific configuration

You need different API endpoints and timeouts across development, staging, and production environments.

**Setup:**

Global scope, e.g., production:

```json
{
  "PAYMENT_API": {
    "endpoint": "https://api.payment.prod.example.com",
    "timeout_ms": 5000,
    "retry_count": 3
  }
}
```

Tenant scope, e.g., dev environment:

```json
{
  "PAYMENT_API": {
    "endpoint": "https://api.payment.dev.example.com",
    "timeout_ms": 30000,
    "retry_count": 1
  }
}
```

**Usage in BPMN:**

For example, in a service task making a payment API call:

```
URL: = camunda.vars.env.PAYMENT_API.endpoint
Timeout: = camunda.vars.env.PAYMENT_API.timeout_ms
```

**Benefit:** The same BPMN file works across all environments without modification.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/examples
