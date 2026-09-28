# Process Templates — What is in the gallery

| Category | Templates |
|---|---|
| Order to cash | `order-to-cash`, `payment-collection` |
| Approvals | `purchase-request-approval`, `expense-approval`, `contract-approval` |
| Onboarding | `employee-onboarding`, `customer-kyc-onboarding` |
| Incident & escalation | `incident-escalation`, `security-alert-triage` |
| Document processing | `invoice-capture`, `document-signature`, `document-classification` |
| SLA & timers | `support-ticket-sla`, `scheduled-report` |
| Sagas & error handling | `travel-booking-saga`, `payment-saga` |
| Human in the loop | `four-eyes-review`, `content-review` |
| AI agent patterns | `ai-prompt-chaining`, `ai-routing`, `ai-parallelization`, `ai-orchestrator-workers`, `ai-evaluator-optimizer`, `ai-human-approval-gate`, `ai-agent-tool-loop` |

The AI agent patterns follow Anthropic's
[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
taxonomy. Each fixed step is one model call through Camunda's **AI Agent Task** connector
(`io.camunda.agenticai:aiagent:1`). The orchestrator–workers and tool-loop templates use the
**AI Agent Sub-process** connector (`io.camunda.agenticai:aiagent-job-worker:1`). That connector
is an ad-hoc sub-process whose tools are the activities inside it. The model decides which
tools to call and when.

---
Source: https://bpmnkit.com/docs/guides/templates
