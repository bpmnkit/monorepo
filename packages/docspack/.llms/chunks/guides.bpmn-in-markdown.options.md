# BPMN Diagrams in Markdown — Options

The plugins, `renderBpmnInHtml` and `renderBpmnBlock` take the same options:

| Option | Default | Meaning |
|---|---|---|
| `theme` | `"auto"` | `auto` uses the page's `--bpmnkit-*` tokens when it defines them, and the reader's `prefers-color-scheme` when it does not. `light` / `dark` pin the palette and ignore the page. |
| `maxWidth` | natural size | Largest width in CSS pixels. The diagram still shrinks to fit narrower containers. |
| `title` | process name | The accessible name. A fence's `title="…"` overrides it per block. |
| `link` | off | `({ xml, title }) => href` — adds an "Open in BPMN Kit" link under the diagram, pointing wherever you host an editor. |
| `onError` | `"render"` | `render` draws a readable error box in place of the diagram; `throw` fails the build. |

---
Source: https://bpmnkit.com/docs/guides/bpmn-in-markdown
