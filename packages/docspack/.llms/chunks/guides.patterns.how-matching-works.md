# Pattern Library — How matching works

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

---
Source: https://docs.bpmnkit.com/guides/patterns/
