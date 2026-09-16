# Common use cases — Feature flags

You want to gradually roll out a new approval workflow to specific tenants.

**Setup:**

Global scope, e.g., production:

```json
{
  "ENABLE_NEW_APPROVAL_FLOW": false
}
```

Tenant scope, e.g., `tenant-a`:

```json
{
  "ENABLE_NEW_APPROVAL_FLOW": true
}
```

Tenant scope, e.g., `beta-customer`:

```json
{
  "ENABLE_NEW_APPROVAL_FLOW": true
}
```

**Usage in BPMN:**

For example, in an exclusive gateway condition:

```
Condition for new flow: camunda.vars.env.ENABLE_NEW_APPROVAL_FLOW = true
Condition for old flow: camunda.vars.env.ENABLE_NEW_APPROVAL_FLOW = false
```

**Benefit:** Control feature rollout per tenant without deploying different process versions.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/examples
