# casen connector — All flags

| Flag | Description |
|---|---|
| `--swagger <file>` | Path to a local OpenAPI/Swagger YAML or JSON file |
| `--api <id>` | Catalog entry ID — downloads the spec automatically |
| `--output <dir>` | Directory to write `.json` template files into |
| `--base-url <url>` | Override the base URL from the spec |
| `--id-prefix <prefix>` | Reverse-DNS prefix for template IDs (e.g. `com.myorg`) |
| `--filter <regex>` | Filter operations by `operationId` or summary |
| `--expand-body` | Decompose top-level request body properties into individual input fields |
| `--auth <type>` | Pre-select auth type (see below) |
| `--format <fmt>` | `one-per-op` (default) or `array` — all templates in one file |
| `--dry-run` | Print generated templates to stdout instead of writing files |

### Auth types

| Value | Description |
|---|---|
| `noAuth` | No authentication fields |
| `apiKey` | Single API key field sent as a header |
| `basic` | Username + password (HTTP Basic) |
| `bearer` | Bearer token |
| `oauth-client-credentials-flow` | Client ID, secret, token URL, and scopes |

Auth is auto-detected from `components.securitySchemes` in the spec. Use `--auth` to override.

---
Source: https://docs.bpmnkit.com/cli/connector/
