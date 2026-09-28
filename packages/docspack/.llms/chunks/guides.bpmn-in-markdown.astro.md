# BPMN Diagrams in Markdown — Astro

```js
// astro.config.mjs
import { remarkBpmn } from "@bpmnkit/markdown"
import { defineConfig } from "astro/config"

export default defineConfig({
  markdown: { remarkPlugins: [[remarkBpmn, { maxWidth: 760 }]] },
})
```

That covers `.md` content collections and, through `@astrojs/mdx`, `.mdx` pages too. This site
is configured exactly this way.


## Docusaurus

```js
// docusaurus.config.mjs
import { remarkBpmn } from "@bpmnkit/markdown"

export default {
  presets: [
    ["classic", { docs: { remarkPlugins: [remarkBpmn] }, blog: { remarkPlugins: [remarkBpmn] } }],
  ],
}
```

The package is ESM-only; with a CommonJS `docusaurus.config.js`, load it with
`const { remarkBpmn } = await import("@bpmnkit/markdown")` inside an async config function.

---
Source: https://bpmnkit.com/docs/guides/bpmn-in-markdown
