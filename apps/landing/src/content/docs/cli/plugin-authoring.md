---
title: casen Plugin Authoring
description: Build and publish plugins that extend the casen CLI with new command groups.
sidebar:
  order: 7
---

casen plugins are ordinary npm packages that export a `CasenPlugin` object. Once installed, their
commands appear in the main TUI and in shell tab-completion alongside the built-in ones.

## Scaffold a new plugin

The fastest way to start is with the official scaffolding tool:

```sh
pnpm create @bpmnkit/casen-plugin
# or: npx @bpmnkit/create-casen-plugin
# or: bunx @bpmnkit/create-casen-plugin
```

The tool runs interactively:

```
  @bpmnkit/create-casen-plugin — casen plugin scaffolding

  Plugin name (npm package name): casen-deploy
  Display name             (Deploy):
  Description              (): Git-tag-aware deploys for casen
  Author                   (): acme

  Initialize git repo? (Y/n): Y

  ✓ package.json
  ✓ tsconfig.json
  ✓ src/index.ts
  ✓ .gitignore
  ✓ git init

  Done! Created casen-deploy at ./casen-deploy
```

### Non-interactive mode

Pass flags to skip all prompts — useful in CI or cookiecutter scripts:

```sh
pnpm create @bpmnkit/casen-plugin \
  --name casen-deploy \
  --description "Git-tag-aware deploys for casen" \
  --author acme \
  --no-git
```

| Flag | Description |
|---|---|
| `--name` / `-n` | npm package name (first positional arg also works) |
| `--display-name` | Human-readable name shown in `casen plugin list` |
| `--description` / `-d` | One-line description |
| `--author` / `-a` | Author name or npm username |
| `--no-git` | Skip `git init` |

## What gets generated

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

## The `@bpmnkit/cli-sdk` SDK

Install the SDK as a devDependency in your plugin:

```sh
pnpm add -D @bpmnkit/cli-sdk
```

It exports all types you need — no runtime dependency on casen internals.

### `CasenPlugin`

The root export. Default-export one instance of this from `dist/index.js`:

```typescript
interface CasenPlugin {
  id: string          // reverse-domain ID, e.g. "com.acme.casen-deploy"
  name: string        // shown in "casen plugin list"
  version: string
  groups: CommandGroup[]
}
```

### `CommandGroup`

Maps to one top-level token in the CLI (`casen <group>`). The name must be unique across all
installed plugins and the casen core commands:

```typescript
interface CommandGroup {
  name: string        // kebab-case, e.g. "deploy"
  aliases?: string[]
  description: string
  commands: Command[]
}
```

### `Command`

A single executable action within a group (`casen <group> <command>`):

```typescript
interface Command {
  name: string
  aliases?: string[]
  description: string
  args?: ArgSpec[]
  flags?: FlagSpec[]
  examples?: Example[]
  run(ctx: RunContext): Promise<void>
}
```

### `RunContext`

Passed to every `run()` function. Use it to read arguments, write output, and access
authenticated Camunda clients:

```typescript
interface RunContext {
  positional: string[]          // positional args after <group> <command>
  flags: ParsedFlags            // { flagName: value }
  output: OutputWriter          // table / json / yaml renderer
  getClient(): Promise<unknown>       // Camunda C8 REST client
  getAdminClient(): Promise<unknown>  // Camunda Admin API client
}
```

### `OutputWriter`

Use `ctx.output` for all output so the `--output` flag (table / json / yaml) is respected:

```typescript
ctx.output.ok("Done.")                          // ✓ Done.
ctx.output.info("Deploying…")                   // → Deploying…
ctx.output.printList({ items }, columns)        // table of rows
ctx.output.printItem(singleObject)              // key-value pairs
ctx.output.print(anything)                      // raw, format-aware
```

## Writing commands

### Positional arguments

```typescript
{
  name: "release",
  description: "Tag and deploy the current process version",
  args: [
    { name: "process-id", description: "BPMN process ID", required: true },
    { name: "tag",        description: "Release tag, e.g. v1.2.0",   required: true },
  ],
  async run(ctx) {
    const processId = ctx.positional[0]
    const tag = ctx.positional[1]
    if (!processId || !tag) throw new Error("Missing required arguments")
    // ...
  },
}
```

### Flags

```typescript
{
  name: "release",
  flags: [
    {
      name: "dry-run",
      short: "n",
      description: "Show what would happen without making changes",
      type: "boolean",
      default: false,
    },
    {
      name: "env",
      description: "Target environment",
      type: "string",
      default: "production",
      enum: ["staging", "production"],
    },
  ],
  async run(ctx) {
    const dryRun = ctx.flags["dry-run"] === true
    const env = ctx.flags.env as string
    // ...
  },
}
```

### Calling the Camunda API

Cast `getClient()` to `CamundaClient` from `@bpmnkit/api` if you need full type coverage,
or access it generically via the unknown type:

```typescript
import type { CamundaClient } from "@bpmnkit/api"

async run(ctx) {
  const client = await ctx.getClient() as CamundaClient
  const { items } = await client.processDefinition.searchProcessDefinitions({})
  ctx.output.printList({ items }, [
    { key: "bpmnProcessId", header: "PROCESS ID" },
    { key: "name",          header: "NAME" },
    { key: "version",       header: "VER" },
  ])
},
```

### Throwing errors

Throw a plain `Error` for user-facing errors. casen catches it, prints `error: <message>` to
stderr, and exits with code 1:

```typescript
async run(ctx) {
  const name = ctx.positional[0]
  if (!name) throw new Error("Missing required argument: <name>")
  // ...
}
```

## Test locally

Build and install your plugin from the local directory:

```sh
cd casen-deploy
pnpm install
pnpm build

casen plugin install ./casen-deploy
```

Restart casen. Your commands appear under `casen deploy` (or whatever group name you chose).

To uninstall during development:

```sh
casen plugin remove casen-deploy
```

## Publish to npm

When you're ready to share:

```sh
cd casen-deploy
npm publish
```

The `prepublishOnly` script in the generated `package.json` runs `tsc` automatically before
publishing, so `dist/` is always up to date.

Because `"casen-plugin"` is in `keywords`, your package is immediately discoverable via:

```sh
casen plugin search deploy
```

## Plugin naming conventions

| Convention | Reason |
|---|---|
| Name packages `casen-<feature>` | Predictable, easy to search |
| Set `id` to a reverse-domain string | Avoids conflicts across organisations |
| Keep each group name unique | casen merges all groups into one flat namespace |
| Prefix group name with your org for internal plugins | e.g. `acme-deploy` avoids clashing with a published `casen-deploy` |
