# Create group

`POST /groups`

Create a new group.

The supplied `groupId` is validated against `^[a-zA-Z0-9_~@.+-]+
(max 256 characters) by `IdentifierValidator.validateId` in the
runtime. This strict validation applies wherever the Groups API
is available: in OIDC deployments that set
`camunda.security.authentication.oidc.groupsClaim` the Groups
API (including this endpoint) is disabled entirely, so group
CRUD never sees externally-minted IdP IDs. The BYOG relaxation
only loosens validation when a group is referenced *as a member*
of a role or tenant (`assignRoleToGroup`,
`assignGroupToTenant`); group CRUD itself always uses the strict
default-id regex. The constraint is not advertised on the
`GroupId` schema so that the same schema can be reused at
member-reference sites without falsely rejecting
externally-minted IdP group IDs there.

- Required permissions: CREATE on GROUP.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: GroupCreateRequest
    groupId (GroupId, required) — The ID of the new group.
    name (string, required) — The display name of the new group.
    description (string) — The description of the new group.

Responses:
  201 GroupCreateResult — The group was created successfully.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  409 ProblemDetail — Group with this id already exists.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-group.api
