# Plan: Swagger/OpenAPI → Camunda REST Connector Templates

## Background

Camunda connector templates are JSON files consumed by Camunda Modeler that pre-configure a `bpmn:ServiceTask` element. For REST calls, the standard job type is `io.camunda:http-json:1`. Each template wires together:

- **`zeebe:input`** bindings — variables passed into the connector (URL, method, headers, body, auth)
- **`zeebe:taskHeader`** bindings — static metadata consumed by the framework (result mapping, error handling, retries)
- **`zeebe:taskDefinition`** — the job type and retry count

A Swagger/OpenAPI 3.x file fully describes the information needed to generate one template per endpoint operation.

---

## Mapping: OpenAPI → Connector Template

| OpenAPI field | Connector template field |
|---|---|
| `info.title` | `name` (template display name) |
| `info.description` | `description` |
| `externalDocs.url` | `documentationRef` |
| `servers[0].url` | Base URL — either baked as `Hidden` default or shown as editable prefix |
| `operation.operationId` | Part of template `id` + display label |
| `operation.summary` | `description` on the template |
| `paths[path][method]` | Generates one template: method → Hidden, URL → Hidden with base+path |
| `operation.parameters` (query) | `queryParameters` FEEL map entries or per-param String properties |
| `operation.parameters` (header) | `headers` FEEL map entries |
| `operation.parameters` (path) | Interpolated into the URL value (e.g. `/processes/{key}` → `="https://host/processes/"+processKey`) |
| `requestBody.content["application/json"].schema` | `body` FEEL field; top-level properties can become individual zeebe:input fields |
| `components.securitySchemes` | Drives which `authentication.type` options are shown |
| `responses[200].content.schema` | Informs a default `resultExpression` suggestion |

---

## Generation Strategies

### Strategy A — One template per operation (recommended)

Each `paths[path][method]` → one `.json` file (or one element in an array file).

- `method` and full `url` are `Hidden` properties with fixed defaults
- Only path parameters, query parameters, and body fields are user-facing
- Best for teams that want modeler tasks to correspond 1-to-1 with known API calls

**Pros:** No free-form URL; less error-prone; discoverable in modeler picker
**Cons:** Many templates for large APIs; templates must be regenerated when the API changes

### Strategy B — One template per API (generic)

A single template with editable `method` (Dropdown) and `url` (String) fields.

- All the standard auth/header/body fields are present
- Useful as a "smart default" for the whole API

**Pros:** One file; adapts to any endpoint
**Cons:** Less validation; user must know the right URL and method

**Recommendation:** Implement Strategy A as the default. Strategy B can be an optional `--single` flag.

---

## Implementation Plan

### Phase 1 — Core types and parser (`packages/core` or new `packages/connector-gen`)

**1.1 OpenAPI type definitions**

Define minimal TypeScript types for OpenAPI 3.x structures needed:
- `OpenApiDoc`, `PathItem`, `Operation`, `Parameter`, `RequestBody`, `Schema`, `SecurityScheme`
- Only the fields actually used in generation (not a full OpenAPI implementation)
- Use a well-typed JSON parse (no runtime schema validation needed)

**1.2 OpenAPI reader**

```typescript
function parseOpenApi(json: string): OpenApiDoc
function resolveRef<T>(doc: OpenApiDoc, ref: string): T  // handle $ref resolution
function getOperations(doc: OpenApiDoc): OperationWithMeta[]
// OperationWithMeta = { path, method, operation, baseUrl }
```

**1.3 Connector template types**

Define TypeScript types for the connector template JSON schema:
- `ConnectorTemplate`, `PropertyDef`, `Binding`, `Condition`, `Group`
- Match exactly the `@camunda/zeebe-element-templates-json-schema` structure

### Phase 2 — Generator (`packages/connector-gen` or `apps/cli`)

**2.1 Per-operation template builder**

```typescript
function buildTemplate(op: OperationWithMeta, opts: GeneratorOptions): ConnectorTemplate
```

Steps inside `buildTemplate`:
1. Generate `id` from base ID + operationId (slugified)
2. Set `name` = operationId (or summary if no operationId)
3. Add standard groups: `endpoint`, `authentication`, `timeout`, `payload`, `output`, `errors`, `retries`
4. Add standard hidden fields: job type, elementTemplateId, elementTemplateVersion
5. Add method (`Hidden`, fixed value) + url (`Hidden`, value = baseUrl + path)
6. Expand path parameters → `zeebe:input` with FEEL expression wiring
7. Expand query parameters → individual `zeebe:input` String fields (grouped under `endpoint`), conditional on whether they are required/optional
8. If requestBody: add `body` field (FEEL Text) with `condition: method in [POST, PUT, PATCH]`
9. Optionally decompose top-level body properties into individual `zeebe:input` fields (optional feature flag `--expand-body`)
10. Add standard auth block (all auth types with conditions)
11. Add standard output/error/retry block
12. Return complete `ConnectorTemplate`

**2.2 File writer**

```typescript
function writeTemplates(templates: ConnectorTemplate[], opts: WriteOptions): void
// opts: outputDir, format ("one-per-op" | "array"), fileNameFn
```

### Phase 3 — CLI integration (`apps/cli`)

**3.1 New command group `connector`**

```
casen connector generate --swagger <file> [--output <dir>] [--base-url <url>]
                         [--id-prefix <prefix>] [--single] [--expand-body]
                         [--filter <regex>]  # filter operations by operationId
```

**3.2 Non-interactive (`--swagger` flag)**

Reads the file, calls the generator, writes `.json` files.

**3.3 Interactive TUI flow** (optional, Phase 4)

Walk through the Swagger file interactively:
- Show list of operations (filtered/searchable)
- Let user select which ones to generate
- Preview the resulting template JSON
- Confirm and write

### Phase 4 — Quality of life

- **`--dry-run`**: Print templates to stdout instead of writing files
- **`--watch`**: Re-generate when the swagger file changes (using `fs.watch`)
- **Auth detection**: Inspect `components.securitySchemes` and auto-configure authentication section
- **`$ref` resolution**: Support inline `$ref` in parameter schemas and requestBody
- **URL parameter hints**: When a path param maps to a known pattern (e.g. `{key}`, `{id}`), suggest a reasonable FEEL expression default
- **Result expression suggestions**: Inspect `responses[200]` schema and emit a commented-out `resultExpression` suggestion

---

## File Layout

```
packages/connector-gen/       ← new package
  src/
    types.ts                  ← OpenAPI + ConnectorTemplate TypeScript types
    parse-openapi.ts          ← OpenAPI reader + $ref resolver
    build-template.ts         ← per-operation template builder
    write-templates.ts        ← file writer
    index.ts                  ← public API: generateFromSwagger(file, opts)
  tests/
    build-template.test.ts
  package.json                ← @bpmn-sdk/connector-gen, runtime dep only
  tsconfig.json

apps/cli/src/commands/connector.ts  ← new CLI command group
```

`@bpmn-sdk/connector-gen` should have zero external runtime dependencies (OpenAPI is just JSON; template generation is pure data transformation).

---

## Example Output (single operation)

Input: `GET /process-instances/{processInstanceKey}`

```json
{
  "$schema": "https://unpkg.com/@camunda/zeebe-element-templates-json-schema/resources/schema.json",
  "name": "Get Process Instance",
  "id": "io.camunda.generated.getProcessInstance",
  "version": 1,
  "description": "Fetch a single process instance by key",
  "appliesTo": ["bpmn:Task"],
  "elementType": { "value": "bpmn:ServiceTask" },
  "groups": [
    { "id": "endpoint",   "label": "HTTP Endpoint" },
    { "id": "authentication", "label": "Authentication" },
    { "id": "timeout",    "label": "Timeout" },
    { "id": "output",     "label": "Output Mapping" },
    { "id": "errors",     "label": "Error Handling" },
    { "id": "retries",    "label": "Retries" }
  ],
  "properties": [
    { "type": "Hidden", "value": "io.camunda:http-json:1", "binding": { "type": "zeebe:taskDefinition", "property": "type" } },
    { "type": "Hidden", "value": "GET",  "binding": { "type": "zeebe:input", "name": "method" } },
    { "type": "Hidden", "value": "https://cluster.camunda.io/v2/process-instances/", "binding": { "type": "zeebe:input", "name": "url" } },
    {
      "id": "processInstanceKey",
      "label": "Process Instance Key",
      "type": "String",
      "feel": "optional",
      "group": "endpoint",
      "binding": { "type": "zeebe:input", "name": "processInstanceKey" },
      "constraints": { "notEmpty": true }
    },
    ... (auth block, timeout, output mapping, error handling, retries)
  ]
}
```

> Note: For path parameters the generated URL is split at the parameter boundary. The actual URL is composed in FEEL: `="https://cluster.camunda.io/v2/process-instances/"+processInstanceKey`. This requires `feel: "required"` on the `url` field when path params exist, or alternatively the path param gets appended in a separate `zeebe:input` and the connector framework joins them.

---

## Risks & Decisions

| Decision | Options | Recommendation |
|---|---|---|
| Path parameter URL | FEEL expression (`="base/"+param`) vs. separate `zeebe:input` | Use FEEL expression; requires `feel: "required"` on url field |
| Body decomposition | One `body` FEEL field vs. individual fields per property | Default to one FEEL field; `--expand-body` for individual fields |
| Auth options shown | All 5 types always vs. only schemes in securitySchemes | Show all by default; if `securitySchemes` present, pre-select the right type |
| Package location | `packages/connector-gen` vs. inline in `apps/cli` | Separate package so it can be imported by other tools |
| OpenAPI version | 3.x only vs. also 2.x (Swagger) | Start with 3.x; add 2.x adapter if requested |
