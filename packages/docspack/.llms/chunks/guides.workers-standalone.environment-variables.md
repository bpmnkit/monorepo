# Standalone Workers — Environment variables

| Variable | Required | Description |
|---|---|---|
| `ZEEBE_ADDRESS` | no | Zeebe REST base URL (default: `http://localhost:26500`) |
| `ZEEBE_CLIENT_ID` | Camunda SaaS only | OAuth2 client ID |
| `ZEEBE_CLIENT_SECRET` | Camunda SaaS only | OAuth2 client secret |
| `ZEEBE_TOKEN_URL` | no | OAuth2 token URL (default: Camunda SaaS endpoint) |
| `ZEEBE_TOKEN_AUDIENCE` | no | OAuth2 audience (default: `zeebe.camunda.io`) |

For local development with reebe, only `ZEEBE_ADDRESS` matters (or leave it at the default).

---
Source: https://bpmnkit.com/docs/guides/workers-standalone
