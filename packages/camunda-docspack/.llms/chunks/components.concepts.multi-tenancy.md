# Multi-tenancy

Multi-tenancy lets you host multiple logically isolated tenants within a single Camunda 8 installation, on both SaaS and Self-Managed.

[Multi-tenancy](https://docs.camunda.io/docs/next/reference/glossary#multi-tenancy) in Camunda 8 enables a single installation to serve multiple [tenants](https://docs.camunda.io/docs/next/reference/glossary#tenant) such as departments, teams, or external clients, while keeping each tenant's data and processes logically isolated.

This page describes **logical multi-tenancy**: tenant-ID based isolation within a single cluster.

| Deployment   | Availability                                           |
| :----------- | :----------------------------------------------------- |
| SaaS         | Available on clusters running generation 8.8 and later |
| Self-Managed | Available                                              |

**Note**
Self-Managed also supports stronger isolation models. For a comparison of logical tenants, Physical Tenants, and multi-cluster deployments, see the [Self-Managed multi-tenancy overview](https://docs.camunda.io/docs/next/self-managed/concepts/multi-tenancy/index).

---
Source: https://docs.camunda.io/docs/next/components/concepts/multi-tenancy
