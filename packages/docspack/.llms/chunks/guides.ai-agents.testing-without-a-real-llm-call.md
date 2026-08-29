# AI Agents — Testing without a real LLM call

Scenarios mock the whole agent sub-process as a single job — the dispatcher routes any
job-worker-backed ad-hoc sub-process (this pattern included) through the same job-mock
mechanism as any other task:

```json
{
  "name": "Agent resolves the ticket",
  "mocks": {
    "io.camunda.agenticai:aiagent-job-worker:1": { "outputs": { "agent": { "status": "resolved" } } }
  },
  "expect": { "path": ["triage_agent"], "variables": { "agent": { "status": "resolved" } } }
}
```

```sh
casen test support-triage.bpmn
```

This verifies the process routes correctly through and around the agent step. It does not
exercise the agent's actual tool-calling behavior, prompt quality, or model choice — those
require a real (or sandboxed) LLM run, which is out of scope for `casen test`.

---
Source: https://bpmnkit.com/docs/guides/ai-agents
