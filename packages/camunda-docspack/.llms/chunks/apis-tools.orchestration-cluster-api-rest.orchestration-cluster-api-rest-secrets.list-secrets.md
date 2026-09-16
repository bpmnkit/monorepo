# Secrets — List secrets

`POST /v2/secrets/list` returns the names of references the caller is authorized to view. It never returns secret values.

Unauthorized references are omitted from the response rather than causing the request to fail.

The request body is optional and can be empty. The endpoint does not currently support filtering or pagination. Pagination is marked in the OpenAPI specification as a pre-GA follow-up.


## Grant required permissions

Resolving a reference requires `SECRET:REVEAL`. Listing requires `SECRET:READ`. Neither permission grants the other.

See [Authorizations](https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations) for details about permissions on the `SECRET` resource and who receives them by default.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-secrets
