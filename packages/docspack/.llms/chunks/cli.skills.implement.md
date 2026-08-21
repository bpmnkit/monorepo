# AIKit Skills — `/implement`

End-to-end process implementation from a natural language description.

```
/implement an invoice approval process for accounts payable
/implement employee onboarding with Okta provisioning and Jira ticket creation
/implement a supplier contract review workflow with DocuSign e-signature
```

**What it does:**

1. Resolves external interactions via `casen connector search`/`show`
2. Writes a `ProcessPlan` JSON file
3. Compiles it with `casen synth`, fixing any reported problems in the plan and retrying
4. Adds test scenarios and runs `casen test`
5. Scaffolds a worker stub for every job type with no existing worker or connector
6. Presents a summary and asks where to deploy

**Output:**
```
BPMN file: invoice-approval.bpmn

Connectors used: none
Workers: reused none / scaffolded workers/validate-invoice/, workers/trigger-payment/
Tests: 3/3 passed

Deploy to local Reebe, deploy to Camunda 8, or skip?
```

See [Building Processes with AI](/guides/ai-implement/) for a full walkthrough.

---

---
Source: https://docs.bpmnkit.com/cli/skills/
