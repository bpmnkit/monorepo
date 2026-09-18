# @bpmnkit/connectors — Validating a template

```typescript
import { validateElementTemplate } from "@bpmnkit/connectors";

validateElementTemplate(template);
// {
//   valid: false,
//   problems: [
//     { path: 'properties[0].type',
//       message: 'unknown property type "nope" — expected one of String, Text, Hidden, Dropdown, Boolean, Number' },
//     { path: 'properties[0].binding', message: 'binding is required' },
//   ],
//   warnings: [],
// }
```

Problems are reported by **path** rather than as a JSON-schema `oneOf` dump, and every problem
is collected rather than stopping at the first. Warnings are kept separate from problems, so a
CI gate can fail on one and not the other. `readTemplateDocument` parses a file that may hold
one template or an array of them.

The CLI wraps this as [`casen connector validate`](/docs/cli/connector), which exits non-zero
for CI and takes `--format json`.

---
Source: https://bpmnkit.com/docs/packages/connectors
