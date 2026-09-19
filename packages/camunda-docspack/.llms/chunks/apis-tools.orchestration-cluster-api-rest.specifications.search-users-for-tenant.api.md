# Search users for tenant

`POST /tenants/{tenantId}/users/search`

Retrieves a filtered and sorted list of users for a specified tenant.

- Required permissions: READ on TENANT.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  tenantId (path, TenantId, required)

Request body:
  application/json: TenantUserSearchQueryRequest
    sort (TenantUserSearchQuerySortRequest[]) — Sort field criteria.

Responses:
  200 TenantUserSearchResult — The search result of users for the tenant.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-users-for-tenant.api
