# Multi-tenancy — Example: tenant membership in action

When a user deploys a process model or starts a process instance, the system validates the user's tenant assignments.

For example, assume a user belongs to `tenant-a` but not `tenant-b`:

1. **Deploying a process model**
   - If the user deploys to `tenant-a`, the Orchestration Cluster verifies the assignment. If valid, the model is deployed and all related process instances belong to `tenant-a`.
   - If the user deploys to `tenant-b`, the deployment fails because the user lacks access to that tenant.

2. **Running process instances**
   - When querying process instances, the user only sees instances belonging to `tenant-a`.

This mechanism ensures proper isolation and access control across tenants.

---
Source: https://docs.camunda.io/docs/next/components/concepts/multi-tenancy
