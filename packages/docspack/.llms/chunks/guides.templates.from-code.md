# Process Templates — From code

```typescript
import {
  ALL_TEMPLATES,
  TEMPLATE_CATEGORIES,
  getTemplate,
  listJobTypes,
  templateFiles,
} from "@bpmnkit/patterns/templates"

const template = getTemplate("ai-evaluator-optimizer")
const defs = template?.build()                  // BpmnDefinitions, laid out
const files = template ? templateFiles(template) : [] // [{ path, content }] — what casen writes
const workers = defs ? listJobTypes(defs) : []  // job types your workers must serve
```

`build()` returns a new model on each call, so you can change it with `Bpmn.continueProcess` or
the builder before you export it.

---
Source: https://bpmnkit.com/docs/guides/templates
