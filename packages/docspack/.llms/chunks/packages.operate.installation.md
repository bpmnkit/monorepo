# @bpmnkit/operate — Installation

```sh
npm install @bpmnkit/operate
npm install -g @bpmnkit/cli   # provides `casen proxy start` and `casen profile`
```


## Quick start

### 1. Try it without a cluster

Mock mode uses built-in fixture data and makes no network calls:

```typescript
import { createOperate } from "@bpmnkit/operate"

createOperate({
  container: document.getElementById("app")!,
  mock: true,
})
```

Operate fills its container (`height: 100%`), so give the container a height.

### 2. Camunda 8 Run

Camunda 8 Run serves the Orchestration Cluster REST API at `http://localhost:8080/v2`,
with no authentication by default.

```sh
casen profile create c8run --base-url http://localhost:8080/v2 --auth-type none
casen profile use c8run
casen proxy start                 # http://localhost:3033
```

If you turned on Basic authentication in Camunda 8 Run's `application.yaml`, create the
profile with `--auth-type basic --username <user> --password <password>`.

### 3. Camunda SaaS (trial) cluster

SaaS requires an OAuth access token. Create client credentials for the cluster in the
Camunda Console and download the credentials file. Import it as a profile:

```sh
casen profile import saas ./camunda-credentials.sh   # reads ZEEBE_REST_ADDRESS, CAMUNDA_CLIENT_ID, …
casen profile use saas
casen proxy start
```

Or create it by hand. The base URL is the cluster's REST address plus `/v2`:

```sh
casen profile create saas \
  --base-url https://<region>.zeebe.camunda.io/<cluster-id>/v2 \
  --auth-type oauth2 --client-id <id> --client-secret <secret> \
  --token-url https://login.cloud.camunda.io/oauth/token --audience zeebe.camunda.io
```

The proxy gets and caches the token. The client needs permission for the operations you
use; otherwise Camunda answers `403 Forbidden`.

### 4. Mount Operate against the proxy

```typescript
import { createOperate } from "@bpmnkit/operate"

const operate = createOperate({
  container: document.getElementById("app")!,
  proxyUrl: "http://localhost:3033", // default
  profile: "c8run",                  // optional: the proxy's active profile if omitted
  pollInterval: 15_000,              // optional: default 30 000 ms, minimum 5 000, 0 = load once
})
```

The header has a profile selector with every profile the proxy knows. A change reloads
the current view against the new profile.

---
Source: https://bpmnkit.com/docs/packages/operate
