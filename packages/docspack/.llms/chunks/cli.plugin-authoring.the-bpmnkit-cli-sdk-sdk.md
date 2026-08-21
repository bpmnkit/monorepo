# casen Plugin Authoring — The `@bpmnkit/cli-sdk` SDK

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

---
Source: https://docs.bpmnkit.com/cli/plugin-authoring/
