# @bpmnkit/worker-client — `createWorkerClient(options?)`

Factory function. Reads connection details from environment variables by default.

```typescript
const client = createWorkerClient({
  address:      "http://localhost:26500",  // or ZEEBE_ADDRESS
  clientId:     "...",                     // or ZEEBE_CLIENT_ID
  clientSecret: "...",                     // or ZEEBE_CLIENT_SECRET
  tokenUrl:     "...",                     // or ZEEBE_TOKEN_URL
  audience:     "zeebe.camunda.io",        // or ZEEBE_TOKEN_AUDIENCE
  workerName:   "my-worker",              // sent during job activation
})
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `address` | `string` | `ZEEBE_ADDRESS` or `http://localhost:26500` | Zeebe REST base URL |
| `clientId` | `string` | `ZEEBE_CLIENT_ID` | OAuth2 client ID (Camunda SaaS) |
| `clientSecret` | `string` | `ZEEBE_CLIENT_SECRET` | OAuth2 client secret (Camunda SaaS) |
| `tokenUrl` | `string` | `ZEEBE_TOKEN_URL` or Camunda SaaS endpoint | OAuth2 token URL |
| `audience` | `string` | `ZEEBE_TOKEN_AUDIENCE` or `zeebe.camunda.io` | OAuth2 audience |
| `workerName` | `string` | `"bpmnkit-worker"` | Worker name sent during activation |

### Returns

A `WorkerClient` object with a single `poll()` method.

---
Source: https://bpmnkit.com/docs/packages/worker-client
