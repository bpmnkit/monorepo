---
title: BPMN Diagrams in Markdown
description: Put real BPMN diagrams in READMEs, Astro, Docusaurus, VitePress and MDX pages — write a fenced ```bpmn or ```bpmn-compact block and @bpmnkit/markdown renders it to inline, themeable, accessible SVG at build time.
sidebar:
  order: 15
---

Mermaid has no BPMN, and PlantUML's BPMN is a sketch. `@bpmnkit/markdown` fills the gap for
docs-as-code: write a process as a fenced code block, and the build turns it into a real BPMN
diagram — the same renderer, layout engine and shapes as the rest of BPMN Kit, drawn as inline
SVG with no client-side JavaScript.

This page uses it. The diagram below is this block, rendered when the site was built:

````md
```bpmn-compact title="Order fulfilment"
{
  "id": "order-fulfilment",
  "elements": [
    { "id": "received", "type": "startEvent", "name": "Order received" },
    { "id": "check", "type": "serviceTask", "name": "Check stock", "jobType": "check-stock" },
    { "id": "inStock", "type": "exclusiveGateway", "name": "In stock?" },
    { "id": "ship", "type": "serviceTask", "name": "Ship order", "jobType": "ship-order" },
    { "id": "shipped", "type": "endEvent", "name": "Shipped" },
    { "id": "backorder", "type": "userTask", "name": "Back-order items" },
    { "id": "waiting", "type": "endEvent", "name": "Back-ordered" }
  ],
  "flows": [
    { "id": "f1", "from": "received", "to": "check" },
    { "id": "f2", "from": "check", "to": "inStock" },
    { "id": "f3", "from": "inStock", "to": "ship", "condition": "=available" },
    { "id": "f4", "from": "inStock", "to": "backorder", "isDefault": true },
    { "id": "f5", "from": "ship", "to": "shipped" },
    { "id": "f6", "from": "backorder", "to": "waiting" }
  ]
}
```
````

```bpmn-compact title="Order fulfilment"
{
  "id": "order-fulfilment",
  "elements": [
    { "id": "received", "type": "startEvent", "name": "Order received" },
    { "id": "check", "type": "serviceTask", "name": "Check stock", "jobType": "check-stock" },
    { "id": "inStock", "type": "exclusiveGateway", "name": "In stock?" },
    { "id": "ship", "type": "serviceTask", "name": "Ship order", "jobType": "ship-order" },
    { "id": "shipped", "type": "endEvent", "name": "Shipped" },
    { "id": "backorder", "type": "userTask", "name": "Back-order items" },
    { "id": "waiting", "type": "endEvent", "name": "Back-ordered" }
  ],
  "flows": [
    { "id": "f1", "from": "received", "to": "check" },
    { "id": "f2", "from": "check", "to": "inStock" },
    { "id": "f3", "from": "inStock", "to": "ship", "condition": "=available" },
    { "id": "f4", "from": "inStock", "to": "backorder", "isDefault": true },
    { "id": "f5", "from": "ship", "to": "shipped" },
    { "id": "f6", "from": "backorder", "to": "waiting" }
  ]
}
```

```bash
npm install --save-dev @bpmnkit/markdown
```

## What goes in a block

| Fence | Contents |
|---|---|
| ` ```bpmn ` | BPMN 2.0 XML — a whole `.bpmn` file. If it carries diagram interchange (`<bpmndi:BPMNDiagram>`), that layout is drawn as it is; if the DI is missing or incomplete, the diagram is laid out automatically. |
| ` ```bpmn-compact ` | The [compact JSON format](/docs/getting-started/concepts) that `compactify()` produces and language models write. A single process can skip the `{ "id", "processes": [...] }` wrapper, as above. Always laid out automatically. |
| ` ```bpmn-json ` | An alias of `bpmn-compact`. |

There is no text DSL: the compact JSON already is the short form, and it is the same format
the rest of BPMN Kit and your AI tooling speak.

One fence attribute is read: `title="…"` sets the diagram's accessible name. Without it the
name is the process's `name`, then the first pool's, then the process id.

## Astro

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

## VitePress

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

## Plain HTML pipelines

If your tool produces HTML and offers no plugin hook, rewrite the HTML afterwards.
`renderBpmnInHtml` replaces every `<pre><code class="language-bpmn…">` block:

```ts
import { renderBpmnInHtml } from "@bpmnkit/markdown"

const page = renderBpmnInHtml(markdownToHtml(source))
```

And for anything else there is the function every adapter wraps:

```ts
import { renderBpmnBlock } from "@bpmnkit/markdown"

const result = renderBpmnBlock(xml, "bpmn", { theme: "auto" })
if (result.ok) writeFileSync("process.svg", result.svg)
else console.error(result.error)
```

## GitHub READMEs

GitHub runs no plugins, so the diagram has to be committed as an image. `bpmnkit-md` does
that for you:

```bash
npx bpmnkit-md README.md
```

Each BPMN block becomes a marked region: an image of the diagram, and the block itself folded
into a `<details>` underneath, so the source stays in the README and stays the thing you edit.

````md
<!-- bpmnkit-md:begin diagrams/order-fulfilment.svg -->
![Order fulfilment](diagrams/order-fulfilment.svg)

<details>
<summary>BPMN source</summary>

```bpmn-compact
{ … }
```

</details>
<!-- bpmnkit-md:end -->
````

Run it again after editing the source and it re-renders the region in place — the command is
idempotent, so it is safe in a pre-commit hook. In CI, `--check` writes nothing and exits 1
when a README or an SVG is out of date:

```bash
npx bpmnkit-md --check README.md docs/*.md
```

| Option | Meaning |
|---|---|
| `--out-dir <dir>` | Where new SVGs go, relative to each Markdown file. Default `diagrams`. A fence attribute `file=path/to.svg` picks one block's path. |
| `--theme auto\|light\|dark` | Default `auto`: the SVG follows the reader's colour scheme, GitHub dark mode included. |
| `--max-width <px>` | Largest width to draw a diagram at. |
| `--check` | Verify only; exit 1 if anything would change. |

`bpmnkit-md file.bpmn` writes `file.svg` next to a standalone diagram. Invalid blocks fail
the command with the line number — a committed picture of an error box helps no one.

## Options

The plugins, `renderBpmnInHtml` and `renderBpmnBlock` take the same options:

| Option | Default | Meaning |
|---|---|---|
| `theme` | `"auto"` | `auto` uses the page's `--bpmnkit-*` tokens when it defines them, and the reader's `prefers-color-scheme` when it does not. `light` / `dark` pin the palette and ignore the page. |
| `maxWidth` | natural size | Largest width in CSS pixels. The diagram still shrinks to fit narrower containers. |
| `title` | process name | The accessible name. A fence's `title="…"` overrides it per block. |
| `link` | off | `({ xml, title }) => href` — adds an "Open in BPMN Kit" link under the diagram, pointing wherever you host an editor. |
| `onError` | `"render"` | `render` draws a readable error box in place of the diagram; `throw` fails the build. |

## Theming

The SVG reads the same tokens as every other BPMN Kit surface — `--bpmnkit-bg` for the
ground, `--bpmnkit-surface` for shape fills, `--bpmnkit-fg` for strokes and labels,
`--bpmnkit-font` for type — each with a light and a dark fallback. A site that defines the
tokens gets a diagram in its own palette; one that does not gets the BPMN Kit palette in the
reader's colour scheme.

The switch is CSS `light-dark()` under `color-scheme: light dark`, written into `style`
attributes rather than a `<style>` element. An inline SVG's `<style>` applies to the whole
page, and Vue templates (VitePress) drop it entirely; attributes have neither problem. It
needs a browser from 2024 or later.

## Accessibility

Every diagram is an `<svg role="img">` labelled by its `<title>` and described by a `<desc>`
that lists the process's named steps in order, so a screen reader announces
"Order fulfilment — BPMN process diagram. Steps: Order received, Check stock, …". In
pre-rendered READMEs, the title is the image's alt text.

## Errors

A block that does not parse does not break the build by default. It renders as a box that
says what went wrong:

```bpmn-compact
{ "id": "typo", "elements": [ { "id": "start", "type": "startEvnt" } ], "flows": [] }
```

The remark plugin also adds the error to the file's messages (`file.messages`), where tools
that report vfile warnings pick it up. Set `onError: "throw"` to fail the build instead.

## Output is deterministic

The same block and options always produce the same bytes: element ids are derived from a
hash of the block, not a counter or a clock. Pre-rendered SVGs diff cleanly, and a build
that did not change a diagram does not change its file.
