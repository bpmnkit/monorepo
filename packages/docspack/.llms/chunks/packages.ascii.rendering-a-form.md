# @bpmnkit/ascii — Rendering a form

```typescript
import { renderFormAscii } from "@bpmnkit/ascii";

console.log(renderFormAscii(readFileSync("approval.form", "utf-8")));
```

Fields are listed in layout order with their keys, types and validation, so a form can be
reviewed in the same place as the process that raises it.


## API Reference

| Export | Signature |
|---|---|
| `renderBpmnAscii` | `(xml: string, options?: RenderOptions) => string` |
| `renderDmnAscii` | `(xml: string, options?: RenderOptions) => string` |
| `renderFormAscii` | `(json: string, options?: RenderOptions) => string` |

Each takes the file's text and returns the rendering. Parsing is strict — a document that is
not valid BPMN throws, naming what it found — so wrap the call if you are rendering a
directory. A document that parses but holds no flow elements
renders as `(empty)`.

### `RenderOptions`

```typescript
interface RenderOptions {
  /**
   * Heading shown above the diagram.
   * Defaults to the process name from the XML; pass `false` for no heading.
   */
  title?: string | false;
}
```

---
Source: https://bpmnkit.com/docs/packages/ascii
