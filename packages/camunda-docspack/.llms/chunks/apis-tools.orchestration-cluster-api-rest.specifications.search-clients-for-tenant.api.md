# Search clients for tenant

`POST /tenants/{tenantId}/clients/search`

Retrieves a filtered and sorted list of clients for a specified tenant.

- Required permissions: READ on TENANT.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  tenantId (path, TenantId, required)

Request body:
  application/json: TenantClientSearchQueryRequest
    sort (TenantClientSearchQuerySortRequest[]) — Sort field criteria.

Responses:
  200 TenantClientSearchResult — The search result of users for the tenant.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-clients-for-tenant.api
