# Pattern Library — What a pattern contains

Each pattern has four components:

**README** — domain context, common variations, relevant regulations, and conventions.
Claude reads this before generating the BPMN.

**Template** — a compact BPMN template in the BPMNKit intermediate format (not raw XML).
Used as a starting-point structure, not a fixed output.

**Worker specs** — typical service tasks with job type, inputs, outputs, and real integration
options (e.g. "SAP, NetSuite, or QuickBooks" for a payment trigger).

**Variations** — common process variants (e.g. "3-way match", "auto-approve below threshold")
so Claude can adapt the flow to the user's specific context.

---
Source: https://docs.bpmnkit.com/guides/patterns/
