# AIKit Skills — `/deploy`

Gate a BPMN process on deploy-readiness, then deploy it to local Reebe or Camunda 8.

```
/deploy invoice-approval.bpmn
```

**What it does:**

1. Runs `casen lint lint <file> --profile deploy` — stops if it reports any errors
2. Deploys via `casen deploy deploy <file>` (local) or `casen deploy deploy <file> --target camunda8`
3. Verifies with `casen process-definition list`
4. Reminds you to start any scaffolded workers and provision any `{{secrets.NAME}}` the process references

**Targets:**

- **Local Reebe** — deploys via `ZEEBE_ADDRESS` (default `http://localhost:26500`). Start Reebe first: `casen reebe start --port 26500`
- **Camunda 8** — deploys using the active `casen` profile. Set one up: `casen profile create`

---

---
Source: https://docs.bpmnkit.com/cli/skills/
