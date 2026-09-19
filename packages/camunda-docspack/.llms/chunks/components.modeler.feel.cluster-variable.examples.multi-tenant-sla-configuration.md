# Common use cases — Multi-tenant SLA configuration

Different tenants have different Service Level Agreements (SLAs) with varying approval thresholds and escalation timeouts.

**Setup:**

Tenant scope, e.g., `tenant-a`:

```json
{
  "SLA_CONFIG": {
    "approval_threshold": 1000,
    "escalation_hours": 24,
    "auto_approve_limit": 100
  },
  "auto_approve_limit": 100
}
```

Tenant scope, e.g., `tenant-b`:

```json
{
  "SLA_CONFIG": {
    "approval_threshold": 50000,
    "escalation_hours": 4,
    "auto_approve_limit": 5000
  },
  "auto_approve_limit": 5000
}
```

Tenant scope, e.g., `tenant-c`:

```json
{
  "SLA_CONFIG": {
    "approval_threshold": 5000,
    "escalation_hours": 48,
    "auto_approve_limit": 500
  },
  "auto_approve_limit": 500
}
```

**Usage in BPMN:**

For example, in a gateway condition for auto-approval:

```
amount <= camunda.vars.env.SLA_CONFIG.auto_approve_limit
```

Timer boundary event for escalation:

```
Duration: = duration("PT" + string(camunda.vars.env.SLA_CONFIG.escalation_hours) + "H")
```

**Benefit:** Customize business rules per tenant while maintaining a single process definition.

---
Source: https://docs.camunda.io/docs/next/components/modeler/feel/cluster-variable/examples
