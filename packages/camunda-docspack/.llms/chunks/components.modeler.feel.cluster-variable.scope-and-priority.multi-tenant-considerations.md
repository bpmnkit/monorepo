# Scope resolution — Multi-tenant considerations

### Tenant isolation

Each tenant's cluster variables are fully isolated. A process running in one tenant cannot access cluster variables defined for another tenant, even with explicit namespace access.

### Global defaults pattern

Define sensible defaults globally and override only what you need at the tenant level:

```
GLOBAL: {
  RATE_LIMITS: {
    requests_per_minute: 100,
    burst_limit: 150,
    concurrent_connections: 10
  }
}

TENANT (premium): {
  RATE_LIMITS: {
    requests_per_minute: 1000,
    burst_limit: 1500,
    concurrent_connections: 100
  }
}
```


## Troubleshoot scope resolution

1. **Check all three scope levels**: Verify values at global, tenant, and process levels.
2. **Use scope-specific namespaces**: Test with `camunda.vars.cluster` and `camunda.vars.tenant` to isolate scope.
3. **Verify tenant context**: Ensure the process is running in the expected tenant.
4. **Look for shadowing**: Check for process variables that might shadow cluster variables.
5. **Validate structure**: Ensure objects have consistent structure across scopes.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/scope-and-priority
