# Search groups for tenant

`POST /tenants/{tenantId}/groups/search`

Retrieves a filtered and sorted list of groups for a specified tenant.

- Required permissions: READ on TENANT.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  tenantId (path, TenantId, required)

Request body:
  application/json: TenantGroupSearchQueryRequest
    sort (TenantGroupSearchQuerySortRequest[]) — Sort field criteria.

Responses:
  200 TenantGroupSearchResult — The search result of groups for the tenant.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-group-ids-for-tenant.api
