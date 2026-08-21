# casen Plugin Authoring — What gets generated

```
casen-deploy/
├── package.json       # "casen-plugin" keyword pre-set; no manual step needed
├── tsconfig.json      # standalone, no monorepo dependency
├── .gitignore
└── src/
    └── index.ts       # CasenPlugin default export with an example command
```

### Generated `package.json`

```json
{
  "name": "casen-deploy",
  "version": "0.1.0",
  "description": "Git-tag-aware deploys for casen",
  "type": "module",
  "main": "dist/index.js",
  "keywords": ["casen-plugin"],
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "prepublishOnly": "tsc"
  },
  "devDependencies": {
    "@bpmnkit/cli-sdk": "latest",
    "typescript": "latest"
  }
}
```

The `"casen-plugin"` keyword is injected automatically — it is how `casen plugin search` discovers
your package on npm once published.

### Generated `src/index.ts`

```typescript
import type { CasenPlugin } from "@bpmnkit/cli-sdk"

const plugin: CasenPlugin = {
  id: "com.acme.casen-deploy",
  name: "Deploy",
  version: "0.1.0",
  groups: [
    {
      name: "deploy",
      description: "Deploy commands",
      commands: [
        {
          name: "hello",
          description: "Example command — replace with your own",
          async run(ctx) {
            ctx.output.ok("Hello from Deploy!")
          },
        },
      ],
    },
  ],
}

export default plugin
```

Replace the example command with your own logic. Add as many command groups and commands as needed.

---
Source: https://docs.bpmnkit.com/cli/plugin-authoring/
