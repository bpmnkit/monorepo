# Authentication — Using a token (OIDC/JWT)

OIDC-based authentication is recommended for production and required for SaaS. Obtain an access token and pass it as an OAuth 2.0 Bearer Token in the `Authorization` header of each request. The token's subject (user or client) must also have the required authorizations. Otherwise, requests fail with `403 Forbidden` even if authentication succeeds.

<Tabs groupId="environment" defaultValue="saas" queryString values={[
{label: 'SaaS', value: 'saas' },
{label: 'Self-Managed', value: 'self-managed' },
]}>

### saas

1. [Create client credentials](https://docs.camunda.io/docs/next/components/hub/organization/manage-clusters/manage-api-clients#create-a-client) in the Camunda Console.
2. Request an access token using the credentials:

```shell
curl --request POST ${CAMUNDA_OAUTH_URL} \
    --header 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode 'grant_type=client_credentials' \
    --data-urlencode "audience=${CAMUNDA_TOKEN_AUDIENCE}" \
    --data-urlencode "client_id=${CAMUNDA_CLIENT_ID}" \
    --data-urlencode "client_secret=${CAMUNDA_CLIENT_SECRET}"
```

3. Use the access token from the response in your API requests:

```shell
curl --header "Authorization: Bearer ${ACCESS_TOKEN}" \
     ${BASE_URL}/topology
```

### self-managed

**Prerequisites for OIDC-based authentication**

- Your Orchestration Cluster must already be configured with your Identity Provider. See [Set up OIDC-based Authentication](https://docs.camunda.io/docs/next/self-managed/components/orchestration-cluster/admin/connect-external-identity-provider).
- You must have a registered client in your IdP with a **client ID**, **client secret**, and authorization endpoint.
- Note the configured **audience** and **scope** for token requests (variables `OC_AUDIENCE` and `SCOPE`). Depends on IdP configuration.

**Request an access token using client credentials**

Example for Keycloak; adjust the authorization URI and parameters for your IdP:

```shell
curl --location --request POST 'http://<IDP_HOST>/auth/realms/<REALM>/protocol/openid-connect/token' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode "client_id=${CLIENT_ID}" \
--data-urlencode "client_secret=${CLIENT_SECRET}" \
--data-urlencode "audience=${OC_AUDIENCE}" \
--data-urlencode "scope=${SCOPE}" \
--data-urlencode 'grant_type=client_credentials'
```

> **Microsoft Entra ID**: Use `scope=${SCOPE}/.default` instead of `scope=${SCOPE}`. The Authorization URI is typically `https://login.microsoftonline.com/<tenant_id>/oauth2/v2.0/token`.

**Use the access token in API requests**

```shell
curl --header "Authorization: Bearer ${ACCESS_TOKEN}" \
     ${BASE_URL}/topology
```

### OIDC-based authentication using X.509 client certificates

For advanced security scenarios, you can obtain OIDC access tokens using X.509 client certificates. This is typically required in Self-Managed environments where your IdP enforces mutual TLS (mTLS).

**For Java applications**  
The Java client supports automatic OIDC access token retrieval using X.509 client certificates. Configure the necessary keystore and truststore via code or environment variables. See [Java client authentication](https://docs.camunda.io/docs/next/apis-tools/java-client/getting-started#oidc-access-token-authentication-with-x509-client-certificate) for details.

**For other clients**  
Refer to your IdP documentation for obtaining tokens using X.509 certificates.

### Automatic token management in official clients

Official Camunda clients (Java client or Spring Boot Starter) handle token acquisition and renewal automatically. You do not need to manually obtain or refresh tokens.

### Troubleshooting

- Check logs for authentication errors.
- Verify your access token includes the correct audience if audience validation is enabled.

### Learn more

- [Camunda Java client authentication and token management](https://docs.camunda.io/docs/next/apis-tools/java-client/getting-started)
- [Camunda Spring Boot Starter: Configuring the Camunda 8 connection](https://docs.camunda.io/docs/next/apis-tools/camunda-spring-boot-starter/getting-started#configuring-the-camunda-8-connection)
- [Orchestration Cluster authorization: Resources, permissions, and configuration](https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations)

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-authentication
