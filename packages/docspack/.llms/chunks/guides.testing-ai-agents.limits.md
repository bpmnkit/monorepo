# Testing AI Agents — Limits

- The mock plays the AI Agent **Sub-process** connector
  (`io.camunda.agenticai:aiagent-job-worker:1`, which `buildAiAgentSubProcess` builds).
  For the AI Agent **Task** with a separate ad-hoc sub-process, the simulator does not
  evaluate `activeElementsCollection`. Mock that task with `mockJob`.
- The connector's `errorExpression` is not evaluated. Thus a failed tool or a model-call limit
  fails the run instead of throwing `AGENT_FAILED`.
- Two runs of the same agent element at the same time in one run, for example inside a
  parallel multi-instance, share the turn state.
- `agent.context` holds only `state` and `metrics.modelCalls`, not the conversation.

---
Source: https://bpmnkit.com/docs/guides/testing-ai-agents
