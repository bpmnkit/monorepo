---
title: "@bpmnkit/operate"
description: Lightweight monitoring and operations UI for Camunda 8 dev clusters, Camunda 8 Run and SaaS trials.
sidebar:
  order: 10
---

`@bpmnkit/operate` is a small, Operate-like web UI for a Camunda 8 cluster. Mount it in
any element to get a dashboard and lists of process definitions, decisions, process
instances, incidents, jobs and user tasks, with detail pages that draw the BPMN diagram.
It is built for development clusters, [Camunda 8 Run](https://docs.camunda.io/docs/self-managed/quickstart/developer-quickstart/c8run/)
and SaaS trial clusters. It is not a replacement for Camunda Operate in production.

The UI does not call the cluster itself. It talks to the BPMN Kit proxy
(`@bpmnkit/proxy`, started with `casen proxy start`). The proxy holds your connection
profiles and credentials, and adds the auth header to each Camunda request.

```
browser (Operate)  ──fetch──▶  BPMN Kit proxy :3033  ──REST + auth──▶  Orchestration Cluster API /v2
```

## What it does, and what it does not do

Compared with [Camunda Operate](https://docs.camunda.io/docs/components/operate/operate-introduction/):

| | `@bpmnkit/operate` | Camunda Operate |
|---|---|---|
| Dashboard counts (active instances, open incidents, active jobs, pending tasks, definitions) | Yes | Yes |
| Process definitions and versions, with the diagram | Yes | Yes |
| Decision definitions, with the DMN table | Yes | Yes |
| Process instance list, filter by state and root process | Yes, client side | Yes, server side |
| Instance diagram with active and completed elements | Yes | Yes |
| Instance variables (read) | Yes | Yes |
| Edit variables | No | Yes |
| Cancel one process instance | Yes | Yes |
| Start a process instance (with business ID and variables) | Yes | No |
| Incidents: retry job (sets retries to 3), resolve incident | Yes | Yes |
| Jobs list | Yes | No |
| User tasks list and form preview | Yes (read only) | No (Tasklist) |
| Publish / correlate a message, broadcast a signal | Yes | No |
| AI incident analysis and natural-language search | Yes, if the proxy has an AI CLI | No |
| Process instance modification and migration | No | Yes |
| Batch operations (cancel, resolve, migrate, modify, delete) | No | Yes |
| Decision instance history | No | Yes |
| Deleting instances | No | Yes |
| Large result sets | No: each list loads at most 1000 items | Yes |
| Users, roles, authorizations, multi-tenancy UI | No: whatever the proxy profile may do | Yes |
| Real-time push | No: the browser polls (30 s by default) | Periodic refresh |

Use it to look at what your process is doing while you build it. Use Camunda Operate
when you need history, bulk operations or access control.

## Installation

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

## Connection, CORS and security notes

- **The browser never sees Camunda credentials.** They stay in the proxy's profile
  store. Operate sends only the profile name (`?profile=` on the monitoring poll and the
  `x-profile` header on API calls).
- **CORS.** The proxy answers only allowed origins: bpmnkit.com, Studio, the desktop app,
  and any `localhost`, `127.0.0.1` or `[::1]` origin on any port (for example a Vite dev
  server on `:5173`). It sends that origin back in `Access-Control-Allow-Origin`, never
  `*`. A page on any other origin gets `403`. To embed Operate in an app on another
  origin, start the proxy with `casen proxy start --allow-origin https://your.app`. You do
  not need to configure CORS on the cluster, because the browser does not call it.
- **Same-origin reverse proxy.** `proxyUrl` can be relative. If your dev server forwards
  `/bpmnkit-proxy/*` to `http://localhost:3033/*`, use `proxyUrl: "/bpmnkit-proxy"`. Keep
  the forwarded `Host` header a loopback name (the default for the Vite proxy), or allow
  your host name with `--allow-host`.
- **Keep the proxy on a trusted machine.** It acts with the stored credentials for any
  caller it lets in. By default it listens only on loopback; `--host` exposes it to the
  network. See [Local proxy](/docs/cli/casen#local-proxy).
- **Errors.** When a poll fails, Operate shows the reason above the view, for example
  `HTTP 401: No active profile` (no profile with a base URL) or
  `Connection error. Retrying…` (the proxy is not running). The last good data stays on
  screen, and the message goes away after the next good poll.

## API reference

### `createOperate(options): OperateApi`

```typescript
interface OperateOptions {
  container: HTMLElement
  proxyUrl?: string        // default "http://localhost:3033"; may be relative
  profile?: string         // default: the proxy's active profile
  theme?: "light" | "dark" | "auto" | "neon"  // default "light"
  pollInterval?: number    // ms; default 30 000, minimum 5 000, 0 = load once, no refresh
  mock?: boolean           // fixture data, no network; default false
  onOpenInEditor?: (xml: string, name: string) => void  // shows "Open in Editor" on diagrams
}

interface OperateApi {
  readonly el: HTMLElement              // the root element appended to container
  setProfile(name: string | null): void // null = the proxy's active profile; reloads the view
  setTheme(theme: Theme): void          // also re-themes an open diagram
  navigate(path: string): void          // e.g. "/instances/2251799813690001"
  destroy(): void                       // stops polling and removes the UI
}
```

A theme the user picked in the header is saved in `localStorage` and takes precedence
over `options.theme` on the next load.

The package also exports the Camunda result types it displays (`ProcessInstanceResult`,
`IncidentResult`, `JobSearchResult`, `UserTaskResult`, `VariableResult`,
`ProcessDefinitionResult`), `ProfileInfo` (the shape of the proxy's `GET /profiles`) and
`DashboardData` (the dashboard poll payload).

`createInstanceDetailView`, `createDefinitionDetailView`, `createDecisionDetailView`,
`InstancesStore`, `DefinitionsStore` and `DecisionsStore` are also exported. They are
marked `@internal`: BPMN Kit Studio uses them, and they can change in any release.

### Routes

Operate uses hash routes, so it works from any static host:

| Route | View |
|---|---|
| `#/` | Dashboard |
| `#/definitions`, `#/definitions/:key` | Process definitions, definition detail |
| `#/decisions`, `#/decisions/:key` | Decision definitions, decision detail |
| `#/instances`, `#/instances/:key` | Process instances, instance detail |
| `#/incidents`, `#/incidents/:key` | Incidents, incident detail |
| `#/jobs` | Jobs |
| `#/tasks`, `#/tasks/:key` | User tasks, task detail |
| `#/messages` | Message and signal actions, active message subscriptions |
| `#/search` | Instance and variable search |

## Limits

- Each list asks the proxy for at most 1000 items, newest first. Search, sort and
  paging in the tables happen in the browser, over those items.
- The instance detail loads the first page of variables and element instances that
  the search endpoints return. A very large instance can show an incomplete list.
- The browser polls. Each poll is one request to the proxy, which makes one or more
  search requests to the cluster, so keep `pollInterval` high for shared clusters.
