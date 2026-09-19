# Search mapping rules for tenant

`POST /tenants/{tenantId}/mapping-rules/search`

Retrieves a filtered and sorted list of MappingRules for a specified tenant.

- Required permissions: READ on MAPPING_RULE.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  tenantId (path, TenantId, required)

Request body:
  application/json: MappingRuleSearchQueryRequest
    sort (MappingRuleSearchQuerySortRequest[]) — Sort field criteria.
    filter (MappingRuleFilter) — The mapping rule search filters.

Responses:
  200 TenantMappingRuleSearchResult — The search result of MappingRules for the tenant.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-mapping-rules-for-tenant.api
