# Camunda 8 Deployment — Managing Incidents

```typescript
// List open incidents
const incidents = await client.incidents.list({
  state: "ACTIVE",
});

// Resolve an incident (after fixing the underlying issue)
await client.incidents.resolve({ incidentKey: incident.key });
```


## Lifecycle Events

Use the TypedEventEmitter to react to API events:

```typescript
client.on("request", (e) => {
  console.log(`→ ${e.method} ${e.url}`);
});

client.on("response", (e) => {
  console.log(`← ${e.status} in ${e.durationMs}ms`);
});

client.on("error", (e) => {
  metrics.increment("camunda.api.error", { url: e.url });
});
```

---
Source: https://bpmnkit.com/docs/guides/deployment
