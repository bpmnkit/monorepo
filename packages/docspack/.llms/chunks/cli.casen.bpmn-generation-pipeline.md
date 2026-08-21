# casen CLI — BPMN generation pipeline

Every BPMN process is authored as a `ProcessPlan` JSON file — never hand-written XML — and
compiled deterministically:

```sh
# Print the ProcessPlan JSON format reference (schema + field notes)
casen plan schema

# Compile a plan to laid-out, deployable BPMN
casen synth synth order-process.plan.json --output order-process.bpmn

# Extend an existing process: lift it back to plan form, then merge a delta plan into it
casen plan extract order-process.bpmn
casen synth synth delta.plan.json --merge order-process.bpmn --output order-process.bpmn

# Find and inspect a Camunda connector template
casen connector search slack
casen connector show io.camunda.connectors.Slack.v1

# Deploy-readiness gate, then deploy
casen lint lint order-process.bpmn --profile deploy
casen deploy deploy order-process.bpmn                   # local Reebe
casen deploy deploy order-process.bpmn --target camunda8 # active Camunda 8 profile
```

`casen synth` reports any problems keyed by JSON path in the plan (e.g. `steps[2].connector.values.token`) — fix the plan, never the XML, and re-run. If the plan has a `tests` array, `casen synth` also writes a `<file>.bpmn.tests.json` sidecar, runnable with `casen test <file>.bpmn`.

See [Building Processes with AI](/guides/ai-implement/) and [AI Agents](/guides/ai-agents/) for full walkthroughs.

---
Source: https://docs.bpmnkit.com/cli/casen/
