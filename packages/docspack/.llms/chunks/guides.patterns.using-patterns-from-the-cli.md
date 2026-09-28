# Pattern Library — Using patterns from the CLI

```sh
casen pattern list
casen pattern get invoice-approval
casen pattern get "employee onboarding workflow"   # free-text match
```


## Patterns and templates

The same package has a second export, `@bpmnkit/patterns/templates`. It holds the
[runnable process templates](/docs/guides/templates) behind the [gallery](/templates):
complete, deployable processes with test scenarios. A pattern gives an AI model context to
write its own process. A template is a finished process you copy and change. Use
`casen pattern` for patterns and `casen template` for templates.


## Using patterns from code

You can access the pattern library directly in TypeScript:

```typescript
import { ALL_PATTERNS, findPattern } from "@bpmnkit/patterns"

// List all patterns
console.log(ALL_PATTERNS.map((p) => p.id))

// Find by keyword match
const pattern = findPattern("employee onboarding workflow")
console.log(pattern?.id)  // "employee-onboarding"

// Find by exact ID
const invoice = findPattern("invoice-approval")
console.log(invoice?.workers.map((w) => w.jobType))
```

---
Source: https://bpmnkit.com/docs/guides/patterns
