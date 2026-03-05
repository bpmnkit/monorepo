# @bpmn-sdk/api

TypeScript SDK for the [Camunda 8 Orchestration Cluster REST API (v2)](https://docs.camunda.io/docs/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview/).

Auto-generated from the official OpenAPI specs. Zero runtime dependencies.

## Features

- **180 typed operations** across 30+ resource namespaces (`processInstance`, `job`, `userTask`, `deployment`, …)
- **502 TypeScript types** — every request body, response, filter, and enum from the OpenAPI spec
- **Authentication** — bearer token, OAuth2 (with automatic token refresh), HTTP Basic, or none
- **Retries** — exponential backoff with jitter, configurable per status code
- **Caching** — in-memory LRU cache with TTL, automatically applied to eventually-consistent endpoints
- **Events** — subscribe to `request`, `response`, `error`, `retry`, `tokenRefresh`, `cacheHit`, `cacheMiss`
- **Error hierarchy** — typed errors for every HTTP status class (`CamundaNotFoundError`, `CamundaRateLimitError`, …)
- **Structured logging** — pluggable sink, configurable log level

## Installation

```bash
pnpm add @bpmn-sdk/api
```

## Quick start

```typescript
import { CamundaClient } from "@bpmn-sdk/api";

const client = new CamundaClient({
  baseUrl: "http://localhost:8080/v2",
  auth: { type: "bearer", token: "my-token" },
});

const result = await client.processInstance.search({
  filter: { state: "ACTIVE" },
});

console.log(result.items);
```

## Configuration

Configuration is resolved from three sources in priority order (highest wins):

1. **Constructor options** — values passed directly to `new CamundaClient({...})`
2. **Config file** — YAML file at `configFile` path or `CAMUNDA_CONFIG_FILE` env var
3. **Environment variables** — `CAMUNDA_*` variables

### Constructor options

```typescript
const client = new CamundaClient({
  // Required
  baseUrl: "https://your-cluster.camunda.io/v2",

  // Authentication (pick one)
  auth: { type: "bearer", token: "..." },
  // auth: { type: "oauth2", clientId: "...", clientSecret: "...", tokenUrl: "..." },
  // auth: { type: "basic", username: "...", password: "..." },
  // auth: { type: "none" },

  // Optional: path to a YAML config file
  configFile: "/etc/myapp/camunda.yaml",

  // Optional: request timeout in ms (default: 30_000)
  timeout: 10_000,

  // Optional: automatic retries
  retry: {
    maxAttempts: 3,       // default: 3
    initialDelay: 100,    // ms, default: 100
    maxDelay: 30_000,     // ms cap, default: 30_000
    backoffFactor: 2,     // default: 2
    retryOn: [429, 500, 502, 503, 504], // default
  },

  // Optional: response caching for search/read endpoints
  cache: {
    enabled: true,
    ttl: 30_000,   // ms, default: 30_000
    maxSize: 500,  // max entries, default: 500
  },

  // Optional: logging
  logger: {
    level: "info", // "debug" | "info" | "warn" | "error" | "none"
    sink: (level, message, data) => myLogger[level](message, data), // custom sink
  },
});
```

### Config file (YAML)

Point to a YAML file via the constructor or env var:

```bash
CAMUNDA_CONFIG_FILE=/etc/myapp/camunda.yaml node app.js
```

```yaml
# camunda.yaml — validated by camunda-config.schema.json
baseUrl: https://bru-2.connectors.camunda.io/your-cluster-id/v2
auth:
  type: oauth2
  clientId: my-client
  clientSecret: my-secret
  tokenUrl: https://login.cloud.camunda.io/oauth/token
  tokenCache:
    filePath: /var/cache/myapp/token-cache.json
retry:
  maxAttempts: 3
  retryOn: [429, 500, 502, 503, 504]
cache:
  enabled: true
  ttl: 30000
logger:
  level: info
timeout: 10000
```

The schema file `camunda-config.schema.json` ships with the package and can be used with editors that support JSON Schema (e.g. VS Code with the YAML extension):

```yaml
# yaml-language-server: $schema=./node_modules/@bpmn-sdk/api/camunda-config.schema.json
```

**Tip:** Split non-sensitive config (type, tokenUrl) into the config file and inject secrets via env vars — auth fields from the same `type` are merged across sources.

### Environment variables

| Variable | Description |
|---|---|
| `CAMUNDA_BASE_URL` | API base URL |
| `CAMUNDA_CONFIG_FILE` | Path to YAML config file |
| `CAMUNDA_TIMEOUT` | Request timeout in ms |
| `CAMUNDA_AUTH_TYPE` | `bearer` \| `oauth2` \| `basic` \| `none` |
| `CAMUNDA_AUTH_TOKEN` | Bearer token (type=bearer) |
| `CAMUNDA_AUTH_CLIENT_ID` | OAuth2 client ID |
| `CAMUNDA_AUTH_CLIENT_SECRET` | OAuth2 client secret |
| `CAMUNDA_AUTH_TOKEN_URL` | OAuth2 token endpoint URL |
| `CAMUNDA_AUTH_SCOPE` | OAuth2 scopes (space-separated) |
| `CAMUNDA_AUTH_USERNAME` | Basic auth username |
| `CAMUNDA_AUTH_PASSWORD` | Basic auth password |
| `CAMUNDA_TOKEN_CACHE_DISABLED` | `true`/`1` to disable token file cache |
| `CAMUNDA_TOKEN_CACHE_FILE` | Custom path for the token cache file |
| `CAMUNDA_RETRY_MAX_ATTEMPTS` | Max retry attempts |
| `CAMUNDA_RETRY_INITIAL_DELAY` | Initial retry delay in ms |
| `CAMUNDA_RETRY_MAX_DELAY` | Max retry delay in ms |
| `CAMUNDA_RETRY_BACKOFF_FACTOR` | Backoff multiplier |
| `CAMUNDA_RETRY_ON` | Comma-separated status codes, e.g. `429,500,503` |
| `CAMUNDA_CACHE_ENABLED` | `true`/`1` to enable response cache |
| `CAMUNDA_CACHE_TTL` | Cache TTL in ms |
| `CAMUNDA_CACHE_MAX_SIZE` | Max cache entries |
| `CAMUNDA_LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` \| `none` |

## Authentication

### Bearer token (self-managed / development)

```typescript
const client = new CamundaClient({
  baseUrl: "http://localhost:8080/v2",
  auth: { type: "bearer", token: "eyJhbGci..." },
});
```

### OAuth2 client credentials (Camunda SaaS / production)

The SDK fetches the access token automatically and caches it both in-memory and on disk (OS config directory by default). When a 401 is received, the token is refreshed once and the request is retried.

```typescript
const client = new CamundaClient({
  baseUrl: "https://bru-2.connectors.camunda.io/your-cluster-id/v2",
  auth: {
    type: "oauth2",
    clientId: process.env.CAMUNDA_CLIENT_ID!,
    clientSecret: process.env.CAMUNDA_CLIENT_SECRET!,
    tokenUrl: "https://login.cloud.camunda.io/oauth/token",
    scope: "api", // optional
  },
});
```

**Token cache** — tokens survive process restarts by default. Customize or disable:

```typescript
auth: {
  type: "oauth2",
  // ...
  tokenCache: {
    // Custom file location (default: OS config dir / camunda-api / token-cache.json)
    filePath: "/var/cache/myapp/camunda-token.json",

    // Disable persistent cache entirely
    // disabled: true,

    // Or bring your own store (Redis, DB, etc.)
    // store: {
    //   async get(key) { return redis.get(key).then(JSON.parse); },
    //   async set(key, token) { await redis.set(key, JSON.stringify(token)); },
    // },
  },
},
```

Default cache file locations:
- **Linux:** `$XDG_CONFIG_HOME/camunda-api/token-cache.json` (or `~/.config/...`)
- **macOS:** `~/Library/Application Support/camunda-api/token-cache.json`
- **Windows:** `%APPDATA%\camunda-api\token-cache.json`

## Examples

### Process instances

```typescript
// Search active instances of a specific process
const { items } = await client.processInstance.search({
  filter: {
    state: "ACTIVE",
    processDefinitionId: "order-process",
  },
  page: { limit: 50 },
});

// Start a new instance
const { processInstanceKey } = await client.processInstance.createProcessInstance({
  processDefinitionId: "order-process",
  variables: { orderId: "ord-123", amount: 99.99 },
});

// Get a specific instance
const instance = await client.processInstance.getProcessInstance(processInstanceKey);
console.log(instance.state); // "ACTIVE" | "COMPLETED" | "TERMINATED"

// Cancel a running instance
await client.processInstance.cancelProcessInstance(processInstanceKey, {
  operationReference: 42n,
});

// Migrate to a newer version of the process
await client.processInstance.migrateProcessInstance(processInstanceKey, {
  migrationPlan: {
    targetProcessDefinitionKey: "9876543210",
    mappingInstructions: [
      { sourceElementId: "task-v1", targetElementId: "task-v2" },
    ],
  },
});
```

### Jobs

```typescript
// Activate and process jobs (worker pattern)
const { jobs } = await client.job.activateJobs({
  type: "send-email",
  worker: "email-worker",
  timeout: 60_000,
  maxJobsToActivate: 10,
  fetchVariable: ["recipient", "subject", "body"],
});

for (const job of jobs) {
  try {
    await sendEmail(job.variables);
    await client.job.completeJob(job.key, {
      variables: { emailSent: true, sentAt: new Date().toISOString() },
    });
  } catch (err) {
    await client.job.failJob(job.key, {
      retries: job.retries - 1,
      errorMessage: String(err),
      retryBackOff: 5_000,
    });
  }
}

// Report a BPMN business error (triggers error boundary events)
await client.job.throwJobError(job.key, {
  errorCode: "PAYMENT_FAILED",
  errorMessage: "Card declined",
});
```

### User tasks

```typescript
// Search for unassigned tasks in a specific process
const { items: tasks } = await client.userTask.searchUserTasks({
  filter: {
    assignee: null,
    processDefinitionId: "approval-process",
  },
});

// Assign a task to a user
await client.userTask.assignUserTask(tasks[0].userTaskKey, {
  assignee: "alice@example.com",
});

// Complete a task with variables
await client.userTask.completeUserTask(tasks[0].userTaskKey, {
  variables: { approved: true, reviewNote: "Looks good" },
});

// Get the form schema for a task
const form = await client.userTask.getUserTaskForm(tasks[0].userTaskKey);
```

### Decisions

```typescript
// Evaluate a DMN decision
const result = await client.decisionDefinition.evaluateDecision({
  decisionDefinitionId: "loan-approval",
  variables: { amount: 50_000, creditScore: 720 },
});

// Search decision instances
const { items } = await client.decisionInstance.searchDecisionInstances({
  filter: { decisionDefinitionId: "loan-approval", state: "EVALUATED" },
  page: { limit: 100 },
});
```

### Deployments

```typescript
import { readFile } from "node:fs/promises";

// Deploy a process definition
const bpmnXml = await readFile("order-process.bpmn", "utf8");
const deployment = await client.resource.deployResources({
  resources: [
    {
      name: "order-process.bpmn",
      content: Buffer.from(bpmnXml).toString("base64"),
    },
  ],
  tenantId: "<default>",
});

console.log(deployment.deployments);
```

### Messages and signals

```typescript
// Publish a message to correlate with a catch event
await client.message.publishMessage({
  name: "payment-received",
  correlationKey: "ord-123",
  variables: { paymentMethod: "card", amount: 99.99 },
  timeToLive: 60_000, // ms until the message expires if uncorrelated
});

// Broadcast a signal
await client.signal.broadcastSignal({
  signalName: "system-alert",
  variables: { severity: "HIGH" },
});
```

### Incidents

```typescript
// Search open incidents
const { items: incidents } = await client.incident.searchIncidents({
  filter: { state: "ACTIVE", processDefinitionId: "order-process" },
});

// Resolve an incident after fixing the underlying issue
for (const incident of incidents) {
  await client.incident.resolveIncident(incident.incidentKey);
}
```

### Variables

```typescript
// Search variables for a process instance
const { items: vars } = await client.variable.searchVariables({
  filter: { processInstanceKey: "123456789" },
});

// Get a single variable
const variable = await client.variable.getVariable("987654321");
console.log(variable.name, variable.value);
```

### User and role management

```typescript
// Create a user
await client.user.createUser({
  username: "jdoe",
  name: "Jane Doe",
  email: "jdoe@example.com",
  password: "s3cr3t!",
});

// Assign a role
await client.role.assignRoleToUser("admin-role-id", "jdoe");

// Search users in a group
const { items: members } = await client.group.searchUsersForGroup("my-group-id");
```

## Events

The client emits typed events you can subscribe to for observability, metrics, or debugging.

```typescript
// Log all outgoing requests
client.on("request", ({ method, url }) => {
  console.log(`→ ${method} ${url}`);
});

// Track response times
client.on("response", ({ method, url, status, durationMs, cached }) => {
  metrics.histogram("api.latency", durationMs, { method, status: String(status) });
  if (cached) metrics.increment("api.cache.hit");
});

// Alert on errors
client.on("error", ({ method, url, error }) => {
  console.error(`✗ ${method} ${url}`, error.message);
});

// Monitor retries
client.on("retry", ({ attempt, maxAttempts, delayMs, reason }) => {
  console.warn(`Retry ${attempt}/${maxAttempts} in ${delayMs}ms — ${reason}`);
});

// Track OAuth2 token refreshes
client.on("tokenRefresh", ({ tokenUrl }) => {
  console.debug(`Refreshing token from ${tokenUrl}`);
});

// Remove a listener
const handler = (e: ResponseEvent) => { /* ... */ };
client.on("response", handler);
client.off("response", handler);

// One-time listener
client.once("tokenRefresh", () => console.log("First token fetched"));
```

## Error handling

All errors extend `CamundaError`. HTTP errors carry `status`, `body`, and `url`.

```typescript
import {
  CamundaNotFoundError,
  CamundaValidationError,
  CamundaRateLimitError,
  CamundaAuthError,
  CamundaServerError,
  CamundaNetworkError,
  CamundaTimeoutError,
} from "@bpmn-sdk/api";

try {
  const instance = await client.processInstance.getProcessInstance("bad-key");
} catch (err) {
  if (err instanceof CamundaNotFoundError) {
    console.log("Process instance not found:", err.status, err.url);
  } else if (err instanceof CamundaValidationError) {
    console.log("Bad request:", err.body);
  } else if (err instanceof CamundaRateLimitError) {
    console.log("Rate limited, retry after:", err.retryAfter, "s");
  } else if (err instanceof CamundaAuthError) {
    console.log("Authentication failed — check your credentials");
  } else if (err instanceof CamundaServerError) {
    console.log("Server error:", err.status);
  } else if (err instanceof CamundaTimeoutError) {
    console.log("Request timed out");
  } else if (err instanceof CamundaNetworkError) {
    console.log("Network failure:", err.message);
  }
}
```

### Error hierarchy

```
CamundaError
├── CamundaHttpError          (non-2xx response)
│   ├── CamundaValidationError   400
│   ├── CamundaAuthError         401
│   ├── CamundaForbiddenError    403
│   ├── CamundaNotFoundError     404
│   ├── CamundaConflictError     409
│   ├── CamundaRateLimitError    429  (.retryAfter?: number)
│   └── CamundaServerError       5xx
└── CamundaNetworkError       (no response received)
    └── CamundaTimeoutError   (request exceeded timeout)
```

## Caching

Search and read endpoints marked `x-eventually-consistent` in the OpenAPI spec are automatically eligible for caching. Enable it globally via config:

```typescript
const client = new CamundaClient({
  baseUrl: "...",
  auth: { type: "bearer", token: "..." },
  cache: { enabled: true, ttl: 10_000 }, // 10 s TTL
});

// Manually clear the cache (e.g. after a write)
client.clearCache();
```

## Regenerating from the latest OpenAPI spec

The SDK source is generated from the [Camunda GitHub repository](https://github.com/camunda/camunda). To pull the latest specs and regenerate:

```bash
pnpm --filter @bpmn-sdk/api generate
```

The generator (`scripts/generate.mjs`) is pure Node.js ESM with no dependencies. It:

1. Downloads all 42 OpenAPI YAML files to `swagger/`
2. Parses YAML with a built-in parser (no `js-yaml`)
3. Resolves all cross-file `$ref` pointers
4. Writes `src/generated/types.ts` — TypeScript interfaces for every schema
5. Writes `src/generated/resources.ts` — typed resource classes and `CamundaClient`

## Resource reference

| Property | Tag | Example methods |
|---|---|---|
| `client.auditLog` | Audit Log | `searchAuditLogs`, `getAuditLog` |
| `client.authentication` | Authentication | `getAuthentication` |
| `client.authorization` | Authorization | `createAuthorization`, `searchAuthorizations`, `deleteAuthorization` |
| `client.batchOperation` | Batch operation | `searchBatchOperations`, `getBatchOperation`, `cancelBatchOperation` |
| `client.clock` | Clock | `pinClock`, `resetClock` |
| `client.decisionDefinition` | Decision definition | `searchDecisionDefinitions`, `getDecisionDefinition`, `evaluateDecision` |
| `client.decisionInstance` | Decision instance | `searchDecisionInstances`, `getDecisionInstance` |
| `client.decisionRequirements` | Decision requirements | `searchDecisionRequirements`, `getDecisionRequirements` |
| `client.deployment` | Deployment | — (use `client.resource.deployResources`) |
| `client.document` | Document | `createDocument`, `getDocument`, `deleteDocument` |
| `client.elementInstance` | Element instance | `searchElementInstances`, `getElementInstance` |
| `client.group` | Group | `createGroup`, `searchGroups`, `assignUserToGroup`, `searchUsersForGroup` |
| `client.incident` | Incident | `searchIncidents`, `getIncident`, `resolveIncident` |
| `client.job` | Job | `activateJobs`, `completeJob`, `failJob`, `throwJobError`, `updateJob` |
| `client.license` | License | `getLicenseStatus` |
| `client.mappingRule` | Mapping rule | `createMappingRule`, `searchMappingRules`, `deleteMappingRule` |
| `client.message` | Message | `publishMessage`, `correlateMessage` |
| `client.processDefinition` | Process definition | `searchProcessDefinitions`, `getProcessDefinition`, `getProcessDefinitionXml` |
| `client.processInstance` | Process instance | `createProcessInstance`, `searchProcessInstances`, `cancelProcessInstance`, `migrateProcessInstance` |
| `client.resource` | Resource | `deployResources`, `deleteResource` |
| `client.role` | Role | `createRole`, `searchRoles`, `assignRoleToUser`, `assignRoleToClient` |
| `client.signal` | Signal | `broadcastSignal` |
| `client.system` | System | `getTopology` |
| `client.tenant` | Tenant | `createTenant`, `searchTenants`, `assignUserToTenant` |
| `client.user` | User | `createUser`, `searchUsers`, `deleteUser`, `changeUserPassword` |
| `client.userTask` | User task | `searchUserTasks`, `assignUserTask`, `completeUserTask`, `getUserTaskForm` |
| `client.variable` | Variable | `searchVariables`, `getVariable`, `updateVariable` |
