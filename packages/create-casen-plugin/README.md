<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/create-casen-plugin</h1>
  <p>Scaffold a new casen CLI plugin in seconds</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/create-casen-plugin?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/create-casen-plugin)
  [![license](https://img.shields.io/npm/l/@bpmnkit/create-casen-plugin?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/create-casen-plugin/CHANGELOG.md)
</div>

---

## Overview

`create-casen-plugin` is the official scaffolding tool for `casen` CLI plugins. Run it with any package manager's `create` shorthand — no prior install required.

```sh
pnpm create @bpmnkit/casen-plugin
# or: npx @bpmnkit/create-casen-plugin
# or: bunx @bpmnkit/create-casen-plugin
```

## Interactive Flow

```
  create-casen-plugin — casen plugin scaffolding

  Plugin name (npm package name): casen-deploy
  Display name             (Deploy):
  Description              (): Git-tag-aware deploys for casen
  Author                   (): acme

  Initialize git repo? (Y/n): Y

  ✔ Created casen-deploy/
  ✔ package.json
  ✔ tsconfig.json
  ✔ src/index.ts
  ✔ git init

  Next steps:
    cd casen-deploy
    pnpm install
    pnpm build
    casen plugin install ./casen-deploy
```

## Non-Interactive Mode

```sh
pnpm create @bpmnkit/casen-plugin \
  --name casen-deploy \
  --display-name Deploy \
  --description "Git-tag-aware deploys for casen" \
  --author acme \
  --no-git
```

## Generated Files

### `package.json`

```json
{
  "name": "casen-deploy",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "keywords": ["casen-plugin"],
  "scripts": { "build": "tsc" },
  "devDependencies": {
    "@bpmnkit/cli-sdk": "latest",
    "typescript": "latest"
  }
}
```

### `src/index.ts`

```typescript
import type { CasenPlugin } from "@bpmnkit/cli-sdk"

const plugin: CasenPlugin = {
  id: "com.example.casen-deploy",
  name: "Deploy",
  version: "0.1.0",
  groups: [
    {
      name: "deploy",
      description: "Git-tag-aware deploys",
      commands: [
        {
          name: "release",
          description: "Tag and deploy the current process version",
          async run(ctx) {
            ctx.output.ok("TODO: implement release")
          },
        },
      ],
    },
  ],
}

export default plugin
```

## Plugin Discovery

All plugins with `"casen-plugin"` in their `keywords` appear in `casen plugin search`. The scaffold injects this keyword automatically.

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
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |
| [`@bpmnkit/cli-sdk`](https://www.npmjs.com/package/@bpmnkit/cli-sdk) | Plugin authoring SDK for the casen CLI |
| [`@bpmnkit/casen-report`](https://www.npmjs.com/package/@bpmnkit/casen-report) | HTML reports from Camunda 8 incident and SLA data |
| [`@bpmnkit/casen-worker-http`](https://www.npmjs.com/package/@bpmnkit/casen-worker-http) | Example HTTP worker plugin — completes jobs with live JSONPlaceholder API data |
| [`@bpmnkit/casen-worker-ai`](https://www.npmjs.com/package/@bpmnkit/casen-worker-ai) | AI task worker — classify, summarize, extract, and decide using Claude |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)

<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="32" height="32" alt="BPMN Kit"></a>
</div>
