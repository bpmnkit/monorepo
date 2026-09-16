# Orchestration Cluster REST API — Key features

This API is designed to make it easy to [find resources](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-data-fetching#advanced-search-filters) with a consistent experience, while ensuring all endpoints are secure with [authentication](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-authentication) and fine-grained [resource authorization](https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations).

Key features include:

| Feature                           | Description                                           |
| :-------------------------------- | :---------------------------------------------------- |
| Full process lifecycle management | Deploy, start, and monitor BPMN processes.            |
| User task operations              | Claim, complete, and manage human tasks.              |
| Variable management               | Read and update process variables.                    |
| Incident resolution               | Handle and resolve process incidents.                 |
| Advanced search and filtering     | Query process data with powerful search capabilities. |

**Info**

- This API is part of the Camunda 8 [public API](https://docs.camunda.io/docs/next/reference/public-api) and is covered by our SemVer stability guarantees (except for clearly marked alpha endpoints). You can rely on backward compatibility for production use.
- To learn more about the Orchestration Cluster, see [Orchestration Cluster](https://docs.camunda.io/docs/next/components/orchestration-cluster).
- In Self-Managed clusters running [Physical Tenants](https://docs.camunda.io/docs/next/self-managed/concepts/multi-tenancy/physical-tenants), most endpoints below are addressed per tenant by prefixing the path with `/physical-tenants/{physicalTenantId}`, while cluster-wide operations use the `/cluster/v2/...` prefix instead. See [API routing for Physical Tenants](https://docs.camunda.io/docs/next/self-managed/concepts/physical-tenants/api-routing).

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview
