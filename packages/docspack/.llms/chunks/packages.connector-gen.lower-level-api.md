# @bpmnkit/connector-gen — Lower-level API

All internals are exported if you need fine-grained control:

```typescript
import {
  parseOpenApi,       // parse YAML or JSON string → OpenApiDoc
  getOperations,      // enumerate all operations with resolved params and schemas
  detectDefaultAuth,  // infer AuthHint from components.securitySchemes
  buildTemplate,      // build one ConnectorTemplate from one OperationWithMeta
  buildTemplates,     // build all templates from all operations
  writeTemplates,     // write ConnectorTemplate[] to disk
} from "@bpmnkit/connector-gen"

const doc = parseOpenApi(specText)
const auth = detectDefaultAuth(doc)           // "bearer" | "apiKey" | ...
const ops = getOperations(doc, "createUser")  // filter regex optional

const templates = buildTemplates(ops, {
  idPrefix: "com.myorg",
  defaultAuthType: auth,
})

await writeTemplates(templates, {
  outputDir: "./out",
  format: "array",  // all in one file
})
```

---
Source: https://docs.bpmnkit.com/packages/connector-gen/
