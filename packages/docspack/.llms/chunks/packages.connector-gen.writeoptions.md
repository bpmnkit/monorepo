# @bpmnkit/connector-gen — `WriteOptions`

| Option | Type | Description |
|---|---|---|
| `outputDir` | `string` | Directory to write `.json` files into |
| `format` | `"one-per-op" \| "array"` | One file per operation (default) or all in one array file |


## Auth blocks

Every generated template includes a full 5-type auth block with visibility conditions, so users can
switch auth method in Camunda Modeler without editing the file.

| `AuthHint` | Fields in the template |
|---|---|
| `noAuth` | No auth fields shown |
| `apiKey` | `API Key` String field (sent as a header) |
| `basic` | `Username` + `Password` fields (HTTP Basic) |
| `bearer` | `Bearer Token` String field |
| `oauth-client-credentials-flow` | `Client ID`, `Client Secret`, `Token URL`, `Scopes` |

Auth is auto-detected from `components.securitySchemes`. The detected or specified type is
pre-selected in the template dropdown.

---
Source: https://bpmnkit.com/docs/packages/connector-gen
