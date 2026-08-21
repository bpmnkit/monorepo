# casen Plugin Authoring — Writing commands

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

---
Source: https://docs.bpmnkit.com/cli/plugin-authoring/
