# Stability and Versioning — What counts as public API

**The public API of a package is what its `exports` entry points export, minus anything
marked `@internal`.** Nothing else.

```ts
import { Bpmn } from "@bpmnkit/core"            // ✅ API
import { minimap } from "@bpmnkit/plugins/minimap" // ✅ API — a declared subpath
```

These are **not** API, and may change in any release:

| Not API | Why |
|---|---|
| Deep paths into `dist/` | An implementation layout, not an entry point |
| Members marked `/** @internal */` | Reachable from the `.d.ts` because TypeScript has no other way to say "not yours" — `ProcessBuilder` carries several |
| Anything reachable only by structural inference | If you cannot import it by name from an entry point, it is not named in the contract |
| `src/` in the repo | The published package is the artifact; the repository is not |

Each package's entry points are listed in its `exports` map. `@bpmnkit/plugins` is the one to
watch: it has **no root export**, only 34 subpaths, one per plugin.

**For a package whose product is a command**, `exports` says nothing — `@bpmnkit/cli` has none
at all. Its public API is instead its **documented commands**: the command and flag names, the
meaning of its exit codes, and the shape of any `--format json` output. Prose written to a
terminal for a human to read is not API, and neither is the exact wording of an error.

For a package that renders UI, the **rendered DOM and its class names are not API** either.
Style through the documented CSS custom properties; a panel's internal markup can change in a
minor.

---
Source: https://bpmnkit.com/docs/getting-started/stability
