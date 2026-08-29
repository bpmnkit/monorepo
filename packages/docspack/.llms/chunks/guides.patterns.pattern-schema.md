# Pattern Library — Pattern schema

```typescript
interface Pattern {
  id: string
  name: string
  description: string
  keywords: string[]
  readme: string                // domain context, Markdown
  workers: WorkerSpec[]
  variations: string            // common customizations, Markdown
  template: PatternTemplate     // compact BPMN structure — a rough reference, predates ProcessPlan
}

interface WorkerSpec {
  name: string
  jobType: string
  description: string
  inputs: Record<string, string>
  outputs: Record<string, string>
  externalApis?: string[]  // e.g. ["Stripe", "Adyen", "Braintree"]
  optional?: boolean
}
```


## Adding custom patterns

Create a new pattern file in `packages/patterns/src/patterns/` and export it from `index.ts`.
Follow the existing patterns as a reference — each is a single TypeScript file that exports
a `Pattern` object.

For private or organisation-specific patterns, add them to your project and contribute the
pattern object to `ALL_PATTERNS` via the `findPattern` API. Contributions to the seed library
are welcome via pull request.

---
Source: https://bpmnkit.com/docs/guides/patterns
