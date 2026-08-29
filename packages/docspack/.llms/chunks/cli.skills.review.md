# AIKit Skills — `/review`

Run the full static analyzer on a BPMN file and get a structured findings report.

```
/review invoice-approval.bpmn
/review path/to/process.bpmn
```

**What it does:**

1. Runs `casen lint lint <file> --profile deploy` (the deploy-readiness gate) and the default profile (all categories)
2. Groups findings by severity: errors, warnings, info
3. Offers `casen lint lint <file> --fix` to apply auto-fixable findings
4. Ends with an explicit **"Deploy-ready: yes/no"** verdict

**Example output:**

```
Errors (1):
  - [Task_1] [deploy] Service task has no zeebe:taskDefinition type.

Warnings (2):
  - [Gateway_1] [pattern] Gateway has no default flow
  - [Process_1] [pattern] No timer event on long-running tasks

Deploy-ready: no — 1 error
```

---

---
Source: https://bpmnkit.com/docs/cli/skills
