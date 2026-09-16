# Multi-tenancy — Manage tenants

Administrators can manage all tenants centrally in [Admin](https://docs.camunda.io/docs/next/components/admin/tenant). This unified management interface simplifies monitoring, configuration, and maintenance tasks across tenant environments.

The **Tenants** tab in Admin is available to organization admins on SaaS clusters running generation 8.8 and later, even before multi-tenancy checks are enabled. This allows admins to set up tenants and assignments before enforcing checks.


## Optimize and multi-tenancy

Optimize multi-tenancy is available in **Self-Managed only**.

On SaaS, Optimize can only access data from the `<default>` tenant. Data scoped to other tenants is not available in Optimize on SaaS.

In Self-Managed, [Management Identity](https://docs.camunda.io/docs/next/self-managed/components/management-identity/overview) is used for identity and access management of components outside the [Orchestration Cluster](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/overview). Of those, only [Optimize](https://docs.camunda.io/docs/next/self-managed/components/optimize/overview) is tenant aware and can make use of multi-tenancy. To use it with the same tenants as an Orchestration Cluster, you must manually synchronize the tenants in both the Orchestration Cluster and Management Identity. This means manually creating them, and updating them whenever they change. Two tenants are considered the same if they have the same ID.

---
Source: https://docs.camunda.io/docs/next/components/concepts/multi-tenancy
