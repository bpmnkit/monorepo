# Element templates at scale — Prerequisites

Before building your pipeline, ensure you have the following:

| Prerequisite                                                                                                                           | Purpose                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Git Repository](https://en.wikipedia.org/wiki/Git)                                                                                    | Store all element templates                                                                                                                                                                                                                                     |
| Template state management                                                                                                              | Maintain an authoritative inventory (for example, via Git or an IaC tool like Terraform) that defines which templates are applied to each cluster and which workspaces depend on them. This source acts as the single source of truth for template deployments. |
| Camunda Hub API token ([SaaS](https://docs.camunda.io/docs/next/apis-tools/hub-api-saas/authentication) or [Self-Managed](https://docs.camunda.io/docs/next/apis-tools/hub-api-sm/authentication)) | Access Camunda Hub programmatically                                                                                                                                                                                                                             |
| [Orchestration Cluster API client](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-authentication)        | Provision dependencies to clusters                                                                                                                                                                                                                              |

For simplicity, this guide assumes:

- One organization
- One cluster
- One [workspace](https://docs.camunda.io/docs/next/components/hub/organization/manage-workspaces/index)
- A pipeline handling runtime provisioning and template syncing

---
Source: https://docs.camunda.io/docs/next/components/best-practices/cicd-guidelines/element-templates-at-scale
