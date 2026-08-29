# AI Agents — Deploy-grade validation

`casen lint --profile deploy` includes `agentic/*` rules specific to this pattern:

| Rule | Catches |
|---|---|
| `agentic/tool-not-root` | A tool with an incoming sequence flow (tools must be root nodes) |
| `agentic/tool-no-description` | A tool with no documentation for the LLM to read |
| `agentic/fromai-bad-ref` | A `fromAi()` call whose first argument doesn't reference `toolCall.*` |
| `agentic/no-output-collection` | Missing tool-result aggregation |
| `agentic/limits-missing` | No `maxModelCalls` safety limit |

The `data-flow` category can report spurious "variable never set" findings against the
agent's own provider/model/prompt bindings (a hyphenated model id like `claude-sonnet-5`
can be misread as an arithmetic expression) — this is a known limitation of that heuristic,
not a real issue, and doesn't affect the `deploy` profile.

---
Source: https://bpmnkit.com/docs/guides/ai-agents
