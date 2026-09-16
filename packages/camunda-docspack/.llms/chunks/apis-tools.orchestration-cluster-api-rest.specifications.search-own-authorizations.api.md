# Search own authorizations

`POST /authentication/me/authorizations/search`

Search for the current authenticated principal's own authorization records — including authorizations granted directly to the user or client, as well as those granted via a group, role, or mapping rule the principal belongs to.

- Added in Camunda 8.10.
- Consistency: eventual.

Authentication: bearerAuth

Request body:
  application/json: AuthorizationSearchQuery
    sort (AuthorizationSearchQuerySortRequest[]) — Sort field criteria.
    filter (AuthorizationFilter) — The authorization search filters.

Responses:
  200 AuthorizationSearchResult — The authorization search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-own-authorizations.api
