# AI Agents

Camunda 8's **AI Agent Sub-process** lets a single process step delegate to an LLM that can
call tools (other BPMN activities) in a loop until it produces a final answer. BPMNKit
generates this pattern the same way it generates everything else: deterministically, from a
`ProcessPlan` — never by hand-writing the underlying ad-hoc-sub-process XML.


## Quick start

```
/bpmnkit:agent add a support-triage agent with tools: search KB (http), escalate to human (user task), post summary to slack
```

Or, from the CLI directly: write an `aiAgent` plan step (see below), then `casen synth`.

---
Source: https://docs.bpmnkit.com/guides/ai-agents/
