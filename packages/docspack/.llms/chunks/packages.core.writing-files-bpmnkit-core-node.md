# @bpmnkit/core — Writing files — `@bpmnkit/core/node`

Anything that touches the filesystem lives behind the `@bpmnkit/core/node` subpath, so
importing `@bpmnkit/core` itself never pulls `node:` builtins into a browser bundle.

### `writeBpmn(definitions, options)`

The only supported way to write a BPMN file, and the only one that checks what it wrote.
Before anything reaches disk it serialises the model, **parses the result back**, and compares
the semantic hashes. If they differ the write is refused and nothing is written.

```typescript
import { writeBpmn } from "@bpmnkit/core/node";
import { WriteError, WriteVerificationError } from "@bpmnkit/core";

const result = await writeBpmn(definitions, {
  output: "flow.bpmn",
  force: false,        // default — refuses rather than replace an existing file
  layout: "preserve",  // default — "auto" regenerates the diagram first
});

result.destination;    // absolute path written
result.semanticHash;   // the model's hash, verified after reading it back
result.outputSha256;   // digest of the exact bytes on disk
result.changes;        // what this write changed about the file it replaced
```

The file appears complete or not at all: contents go to a temporary file in the destination's
own directory and are then linked or renamed into place, so an interrupted write cannot leave
a half-written model behind. Two concurrent writes to the same new path cannot both succeed.

`WriteVerificationError` carries a `changes` field naming the elements that diverged.
`WriteError` means the destination exists and `force` was not given, or the filesystem refused.

**What the check does not cover.** It compares the model in memory against the model read back
from the output, so it catches the serialiser losing something. It cannot catch the *parser*
having dropped something on the way in — content the parser never saw is absent from both
sides. That is what the round-trip corpus gate covers, and there is deliberately no option to
skip verification: turning it off would only ever be used to get past the bug it exists to
report. If you want unchecked serialisation, `Bpmn.export()` still returns a string.

---
Source: https://bpmnkit.com/docs/packages/core
