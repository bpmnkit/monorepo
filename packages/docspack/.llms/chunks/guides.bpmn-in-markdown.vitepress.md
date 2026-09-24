# BPMN Diagrams in Markdown — VitePress

VitePress renders Markdown with markdown-it, so use the markdown-it plugin:

```ts
// .vitepress/config.ts
import { markdownItBpmn } from "@bpmnkit/markdown"
import { defineConfig } from "vitepress"

export default defineConfig({
  markdown: { config: (md) => md.use(markdownItBpmn) },
})
```

Every other fence is handed back to the rule that was there before, so VitePress's
highlighting and code groups keep working.


## Next.js MDX, unified, anything remark

```js
// next.config.mjs
import createMDX from "@next/mdx"
import { remarkBpmn } from "@bpmnkit/markdown"

const withMDX = createMDX({ options: { remarkPlugins: [remarkBpmn] } })
export default withMDX({ pageExtensions: ["ts", "tsx", "md", "mdx"] })
```

`remarkBpmn` is an ordinary remark plugin, so `unified().use(remarkParse).use(remarkBpmn)…`
works the same way.

It is a **remark** plugin rather than a rehype one on purpose. At the remark stage the block
is still a Markdown `code` node with its language on it; by the rehype stage a syntax
highlighter has usually turned it into a tree of coloured spans. And it hands the diagram on
as hast elements, not as a raw HTML string, so MDX — which drops raw HTML — renders it too.

---
Source: https://bpmnkit.com/docs/guides/bpmn-in-markdown
