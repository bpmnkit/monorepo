# How to use cluster variables — Usage best practices

#### Use meaningful names

Choose clear, descriptive variable names that indicate purpose and scope.
For example:

```
✓ camunda.vars.env.PAYMENT_API_ENDPOINT
✗ camunda.vars.env.URL1
```

#### Group related configuration

Use nested objects to organize related values.
For example:

```
✓ camunda.vars.env.PAYMENT_CONFIG.endpoint
✓ camunda.vars.env.PAYMENT_CONFIG.timeout
✓ camunda.vars.env.PAYMENT_CONFIG.retry_count
```

#### Follow naming conventions

Establish and follow naming patterns across your organization.
For example:

- `UPPER_SNAKE_CASE` for top-level keys.
- `camelCase` or `snake_case` for nested properties.

#### Document variable contracts

Maintain documentation of expected cluster variables, their structures, and allowed overrides per process.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/usage-guide
