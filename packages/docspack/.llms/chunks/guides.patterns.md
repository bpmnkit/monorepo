# Pattern Library

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

---
Source: https://docs.bpmnkit.com/guides/patterns/
