# @bpmnkit/connector-gen — Installation

```sh
pnpm add @bpmnkit/connector-gen
```


## Quick start

```typescript
import { generate, writeTemplates } from "@bpmnkit/connector-gen"
import { readFileSync } from "node:fs"

const spec = readFileSync("openapi.yaml", "utf8")

const templates = generate(spec, {
  idPrefix: "com.myorg",
})

await writeTemplates(templates, { outputDir: "./templates" })
// Writes one .json file per operation into ./templates/
```


## Generating from a URL

```typescript
import { generateFromUrl } from "@bpmnkit/connector-gen"

const { templates, files } = await generateFromUrl(
  "https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml",
  {
    idPrefix: "com.myorg",
    outputDir: "./templates",
  }
)

console.log(`Wrote ${files.length} templates`)
```

---
Source: https://bpmnkit.com/docs/packages/connector-gen
