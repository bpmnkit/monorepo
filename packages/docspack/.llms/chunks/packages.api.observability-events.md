# @bpmnkit/api — Observability Events

```typescript
type ClientEvent = "request" | "response" | "error" | "retry" | "token-refresh";

client.on("request",  (e) => logger.debug(e.method, e.url));
client.on("response", (e) => metrics.histogram("api.latency", e.durationMs));
client.on("error",    (e) => logger.error(e.status, e.url, e.body));
client.on("retry",    (e) => logger.warn(`Retrying ${e.url} (attempt ${e.attempt})`));
```

---
Source: https://bpmnkit.com/docs/packages/api
