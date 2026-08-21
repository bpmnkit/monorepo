# @bpmnkit/connector-gen — Generating from the catalog

The built-in catalog provides spec URLs and auth defaults for 100 popular APIs:

```typescript
import { generateFromCatalog } from "@bpmnkit/connector-gen"

// Use catalog defaults
const { templates, files, entry } = await generateFromCatalog("stripe", {
  outputDir: "./templates",
})

// Override catalog defaults
await generateFromCatalog("github", {
  outputDir: "./templates",
  idPrefix: "com.myorg",
  defaultAuthType: "bearer",
  filter: "issues|pulls",
  expandBody: true,
})
```


## `GeneratorOptions`

| Option | Type | Description |
|---|---|---|
| `idPrefix` | `string` | Reverse-DNS prefix for template IDs, e.g. `"io.mycompany"` |
| `defaultAuthType` | `AuthHint` | Pre-select auth type; auto-detected from spec if omitted |
| `baseUrl` | `string` | Override the base URL from `servers[0].url` in the spec |
| `expandBody` | `boolean` | Decompose top-level body properties into individual typed fields |
| `filter` | `string` | Regex applied to `operationId` and `summary` to filter operations |

```typescript
type AuthHint =
  | "noAuth"
  | "apiKey"
  | "basic"
  | "bearer"
  | "oauth-client-credentials-flow"
```

---
Source: https://docs.bpmnkit.com/packages/connector-gen/
