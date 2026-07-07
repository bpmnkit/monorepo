---
title: Pattern Library
description: Domain BPMN patterns that Claude uses as context when implementing processes with /bpmnkit:implement.
---

The pattern library (`@bpmnkit/patterns`) provides domain knowledge for common business
processes. When you run `/bpmnkit:implement`, Claude checks the library for a matching
pattern (`casen pattern list`/`get`) and uses its readme and worker specs as context while
writing the `ProcessPlan` — the pattern's own `template` field predates the plan/synth
pipeline and is a rough structural reference, not something pasted in directly.

Patterns are hints, not templates. Claude adapts them to the specific request and ignores
them entirely when nothing relevant matches.

## Available patterns

| Pattern ID | Domain | Typical use |
|---|---|---|
| `invoice-approval` | Finance / accounts payable | Multi-level invoice review and ERP payment trigger |
| `employee-onboarding` | HR | Account provisioning, orientation scheduling, system access |
| `supplier-contract-review` | Procurement / legal | Contract classification, risk scan, CLM storage, e-signature |
| `incident-response` | IT / ops | Severity classification, on-call paging, post-mortem creation |
| `loan-origination` | Financial services | Identity verification, credit check, risk scoring, disbursement |
| `content-moderation` | Trust & safety | AI scan, action enforcement, CSAM reporting, user notification |
| `order-fulfillment` | E-commerce / supply chain | Inventory validation, payment, warehouse order, shipment tracking |

## How matching works

`casen pattern get <query>` (via `findPattern()`) scores each pattern by counting how
many of its keywords appear in the request. The highest-scoring pattern is selected.
Exact pattern ID matches take priority over keyword scoring.

Examples:

| Request | Matched pattern |
|---|---|
| "invoice approval workflow" | `invoice-approval` |
| "employee onboarding with Okta and Jira" | `employee-onboarding` |
| "on-call incident escalation" | `incident-response` |
| "custom blockchain process" | _(no match — Claude works from scratch)_ |

## What a pattern contains

Each pattern has four components:

**README** — domain context, common variations, relevant regulations, and conventions.
Claude reads this before generating the BPMN.

**Template** — a compact BPMN template in the BPMNKit intermediate format (not raw XML).
Used as a starting-point structure, not a fixed output.

**Worker specs** — typical service tasks with job type, inputs, outputs, and real integration
options (e.g. "SAP, NetSuite, or QuickBooks" for a payment trigger).

**Variations** — common process variants (e.g. "3-way match", "auto-approve below threshold")
so Claude can adapt the flow to the user's specific context.

## Using patterns from the CLI

```sh
casen pattern list
casen pattern get invoice-approval
casen pattern get "employee onboarding workflow"   # free-text match
```

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

## Pattern schema

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

## See also

- [Building Processes with AI](/guides/ai-implement/) — how Claude uses patterns during `/bpmnkit:implement`
- [`@bpmnkit/patterns` source](https://github.com/bpmnkit/monorepo/tree/main/packages/patterns)
