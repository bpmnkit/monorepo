# Search roles for tenant

`POST /tenants/{tenantId}/roles/search`

Retrieves a filtered and sorted list of roles for a specified tenant.

- Required permissions: READ on ROLE.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  tenantId (path, TenantId, required)

Request body:
  application/json: RoleSearchQueryRequest
    sort (RoleSearchQuerySortRequest[]) — Sort field criteria.
    filter (RoleFilter) — The role search filters.

Responses:
  200 TenantRoleSearchResult — The search result of roles for the tenant.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-roles-for-tenant.api
