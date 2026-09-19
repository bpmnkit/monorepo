# @bpmnkit/plugins — Overview

`@bpmnkit/plugins` is the capability layer above `@bpmnkit/canvas` and `@bpmnkit/editor`. The
canvas draws a diagram and exposes a `CanvasApi`; a plugin is anything that takes that API and
adds something — an overlay, a panel, a keyboard mode, a side effect on save.

Every plugin ships behind **its own entry point**, so a viewer that wants a minimap and
nothing else pays for a minimap and nothing else:

```typescript
import { createMinimapPlugin } from "@bpmnkit/plugins/minimap";
```

There is deliberately **no root export**. `import … from "@bpmnkit/plugins"` does not resolve,
because a barrel would pull all thirty-four into every bundle that wanted one.

---
Source: https://bpmnkit.com/docs/packages/plugins
