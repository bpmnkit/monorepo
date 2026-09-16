# Multi-tenancy — Enable multi-tenancy checks

Tenants can be created and principals assigned regardless of whether checks are enabled. Enabling checks enforces the assignments. How you enable checks depends on your deployment model.

### SaaS

On SaaS, enable multi-tenancy checks per cluster using the **Multi-tenancy** toggle in Camunda Hub:

1. Navigate to **Camunda Hub**, and select the **Clusters** tab.
2. Select the cluster you want to manage, and select the **Settings** tab.
3. Enable the **Multi-tenancy** setting.

For details on the toggle, its default state, and who can change it, see [cluster settings](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/settings#multi-tenancy).

The **Multi-tenancy** toggle is available for clusters running generation 8.8 and later. It is disabled by default, and only organization admins can change it. Disabling the toggle restores the implicit `<default>`-tenant behavior.

### Self-Managed

On Self-Managed, operators enable multi-tenancy checks through configuration properties. See [Orchestration Cluster configuration properties](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/core-settings/configuration/properties#multi-tenancy).

---
Source: https://docs.camunda.io/docs/next/components/concepts/multi-tenancy
