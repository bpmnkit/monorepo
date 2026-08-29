# Claude Code Plugin — Configuration

When the plugin is enabled, Claude Code prompts for two optional values:

| Config key | Description |
|---|---|
| `camunda_endpoint` | Camunda 8 REST API endpoint (leave blank for local Reebe) |
| `camunda_token` | Camunda 8 OAuth2 token (leave blank for local Reebe) |

Leave both blank to use the local [Reebe engine](/docs/cli/casen#local-engine-reebe).

---


## Skills

### `/bpmnkit:implement <description>`

The main entry point — natural language to a compiled, tested BPMN process.

```
/bpmnkit:implement order fulfillment with payment and inventory check
/bpmnkit:implement employee onboarding process with HR approval
```

Resolves connectors, writes a `ProcessPlan`, compiles it with `casen synth`, tests it,
scaffolds any missing workers, and asks where to deploy.

---

### `/bpmnkit:extend <file> <change request>`

Extend an existing process from a natural-language change.

```
/bpmnkit:extend order-fulfillment.bpmn add a timeout boundary on the payment step
```

Lifts the process to plan form (`casen plan extract`), writes a small delta plan, and
merges it in (`casen synth --merge`) — the summary is at the element level, not an XML diff.

---

### `/bpmnkit:agent [file] <description>`

Design and add a Camunda AI Agent Sub-process.

```
/bpmnkit:agent add a support-triage agent with tools: search KB (http), escalate to human (user task)
```

Works out the provider/model, prompts, and tools (each mapped via connector search or an
existing worker job type), then compiles and mock-tests the agent step. See
[AI Agents](/docs/guides/ai-agents) for the full pattern.

---

### `/bpmnkit:connect <file> <step> <service>`

Wire an existing plan step to an external system via a Camunda connector template.

```
/bpmnkit:connect order-fulfillment.bpmn notify_ops slack
```

---

### `/bpmnkit:review [file.bpmn]`

Run the full static analyzer and report deploy-readiness.

```
/bpmnkit:review
/bpmnkit:review order-fulfillment.bpmn
```

Reports findings grouped by severity and ends with an explicit "Deploy-ready: yes/no" verdict.

---

### `/bpmnkit:test [file.bpmn]`

Run scenario tests and report path/branch coverage.

```
/bpmnkit:test
/bpmnkit:test order-fulfillment.bpmn
```

---

### `/bpmnkit:deploy [file.bpmn] [--local|--camunda]`

Gate on deploy-readiness, then deploy to local Reebe or Camunda 8.

```
/bpmnkit:deploy
/bpmnkit:deploy order-fulfillment.bpmn --camunda
```

---

### `/bpmnkit:instances [process-id] [--active|--failed]`

List running process instances.

```
/bpmnkit:instances
/bpmnkit:instances order-process --failed
```

---

### `/bpmnkit:incidents [--process-id X]`

List open incidents with suggested resolution actions.

```
/bpmnkit:incidents
/bpmnkit:incidents --process-id order-process
```

---

---
Source: https://bpmnkit.com/docs/guides/claude-code-plugin
