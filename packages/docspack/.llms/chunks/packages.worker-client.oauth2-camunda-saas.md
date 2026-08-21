# @bpmnkit/worker-client — OAuth2 (Camunda SaaS)

When `clientId` and `clientSecret` are present (either via options or env vars), the client
fetches an OAuth2 token before the first request and refreshes it automatically 60 seconds
before expiry. No manual token management required.

```sh
ZEEBE_ADDRESS=https://your-cluster.bru-2.zeebe.camunda.io:443
ZEEBE_CLIENT_ID=abc123
ZEEBE_CLIENT_SECRET=def456
node dist/index.js
```


## Environment variables

| Variable | Description |
|---|---|
| `ZEEBE_ADDRESS` | Zeebe REST base URL |
| `ZEEBE_CLIENT_ID` | OAuth2 client ID |
| `ZEEBE_CLIENT_SECRET` | OAuth2 client secret |
| `ZEEBE_TOKEN_URL` | OAuth2 token URL |
| `ZEEBE_TOKEN_AUDIENCE` | OAuth2 audience |

---
Source: https://docs.bpmnkit.com/packages/worker-client/
