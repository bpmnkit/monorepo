<div align="center">
  <img src="https://raw.githubusercontent.com/bpmnkit/monorepo/main/doc/logos/logo-2-gateway.svg" width="72" height="72" alt="BPMN Kit logo">
  <h1>@bpmnkit/profiles</h1>
  <p>Shared auth, profile storage, and client factories for the BPMN Kit CLI and proxy server</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/profiles?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/profiles)
  [![license](https://img.shields.io/npm/l/@bpmnkit/profiles?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/profiles/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/profiles` is the shared layer that connects the `casen` CLI with the local proxy server. It handles profile CRUD (read/write to `~/.config/casen/config.json`), creates typed `CamundaClient` instances from stored profiles, and resolves Authorization headers for any supported auth type.

You do not need this package if you are connecting directly to Camunda using `@bpmnkit/api`. It is intended for tooling that needs to share authentication state with the CLI.

## Features

- **Profile CRUD** — list, get, save, delete, and activate named profiles stored in `~/.config/casen/config.json`
- **Client factory** — `createClientFromProfile(name?)` creates a ready-to-use `CamundaClient` from the active or named profile
- **Auth header resolution** — `getAuthHeader(config)` returns the correct `Authorization` header string for Bearer, Basic, and OAuth2 auth types
- **OAuth2 token caching** — tokens are cached in memory and refreshed 60 seconds before expiry; no extra files written
- **XDG-aware** — profile file path resolves to the correct platform directory (Linux XDG, macOS, Windows AppData)
- **Zero UI dependencies** — no TUI or CLI dependencies; plain Node.js

## Installation

```sh
npm install @bpmnkit/profiles
```

## Quick Start

### Create a `CamundaClient` from the active profile

```typescript
import { createClientFromProfile } from "@bpmnkit/profiles"

// Uses the currently active profile from ~/.config/casen/config.json
const client = createClientFromProfile()

const instances = await client.processInstance.searchProcessInstances({})
console.log(instances.page.totalItems)
```

### Use a named profile

```typescript
const client = createClientFromProfile("production")
```

### Resolve an auth header directly

```typescript
import { getActiveProfile, getAuthHeader } from "@bpmnkit/profiles"

const profile = getActiveProfile()
if (profile) {
  const header = await getAuthHeader(profile.config)
  // "Bearer eyJ..." or "Basic dXNlcjpwYXNz" or ""
}
```

### Manage profiles programmatically

```typescript
import { listProfiles, saveProfile, useProfile, deleteProfile } from "@bpmnkit/profiles"

// List all profiles
const profiles = listProfiles()

// Save a new profile
saveProfile({
  name: "local",
  apiType: "self-managed",
  config: {
    baseUrl: "http://localhost:8080/v2",
    auth: { type: "basic", username: "admin", password: "admin" },
  },
})

// Activate a profile
useProfile("local")

// Delete a profile
deleteProfile("old-profile")
```

## API Reference

### Profile Management

| Export | Description |
|--------|-------------|
| `listProfiles()` | Returns all stored profiles |
| `getProfile(name)` | Returns a profile by name, or `undefined` |
| `getActiveProfile()` | Returns the currently active profile |
| `getActiveName()` | Returns the active profile name |
| `saveProfile(profile)` | Create or update a profile |
| `deleteProfile(name)` | Remove a profile |
| `useProfile(name)` | Set the active profile |
| `getConfigFilePath()` | Returns the full path to the config file |

### Client Factories

| Export | Description |
|--------|-------------|
| `createClientFromProfile(name?)` | `CamundaClient` from the active or named profile |
| `createAdminClientFromProfile(name?)` | `AdminApiClient` from the active or named profile |

### Auth

| Export | Description |
|--------|-------------|
| `getAuthHeader(config)` | Resolves an `Authorization` header string for any auth type |

---

## Related Packages

| Package | Description |
|---------|-------------|
| [`@bpmnkit/core`](https://www.npmjs.com/package/@bpmnkit/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmnkit/canvas`](https://www.npmjs.com/package/@bpmnkit/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmnkit/editor`](https://www.npmjs.com/package/@bpmnkit/editor) | Full-featured interactive BPMN editor |
| [`@bpmnkit/engine`](https://www.npmjs.com/package/@bpmnkit/engine) | Lightweight BPMN process execution engine |
| [`@bpmnkit/feel`](https://www.npmjs.com/package/@bpmnkit/feel) | FEEL expression language parser & evaluator |
| [`@bpmnkit/plugins`](https://www.npmjs.com/package/@bpmnkit/plugins) | 22 composable canvas plugins |
| [`@bpmnkit/api`](https://www.npmjs.com/package/@bpmnkit/api) | Camunda 8 REST API TypeScript client |
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/ui`](https://www.npmjs.com/package/@bpmnkit/ui) | Shared design tokens and UI components |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit
