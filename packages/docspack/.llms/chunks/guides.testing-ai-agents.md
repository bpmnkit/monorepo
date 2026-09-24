# Testing AI Agents

An [AI Agent Sub-process](/docs/guides/ai-agents) lets a model choose which tools to call.
That choice changes from run to run, so a process with an agent is hard to test. Camunda
reports that only 11% of agentic projects reach production. `@bpmnkit/engine/testing`
makes the agent step deterministic: you write down, or record once, what the model decides.
The test then runs the real tools of the ad-hoc sub-process, the real `fromAi()` mappings and
the real process around them.

This guide extends [Testing Processes](/docs/guides/testing-processes). Read that first for
`createProcessTest`, job mocks and the matchers.

---
Source: https://bpmnkit.com/docs/guides/testing-ai-agents
