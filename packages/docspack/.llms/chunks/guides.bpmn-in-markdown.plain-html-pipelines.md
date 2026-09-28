# BPMN Diagrams in Markdown — Plain HTML pipelines

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

---
Source: https://bpmnkit.com/docs/guides/bpmn-in-markdown
