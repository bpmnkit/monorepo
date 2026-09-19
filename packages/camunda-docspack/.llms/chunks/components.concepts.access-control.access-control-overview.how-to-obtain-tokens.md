# Identity and access management in Camunda 8 — How to obtain tokens

For environments using OIDC:

1. Generate a JSON Web Token (JWT).
2. Include the token in each API request as: `Authorization: Bearer <TOKEN>`.

- [Generate a token (SaaS)](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/manage-api-clients#create-a-client)
- [Generate a token (Self-Managed)](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/admin/connect-external-identity-provider)

Example request using a token:

```shell
curl --header "Authorization: Bearer ${ACCESS_TOKEN}" \
     ${BASE_URL}/v2/process-instances/search
```

### Token expiration

Tokens expire according to the `expires_in` field returned by the IdP. After expiration, request a new token.


## Learn more

### Orchestration Cluster authentication and authorization

- [Set up OIDC-based authentication](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/admin/connect-external-identity-provider)
- [Orchestration Cluster authorization](https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations)

### Task access control

- [User task authorization](https://docs.camunda.io/docs/next/components/tasklist/user-task-authorization)

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/access-control-overview
