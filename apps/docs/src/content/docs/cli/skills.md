---
title: AIKit Skills
description: Claude Code slash commands for AI-driven process implementation, review, testing, and deployment.
---

`casen` ships four lightweight Claude Code slash commands that automate the process
development lifecycle — from natural language description to deployed, running process.
They drive `casen` directly (no MCP server, no proxy daemon).

For the full skill set — `/bpmnkit:implement`, `:extend`, `:agent`, `:connect`, plus generated
reference docs the skills read before authoring a plan — install the
[Claude Code plugin](/guides/ai-implement/#the-claude-code-plugin) instead.

## Installation

```sh
casen skills install
```

Copies the skill files into `.claude/commands/` in the current project directory.
Once installed, they appear in Claude Code's slash command picker.

```sh
# Reinstall or overwrite existing skills
casen skills install --force
```

---

## `/implement`

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

## `/review`

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

## `/test`

Run scenario tests on a BPMN process and report path/branch coverage.

```
/test invoice-approval.bpmn
```

**What it does:**

1. Looks for the `<file>.bpmn.tests.json` sidecar (written automatically by `casen synth` from a plan's `tests` array); writes one if missing
2. Runs `casen test <file>.bpmn`
3. Cross-references gateway branches and error/timer boundaries against which scenarios exercise them
4. Reports pass/fail counts and any uncovered paths

**Example output:**

```
| Scenario | Result | Details |
|----------|--------|---------|
| happy-path | ✓ PASS | (12ms) |
| rejection-path | ✓ PASS | (9ms) |

Uncovered paths:
- Boundary "sla-timeout" (timer, 48h) has no test scenario

2/2 scenarios passed. 1 boundary uncovered.
```

---

## `/deploy`

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

## No MCP server required

These skills are plain Bash + Read/Write — they call `casen` directly and never depend on an MCP server or a running proxy. The `@bpmnkit/proxy` MCP server (`bpmn-aikit`) still exists separately, for Claude Desktop/Cursor or other MCP-only hosts — it's unrelated to these slash commands.
