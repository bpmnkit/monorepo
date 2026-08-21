---
title: "Building a Camunda 8 connector from an OpenAPI spec"
description: "Generate a Camunda 8 element template — ready to apply to a BPMN service task — directly from an OpenAPI/Swagger spec with @bpmnkit/connector-gen."
pubDate: 2026-07-06
author: "BPMN Kit"
tags: ["connectors", "camunda", "openapi"]
---

BPMN Kit ships [116 pre-built Camunda 8 connectors](/connectors) for common services,
but internal APIs and less common third-party services won't be in that catalog. If the
API has an OpenAPI (Swagger) spec, `@bpmnkit/connector-gen` can generate a Camunda 8
connector element template from it directly — no manual property-by-property template
authoring.

## Generating from a spec

```typescript
import { generateFromUrl } from "@bpmnkit/connector-gen";

const { templates } = await generateFromUrl(
  "https://api.example.com/openapi.json",
  {
    idPrefix: "com.mycompany",   // reverse-DNS prefix for generated template IDs
    filter: "^(createOrder|getOrder|cancelOrder)$", // only these operationIds
  },
);

// `templates` is an array of Camunda 8 element templates — one per matched operation
```

Each generated template becomes a selectable connector in a BPMN editor's palette, with
typed input fields derived from the OpenAPI spec's request schema — path/query
parameters, headers, and request body fields all become configurable properties on the
resulting service task, the same way a hand-authored Camunda connector template would.

## Generating from a spec you already have locally

If the spec is a local file rather than a URL, `generate()` takes the spec text directly:

```typescript
import { readFileSync } from "node:fs";
import { generate } from "@bpmnkit/connector-gen";

const specText = readFileSync("./openapi.json", "utf-8");
const templates = generate(specText, { idPrefix: "com.mycompany" });
```

## Writing templates to disk

Both functions can write the generated templates as files instead of (or as well as)
returning them in memory — pass `outputDir`, and optionally `format: "one-per-op"` to
get one file per operation rather than a single array file:

```typescript
const { templates, files } = await generateFromUrl(specUrl, {
  idPrefix: "com.mycompany",
  outputDir: "./connector-templates",
  format: "one-per-op",
});
```

## Auth detection

`@bpmnkit/connector-gen` inspects the spec's `securitySchemes` and picks a sensible
default auth type (API key, Bearer, Basic, OAuth2 client credentials) automatically —
override it with `defaultAuthType` if the spec's security definitions don't match what
you actually want the generated template to expose.

## Applying a generated template to a process

Once generated, a template is applied the same way as any bundled connector — see
[applying connectors](/connectors) for the pattern using `applyConnectorTemplate()`
against the bundled catalog; a generated template plugs into the same
`applyElementTemplate()` call.

## Where to go next

- [Connector catalog](/connectors) — 116 pre-built templates, no generation needed
- [Camunda 8 CI automation](/use-cases/camunda-8-automation)
- [`@bpmnkit/connector-gen` package reference](https://docs.bpmnkit.com/packages/connector-gen/)
