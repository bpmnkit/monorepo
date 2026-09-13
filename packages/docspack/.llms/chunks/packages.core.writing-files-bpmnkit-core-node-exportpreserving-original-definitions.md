# @bpmnkit/core — Writing files — `@bpmnkit/core/node` — `exportPreserving(original, definitions)`

Writes a model back over the file it came from, changing as little as possible.

`Bpmn.export()` writes a model the way this toolkit writes models. That is the right output
for a new document and the wrong one for an existing file: the first visual edit reformats
every line, and the commit says "the whole diagram" when it means "a box moved".

Exported from `@bpmnkit/core` itself, not the `/node` subpath — it is string work, and the
caller owns the file:

```typescript
import { readFile, writeFile } from "node:fs/promises";
import { Bpmn, exportPreserving } from "@bpmnkit/core";

const onDisk = await readFile("order.bpmn", "utf8");
const edited = Bpmn.parse(onDisk);
edited.processes[0].flowElements[0].name = "Validate Order";

await writeFile("order.bpmn", exportPreserving(onDisk, edited));
// Renaming one task changes one line, not the whole file.
```

Indentation, attribute order, comments, the order children were written in, and attributes
left at their schema default all survive. Opening a file and writing it back unchanged leaves
it byte for byte.

Nothing about that is assumed, though. The model cannot represent the order a file writes its
children in — a process holds `flowElements` and `sequenceFlows` as separate lists — so each
strategy is tried, **the result is parsed back and compared against a plain write**, and the
first that reads the same is the one used. The plain write is the floor, so calling this is
never worse than not.

| Function | Takes | Returns |
| --- | --- | --- |
| `exportPreserving(original, definitions)` | the file's current text + a model | the new text |
| `exportPreservingResult(original, definitions)` | same | the text plus what it managed to keep |
| `preserveBpmnFormatting(original, updated)` | two documents as text | for a caller that already serialised, such as an editor's `exportXml()` |
| `exportDmnPreserving` / `preserveDmnFormatting` | DMN | the same treatment |
| `exportFormPreserving` / `preserveFormFormatting` | Camunda form JSON | indentation, key order and trailing newline |

This is what the [VS Code extension](/docs/guides/vscode) saves through, and what makes a
visual edit reviewable in a pull request.

Builder output is stable for the same reason: sequence-flow and root-definition ids are
derived from the model (`Flow_<source>_<target>`, `Message_<name>`, `Error_<code>`) rather
than randomly generated, so rebuilding an unchanged model produces the same file and the one
edge that changed is not buried in a diff of edges that did not.

---
Source: https://bpmnkit.com/docs/packages/core
